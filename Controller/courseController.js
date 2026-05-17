// Node utils
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Models
import courseModel from "../Model/courseModel.js";
import favoriteCourseModel from "../Model/favoriteCourseModel.js";
import levelProgressModel from "../Model/progressLevelModel.js";
import progressModel from "../Model/Progress.js";
import userModel from "../Model/userModel.js";
import QuizMistake from "../Model/recommandation.js";

// Controllers / Utils
import { notifyNewCourse, notifyNewQuiz } from "./notificationController.js";
import { extractTopic } from "../utils/topicExtractor.js";
import { scoreQuestion, getCorrectAnswerDisplay } from "./quizController.js";
import {
    calculateCurrentStreak,
    calculateQuizAverage,
    calculateCourseProgressPercent,
    calculateTimeSpentMinutes,
    formatMinutesAsHoursAndMinutes
} from "../utils/learningStats.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function to parse lessons from req.body and req.files
function parseLessons(bodyLessons = {}, lessonFiles = []) {
    const lessonsArray = Object.values(bodyLessons); // Convert from object to array
    return lessonsArray.map((lesson, index) => ({
        name: lesson.name || "",
        type: lesson.type || "video",
        duration: lesson.duration || "",
        file: lessonFiles[index]?.filename ? `/uploads/${lessonFiles[index].filename}` : ""
    }));
}

// Parse questions from req.body for all 4 question types
function parseQuestions(rawQuestions = []) {
    return rawQuestions.map(q => {
        const base = {
            question: q.question || "", // default to empty string if not provided
            questionType: q.questionType || "multiple-choice",
        };

        switch (base.questionType) {
            case "true-false":
                return {
                    ...base,
                    options: ["True", "False"],
                    correctAnswer: parseInt(q.correctAnswer) || 0,
                };

            case "multiple-choice":
                return {
                    ...base,
                    options: Array.isArray(q.options) ? q.options : [],
                    correctAnswer: parseInt(q.correctAnswer) || 0,
                };

            case "multi-select":
                return {
                    ...base,
                    options: Array.isArray(q.options) ? q.options : [],
                    correctAnswers: Array.isArray(q.correctAnswers)
                        ? q.correctAnswers.map(Number)
                        : [],
                };

            case "written":
                return {
                    ...base,
                    correctAnswerText: q.correctAnswerText || "",
                };

            default:
                return base;
        }
    });
}

// create course
const createCourse = async (req, res) => {
    try {
        // verify if the user is an instructor
        const instructorId = req.id; 
        if (!instructorId) return res.status(401).json({ message: "Unauthorized" });

        // check if course with same title already exists for this instructor
        const existingCourse = await courseModel.findOne({
            Title: req.body.Title,
            Instructor: instructorId
        });
        if (existingCourse) return res.status(400).json({ message: "Course already exists" });

        // Handle file uploads and form data
        const imagePath = req.files?.image?.[0]
            ? `/uploads/${req.files.image[0].filename}`
            : null;
        if (!imagePath) return res.status(400).json({ message: "Course thumbnail is required" });

        const uploadedFiles = req.files?.lessonFiles || [];
        const lessonsFromForm = Object.values(req.body.lessons || {});
        const lessons = lessonsFromForm.map((lesson, index) => ({
            name: lesson.name || "",
            type: lesson.type || "video",
            duration: lesson.duration || "",
            level: lesson.level,
            file: uploadedFiles[index] ? `/uploads/${uploadedFiles[index].filename}` : ""
        }));

        let resources = [];
        if (req.body.resources) {
            try { resources = JSON.parse(req.body.resources); } catch { resources = []; }
        }

        const isPublished = req.body.isPublished === "on";

        const course = new courseModel({
            Title: req.body.Title,
            Description: req.body.Description,
            category: req.body.category,
            totalDuration: req.body.totalDuration || "Coming soon",
            level: req.body.level || "beginner",
            price: parseFloat(req.body.price) || 0,
            slug: req.body.slug || undefined,
            Instructor: instructorId,
            isPublished,
            image: imagePath,
            lessons,
            resources
        });

        const savedCourse = await course.save();
        await notifyNewCourse(instructorId, savedCourse);

        if (req.xhr || req.headers.accept?.includes("application/json")) {
            return res.json({ success: true, course: savedCourse });
        }
        return res.redirect("/teacherDashboard/get");

    } catch (err) {
        console.error("createCourse error:", err);
        if (err.code === 11000) return res.status(400).json({ message: "A course with this title already exists" });
        return res.status(500).json({ message: "Internal server error: " + err.message });
    }
};

// get all courses for students
const getAllCourses = async (req, res) => {
    try {
        const allCourses = await courseModel.find({ isPublished: true });

        // favorites for current logged-in user
        const favoriteIds = [];
        if (req.id) {
            const favorites = await favoriteCourseModel.find({ userId: req.id }).select("courseId");
            favoriteIds.push(...favorites.map(f => f.courseId));
        }

        return res.render("auth/courses", { courses: allCourses, favoriteIds: favoriteIds.map(String) });
    } catch (err) {
        return res.status(500).json({ message: "Internal server error" });
    }
};

// get course by slug (for both teacher and student, with different rendering)
const getCourseBySlug = async (req, res) => {
    try {
        const course = await courseModel
            .findOne({ slug: req.params.slug })
            .populate("Instructor", "userName email");

        if (!course) return res.status(404).json({ message: "Course not found" });

        if (req.role === "student") return res.render("auth/courseDetailStudent", { course });
        return res.render("auth/editCourse", { course });

    } catch (err) {
        return res.status(500).json({ message: "Internal server error" });
    }
};

// get course by slug for student view (with placement quiz logic)
// Logic:
//   1. If student already completed the placement quiz → redirect to /learn
//   2. Otherwise → render course.ejs with the placement quiz embedded
const getCourseBySlugForStudent = async (req, res) => {
    try {
        const course = await courseModel
            .findOne({ slug: req.params.slug })
            .populate("Instructor", "userName email");

        if (!course) return res.status(404).send("Course not found");

        const userId = req.id;
        const levelProgress   = await levelProgressModel.findOne({ userId, courseId: course._id });
        const courseProgress  = await progressModel.find({ userId, courseId: course._id }).sort({ lastUpdated: -1 });
        const allUserProgress = await progressModel.find({ userId }).sort({ lastUpdated: -1 });

        const completedLessons = courseProgress.filter(item => item.completed).length;
        const timeSpent = formatMinutesAsHoursAndMinutes(
            calculateTimeSpentMinutes(course, courseProgress)
        );

        const courseStats = {
            completedLessons,
            totalLessons:    course.lessons?.length || 0,
            progressPercent: calculateCourseProgressPercent(course, courseProgress),
            currentStreak:   calculateCurrentStreak(allUserProgress),
            timeSpentText:   `${timeSpent.hours}h ${timeSpent.minutes}m`,
            quizAverage:     calculateQuizAverage(levelProgress ? [levelProgress] : [])
        };

        // FIX: check if student completed the entire course (advanced quiz passed)
        const advancedPassed = levelProgress?.levels?.advanced?.quizPassed === true;

        // If placement done but advanced NOT yet passed → go to learn page
        if (levelProgress && levelProgress.placementCompleted && !advancedPassed) {
            return res.redirect(`/courses/course/${course.slug}/learn`);
        }

        // If advanced is passed → fall through and render the course page
        // with updated stats so the student sees their completed state

        const placementQuiz = course.quizzes.find(q => q.quizType === "placement")
            || course.placementQuiz
            || null;

        return res.render("auth/course", {
            course,
            courseStats,
            placementQuiz,
            showPlacementQuiz: !!placementQuiz && !advancedPassed
        });

    } catch (err) {
        console.error(err);
        return res.status(500).send("Error loading course");
    }
};



// get course lessons management page for teacher
const getCourseLessonsPage = async (req, res) => {
    try {
        const course = await courseModel.findOne({
            slug: req.params.slug,
            Instructor: req.id
        });
        if (!course) return res.status(404).send("Course not found");

        // For teacher view, we want to show all lessons and quizzes regardless of level
        const placementQuiz = course.quizzes.find(q => q.quizType === "placement") || null;
        const quizzesByLevel = {
            beginner:     course.quizzes.filter(q => q.quizType === "level" && q.level === "beginner"),
            intermediate: course.quizzes.filter(q => q.quizType === "level" && q.level === "intermediate"),
            advanced:     course.quizzes.filter(q => q.quizType === "level" && q.level === "advanced"),
        };

        return res.render("auth/courseLessons", {
            course,
            lessons: course.lessons || [],
            quizzesByLevel,
            placementQuiz
        });

    } catch (err) {
        console.error("getCourseLessonsPage error:", err);
        return res.status(500).send("Server error");
    }
};

// complete lesson (mark as completed and award points)
const completeLesson = async (req, res) => {
    try {
        const { courseId, lessonId } = req.body;
        const userId = req.id;

        console.log('Complete lesson request:', { userId, courseId, lessonId });

        // Additional validation to ensure courseId and lessonId are provided
        if (!courseId || !lessonId) {
            console.log('Missing required fields');
            return res.status(400).json({
                success: false,
                message: "Course ID and Lesson ID are required"
            });
        }

        console.log(`Completing lesson: userId=${userId}, courseId=${courseId}, lessonId=${lessonId}`);
        // Find existing progress or create new
        let progress = await progressModel.findOne({ userId, courseId, lessonId });
        console.log('Found progress:', progress ? 'existing' : 'none');

        if (!progress) {
            console.log('Creating new progress record');
            progress = new progressModel({
                userId, courseId, lessonId,
                completed: true, progress: 100, pointsEarned: 10, lastUpdated: new Date()
            });
        } else {
            console.log('Updating existing progress record');
            progress.completed = true;
            progress.progress = 100;
            progress.pointsEarned = 10;
            progress.lastUpdated = new Date();
        }

        await progress.save();
        console.log('Progress saved successfully');
         
        const course = await courseModel.findById(courseId);
        if (!course) {
            console.log('Course not found:', courseId);
            return res.status(404).json({
                success: false,
                message: "Course not found"
            });
        }
        // Ensure level progress exists for this user and course
        const levelProgress = await levelProgressModel.findOne({ userId, courseId });
        if (!levelProgress) {
            console.log('Level progress not found, creating default level progress');
            // Create a default level progress if it doesn't exist
            const newLevelProgress = new levelProgressModel({
                userId,
                courseId,
                currentLevel: 'beginner',
                placementCompleted: true,
                placementScore: 0,
                levels: {
                    beginner:     { quizPassed: false, quizAttempts: 0, lastScore: 0 },
                    intermediate: { quizPassed: false, quizAttempts: 0, lastScore: 0 },
                    advanced:     { quizPassed: false, quizAttempts: 0, lastScore: 0 }
                }
            });
            await newLevelProgress.save();
            console.log('Created default level progress');
        }
        // Check if all lessons of the current level are completed to determine if we show the quiz
        const currentLevelLessons = course.lessons.filter(l => l.level === (levelProgress ? levelProgress.currentLevel : 'beginner'));
        const completedLessons = await progressModel.find({
            userId, courseId,
            lessonId: { $in: currentLevelLessons.map(l => l._id) },
            completed: true
        });
        const allCompleted = completedLessons.length === currentLevelLessons.length;

        console.log(`Lesson completed. All completed: ${allCompleted}`);

        return res.json({
            success: true,
            allCompleted,
            message: allCompleted
                ? "🎉 All lessons completed! You can now take the quiz!"
                : "Lesson completed!"
        });

    } catch (err) {
        console.error('Complete lesson error:', err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to complete lesson"
        });
    }
};

// Record lesson open/read activity so streak can count daily lesson visits
const openLesson = async (req, res) => {
    try {
        const { courseId, lessonId } = req.body;
        const userId = req.id;

        if (!courseId || !lessonId) {
            return res.status(400).json({ success: false, message: "courseId and lessonId are required" });
        }
        // Validate that the course and lesson exist
        const course = await courseModel.findById(courseId).select("_id lessons._id");
        if (!course) {
            return res.status(404).json({ success: false, message: "Course not found" });
        }

        const lessonExists = course.lessons.some(lesson => String(lesson._id) === String(lessonId));
        if (!lessonExists) {
            return res.status(404).json({ success: false, message: "Lesson not found in this course" });
        }
        // Find existing progress or create new with 0% progress (indicating it was opened)
        let progress = await progressModel.findOne({ userId, courseId, lessonId });
        if (!progress) {
            progress = new progressModel({
                userId,
                courseId,
                lessonId,
                progress: 1,
                completed: false,
                pointsEarned: 0,
                lastUpdated: new Date()
            });
        } else {
            progress.lastUpdated = new Date();
            if (!progress.completed && Number(progress.progress || 0) < 1) {
                progress.progress = 1;
            }
        }

        await progress.save();

        // Increment global lesson-open click counter for every “View Lesson” click
        // (This makes it increase on EVERY click, not only once per day)
        // NOTE: This is a separate counter from the day-based streak.
        const user = await userModel.findByIdAndUpdate(
            userId,
            { $inc: { lessonOpenClicks: 1 } },
            { new: true }
        );

        return res.json({ success: true, lessonOpenClicks: user?.lessonOpenClicks });
    } catch (err) {
        console.error("openLesson error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// edit course ( by slug and the instructor who created it)  
const editCourse = async (req, res) => {
    try {
        const course = await courseModel.findOne({ slug: req.params.slug, Instructor: req.id });
        if (!course) return res.status(404).json({ message: "Course not found" });

        const { Title, Description, category, totalDuration, level, price, slug, isPublished } = req.body;
        if (Title) course.Title = Title;
        if (Description) course.Description = Description;
        if (category) course.category = category;
        if (totalDuration) course.totalDuration = totalDuration;
        if (level) course.level = level;
        if (price !== undefined) course.price = parseFloat(price) || 0;
        if (slug) course.slug = slug;
        if (isPublished !== undefined) course.isPublished = isPublished === "on";

        if (req.files?.image?.[0]) course.image = `/uploads/${req.files.image[0].filename}`;

        if (req.body.lessons) {
            const uploadedFiles = req.files?.lessonFiles || [];
            const lessonsFromForm = Object.values(req.body.lessons);
            let fileCounter = 0;
            const updatedLessons = [];

            for (let i = 0; i < lessonsFromForm.length; i++) {
                const lesson = lessonsFromForm[i];
                let filePath = "";
                if (!lesson.existingFile || lesson.existingFile === "") {
                    if (fileCounter < uploadedFiles.length) {
                        filePath = `/uploads/${uploadedFiles[fileCounter].filename}`;
                        fileCounter++;
                    }
                } else {
                    filePath = lesson.existingFile;
                }
                updatedLessons.push({
                    name: lesson.name || "",
                    type: lesson.type || "video",
                    duration: lesson.duration || "",
                    level: lesson.level || "beginner",
                    file: filePath
                });
            }
            course.lessons = updatedLessons;
        }

        await course.save();

        if (req.xhr || req.headers.accept?.includes("application/json")) {
            return res.json({ success: true, course });
        }
        return res.redirect("/teacherDashboard/get");

    } catch (err) {
        console.error("editCourse error:", err);
        return res.status(500).json({ message: "Internal server error: " + err.message });
    }
};

// get edit course page (only for the instructor who created it)
const getEditCoursePage = async (req, res) => {
    try {
        const course = await courseModel.findOne({ slug: req.params.slug });
        if (!course) return res.send("Course not found");
        res.render("auth/editCourse", { course });
    } catch (err) {
        console.error(err);
        res.send("Error loading edit page");
    }
};

// get course lessons by level (for students)
const getLessonsByLevel = async (req, res) => {
    try {
        const { courseId, level } = req.params;
        const course = await courseModel.findById(courseId);
        const lessons = course.lessons.filter(l => l.level === level);
        res.render("auth/courseLessons", { course, lessons, level });
    } catch (error) {
        res.send(error.message);
    }
};

// delete course (only for the instructor who created it)
const deleteCourse = async (req, res) => {
    try {
        const course = await courseModel.findOne({ slug: req.params.slug, Instructor: req.id });
        if (!course) return res.status(404).json({ message: "Course not found" });
        if (course.Instructor.toString() !== req.id) return res.status(403).json({ message: "Not authorized" });
        await course.deleteOne();
        return res.status(200).json({ message: "Course deleted successfully" });
    } catch (err) {
        return res.status(500).json({ message: "Internal server error" });
    }
};

//get course learn page (with placement quiz logic)
const getCourseLearnPage = async (req, res) => {
    try {
        const course = await courseModel.findOne({ slug: req.params.slug });
        if (!course) return res.status(404).send("Course not found");

        const userId = req.id;
        let levelProgress = await levelProgressModel.findOne({ userId, courseId: course._id });

        if (!levelProgress || !levelProgress.placementCompleted) {
            return res.redirect(`/courses/course/${course.slug}`);
        }

        const lessonProgress = await progressModel.find({ userId, courseId: course._id, completed: true });
        const completedLessonIds = lessonProgress.map(p => p.lessonId.toString());
        // Check if all lessons of the current level are completed to determine if we show the quiz
        const currentLessons = course.lessons.filter(l => l.level === levelProgress.currentLevel);
        const allLessonsCompleted = currentLessons.every(lesson =>
            completedLessonIds.includes(lesson._id.toString())
        );

        const currentQuiz = course.quizzes?.find(
            q => q.quizType === "level" && q.level === levelProgress.currentLevel
        );
        const levelData = levelProgress.levels[levelProgress.currentLevel];
        const showQuiz = allLessonsCompleted && levelData && !levelData.quizPassed && currentQuiz;

        return res.render("auth/courseLearn", {
            course,
            currentLevel: levelProgress.currentLevel,
            currentLessons,
            completedLessonIds,
            allLessonsCompleted,
            showQuiz,
            quiz: currentQuiz || null,
            levelProgress,
            placementScore: levelProgress.placementScore
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading course");
    }
};

// Helper function to score a single question locally (without DB)

// SUBMIT PLACEMENT QUIZ 
// Returns JSON with { success, score, level, message } — displayed inline on course.ejs
const submitPlacementQuiz = async (req, res) => {
    try {
        const { courseId, quizId, answers } = req.body;
        const userId = req.id;

        const course = await courseModel.findById(courseId);
        if (!course) return res.status(404).json({ message: "Course not found" });

        // Find the placement quiz
        let placementQuiz = quizId ? course.quizzes.id(quizId) : null;
        if (!placementQuiz) placementQuiz = course.quizzes.find(q => q.quizType === "placement");
        if (!placementQuiz) return res.status(404).json({ message: "Placement quiz not found" });

        // Score all questions
        let score = 0;
        placementQuiz.questions.forEach((q, i) => {
            score += scoreQuestion(q, answers?.[i]);
        });

        const percentage = Math.round((score / placementQuiz.questions.length) * 100);

        // ── Save wrong answers as QuizMistakes ────────────────────────────────
        const mistakeDocs = [];
        placementQuiz.questions.forEach((q, i) => {
            const correct = scoreQuestion(q, answers?.[i]);
            if (!correct) {
                mistakeDocs.push({
                    userId,
                    courseId,
                    quizId:        placementQuiz._id,
                    quizType:      "placement",
                    level:         null,
                    questionIndex: i,
                    questionText:  q.question || `Question ${i + 1}`,
                    studentAnswer: answers?.[i],
                    correctAnswer: getCorrectAnswerDisplay(q),
                    topic:         extractTopic(q.question || "")
                });
            }
        });

        if (mistakeDocs.length > 0) {
            await QuizMistake.deleteMany({ userId, courseId, quizId: placementQuiz._id });
            await QuizMistake.insertMany(mistakeDocs);
        }
        
        // Determine level
        const determineLevel = (p) => {
            if (p >= 70) return "advanced";
            if (p >= 40) return "intermediate";
            return "beginner";
        };
        const level = determineLevel(percentage);

        // Find or create LevelProgress
        let levelProgress = await levelProgressModel.findOne({ userId, courseId });
        if (!levelProgress) {
            levelProgress = new levelProgressModel({
                userId,
                courseId,
                currentLevel: level,
                placementCompleted: true,
                placementScore: percentage,
                levels: {
                    beginner:     { quizPassed: false, quizAttempts: 0, lastScore: 0 },
                    intermediate: { quizPassed: false, quizAttempts: 0, lastScore: 0 },
                    advanced:     { quizPassed: false, quizAttempts: 0, lastScore: 0 }
                }
            });
        } else {
            levelProgress.currentLevel = level;
            levelProgress.placementCompleted = true;
            levelProgress.placementScore = percentage;
            if (!levelProgress.levels) levelProgress.levels = {};
            if (!levelProgress.levels[level]) {
                levelProgress.levels[level] = { quizPassed: false, quizAttempts: 0, lastScore: 0 };
            }
        }

        await levelProgress.save();

        const levelDescriptions = {
            beginner:     "You're just starting out. We'll build your foundation step by step.",
            intermediate: "Great foundation! You're ready for more challenging concepts.",
            advanced:     "Excellent knowledge! Jump straight into advanced topics."
        };

        return res.json({
            success: true,
            score: percentage,
            level,
            levelDescription: levelDescriptions[level],
            redirectUrl: `/courses/course/${course.slug}/learn`
        });

    } catch (error) {
        console.error("submitPlacementQuiz error:", error);
        return res.status(500).json({ message: error.message });
    }
};



// ADD / SAVE QUIZ (teacher creates quizzes from courseLessons.ejs)
const saveQuiz = async (req, res) => {
    try {
        const { slug } = req.params;
        const { title, quizType, level, passingScore, questions } = req.body;

        const course = await courseModel.findOne({ slug, Instructor: req.id });
        if (!course) return res.status(404).json({ message: "Course not found" });

        // Parse questions (supports all 4 types)
        const parsedQuestions = parseQuestions(Array.isArray(questions) ? questions : []);

        const newQuiz = {
            title: title || "Quiz",
            quizType: quizType || "level",
            passingScore: parseInt(passingScore) || 70,
            questions: parsedQuestions
        };

        if (quizType === "level") {
            newQuiz.level = level || "beginner";
        }

        course.quizzes.push(newQuiz);
        await course.save();

        const savedQuiz = course.quizzes[course.quizzes.length - 1];
        notifyNewQuiz(req.id, course, savedQuiz).catch(err => console.error("notifyNewQuiz error:", err));

        return res.json({ success: true, message: "Quiz saved successfully!" });

    } catch (err) {
        console.error("saveQuiz error:", err);
        return res.status(500).json({ message: err.message });
    }
};

//delete quiz (only for the instructor who created the course)
const deleteQuiz = async (req, res) => {
    try {
        const { slug, quizId } = req.params;
        const course = await courseModel.findOne({ slug, Instructor: req.id });
        if (!course) return res.status(404).json({ message: "Course not found" });

        course.quizzes = course.quizzes.filter(q => q._id.toString() !== quizId);
        await course.save();

        return res.json({ success: true, message: "Quiz deleted" });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

//get quiz for a level (called by frontend when student clicks "Take Quiz" after completing lessons)
const getLevelQuiz = async (req, res) => {
    try {
        const { courseId, level } = req.query;
        const userId = req.id;

        const course = await courseModel.findById(courseId);
        if (!course) return res.status(404).json({ message: "Course not found" });

        const normalizedLevel = level?.toLowerCase();

        const quiz = course.quizzes?.find(q =>
            q.quizType === "level" &&
            q.level?.toLowerCase() === normalizedLevel
        ) || null;

        const levelProgress = await levelProgressModel.findOne({ userId, courseId });

        const quizPassed = levelProgress?.levels?.[normalizedLevel]?.quizPassed || false;

        return res.json({
            success: true,
            quiz,
            quizPassed
        });

    } catch (err) {
        console.error("getLevelQuiz error:", err);
        return res.status(500).json({ message: err.message });
    }
};

// GET LESSONS FOR A LEVEL (called by frontend to load next level)
// GET /courses/api/level-lessons?courseId=&level=
const getLevelLessons = async (req, res) => {
    try {
        const { courseId, level } = req.query;
        const userId = req.id;

        const course = await courseModel.findById(courseId);
        if (!course) return res.status(404).json({ message: "Course not found" });

        // Filter lessons for this level
        const lessons = course.lessons.filter(l => l.level === level);

        // Find which ones the student already completed
        const progressRecords = await progressModel.find({
            userId,
            courseId,
            lessonId: { $in: lessons.map(l => l._id) },
            completed: true
        });
        const completedIds = progressRecords.map(p => p.lessonId.toString());

        return res.json({
            success: true,
            lessons,
            completedIds
        });

    } catch (err) {
        console.error("getLevelLessons error:", err);
        return res.status(500).json({ message: err.message });
    }
};
// rate course (students can rate a course from 1 to 5 stars, and update their rating)
const rateCourse = async (req, res) => {
    try {
        const { courseId, rating } = req.body;
        const userId = req.id;
        const numericRating = Number(rating);

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }

        if (!numericRating || numericRating < 1 || numericRating > 5) {
            return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
        }

        const course = await courseModel.findById(courseId);
        if (!course) {
            return res.status(404).json({ success: false, message: "Course not found" });
        }

        const existingIndex = course.rating.findIndex(r => String(r.userId) === String(userId));

        if (existingIndex !== -1) {
            course.rating[existingIndex].value = numericRating;
            course.rating[existingIndex].createdAt = new Date();
        } else {
            course.rating.push({
                userId,
                value: numericRating,
                createdAt: new Date()
            });
        }

        await course.save();

        return res.json({
            success: true,
            averageRating: course.averageRating,
            userRating: numericRating,
            ratingsCount: course.rating.length
        });

    } catch (error) {
        console.error("rateCourse error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

//get user's rating for a course (to show their existing rating when they revisit the course page)
const getUserRating = async (req, res) => {
    try {
        const { courseId } = req.params;
        const userId = req.id;

        const course = await courseModel.findById(courseId);
        if (!course) {
            return res.status(404).json({ success: false, message: "Course not found" });
        }

        const rating = course.rating.find(r => String(r.userId) === String(userId));

        return res.json({
            success: true,
            userRating: rating ? rating.value : 0,
            averageRating: course.averageRating || 0,
            ratingsCount: course.rating.length
        });

    } catch (error) {
        console.error("getUserRating error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
export {
    createCourse,
    getAllCourses,
    editCourse,
    deleteCourse,
    getCourseBySlug,
    getCourseLessonsPage,
    getCourseBySlugForStudent,
    getEditCoursePage,
    getLessonsByLevel,
    getCourseLearnPage,
    completeLesson,
    openLesson,
    submitPlacementQuiz,
    saveQuiz,
    deleteQuiz,
    getLevelQuiz,
    getLevelLessons,
    rateCourse,
    getUserRating
};