import userModel from "../Model/userModel.js";
import progressModel from "../Model/Progress.js";
import courseModel from "../Model/courseModel.js";
import levelProgressModel from "../Model/progressLevelModel.js";
import QuizMistake from "../Model/recommandation.js";
import { buildRecommendations } from "../utils/topicExtractor.js";
import {
    calculateCurrentStreak,
    calculateQuizAverage,
    calculateCourseProgressPercent,
    calculateTimeSpentMinutes,
    formatMinutesAsHoursAndMinutes,
    parseDurationToMinutes
} from "../utils/learningStats.js";

// Get student dashboard data (courses, progress, stats) for API endpoint
const getStudentDashboardData = async (req, res) => {
    try {
        const userId = req.params.userId || req.id;
        if (!userId) {
            return res.status(400).json({ success: false, message: "User ID is required" });
        }

        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const allProgress = await progressModel.find({ userId }).sort({ lastUpdated: -1 });
        const completedLessons = allProgress.filter(progress => progress.completed).length;

        const coursesMap = new Map();
        allProgress.forEach(progress => {
            const courseKey = String(progress.courseId);
            if (!coursesMap.has(courseKey)) {
                coursesMap.set(courseKey, []);
            }
            coursesMap.get(courseKey).push(progress);
        });

        const courseIds = [...coursesMap.keys()];
        const courseDocs = await courseModel.find({ _id: { $in: courseIds } });
        const courseById = new Map(courseDocs.map(course => [String(course._id), course]));
        const levelProgressDocs = await levelProgressModel.find({ userId });

        const courses = [...coursesMap.entries()].map(([courseId, progressEntries]) => {
            const course = courseById.get(courseId);
            const latestProgress = progressEntries[0];
            const latestLesson = course?.lessons?.find(
                lesson => String(lesson._id) === String(latestProgress?.lessonId)
            );

            return {
                id: courseId,
                title: course?.Title || "Course",
                icon: "fas fa-book",
                overallProgress: calculateCourseProgressPercent(course, progressEntries),
                lastLesson: latestLesson?.name || course?.lessons?.[0]?.name || "Lesson",
                lastLessonTime: parseDurationToMinutes(latestLesson?.duration || ""),
                lessons: progressEntries.map(progress => {
                    const lessonDoc = course?.lessons?.find(
                        lesson => String(lesson._id) === String(progress.lessonId)
                    );

                    return {
                        title: lessonDoc?.name || "Lesson",
                        progress: Number(progress.progress || 0),
                        completed: Boolean(progress.completed),
                        icon: progress.completed
                            ? "fas fa-check-circle"
                            : (progress.progress > 0 ? "fas fa-play-circle" : "fas fa-lock")
                    };
                })
            };
        });

        const totalLessonsCount = courseDocs.reduce(
            (sum, course) => sum + (course.lessons?.length || 0),
            0
        );

        const avgProgress = courseDocs.length > 0
            ? Math.round(
                courseDocs.reduce((sum, course) => {
                    const courseProgress = allProgress.filter(
                        progress => String(progress.courseId) === String(course._id)
                    );
                    return sum + calculateCourseProgressPercent(course, courseProgress);
                }, 0) / courseDocs.length
            )
            : 0;

        const totalLearningMinutesValue = courseDocs.reduce((sum, course) => {
            const courseProgress = allProgress.filter(
                progress => String(progress.courseId) === String(course._id)
            );
            return sum + calculateTimeSpentMinutes(course, courseProgress);
        }, 0);
        const totalLearningTime = formatMinutesAsHoursAndMinutes(totalLearningMinutesValue);

        const userData = {
            firstName: user.userName,
            // Keep day-based streak (existing logic)
            streakDays: calculateCurrentStreak(allProgress),
            // New click counter (increments on EVERY “View Lesson” click)
            lessonOpenClicks: Number(user.lessonOpenClicks || 0),
            totalLearningHours: totalLearningTime.hours,
            totalLearningMinutes: totalLearningTime.minutes,
            totalLearningDisplay: totalLearningTime.hours > 0
                ? `${totalLearningTime.hours}h ${totalLearningTime.minutes}m`
                : `${totalLearningTime.minutes}m`,
            quizAverage: calculateQuizAverage(levelProgressDocs)
        };

        // Ensure new counter exists even for old users
        userData.lessonOpenClicks = Number(user.lessonOpenClicks || 0);

        return res.json({
            success: true,
            userData,
            courses,
            completedLessons,
            totalLessons: totalLessonsCount,
            avgProgress
        });
    } catch (error) {
        console.error("Dashboard API Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

// get smart recommendations based on user's quiz mistakes for API endpoint
const getSmartRecommendations = async (req, res) => {
    try {
        const userId = req.id;
        const mistakes = await QuizMistake.find({ userId }).sort({ createdAt: -1 }).lean();

        if (mistakes.length === 0) {
            return res.json({
                success: true,
                recommendations: [
                    {
                        topic: "Keep Going!",
                        icon: "fas fa-rocket",
                        message: "Complete a quiz to get personalised recommendations.",
                        count: 0
                    }
                ]
            });
        }

        return res.json({
            success: true,
            recommendations: buildRecommendations(mistakes, 3)
        });
    } catch (error) {
        console.error("Recommendations API Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

// get leaderboard data for API endpoint
const getLeaderboardData = async (req, res) => {
    try {
        const users = await userModel.find({}, "userName");

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const leaderboardData = await progressModel.aggregate([
            { $match: { lastUpdated: { $gte: oneWeekAgo } } },
            { $group: { _id: "$userId", totalPoints: { $sum: "$pointsEarned" } } },
            { $sort: { totalPoints: -1 } },
            { $limit: 5 }
        ]);

        const leaderboard = leaderboardData.map((item, index) => {
            const user = users.find(entry => entry._id.toString() === item._id.toString());
            return {
                name: user ? user.userName : "Unknown",
                points: item.totalPoints,
                badge: index === 0 ? "🔥" : index === 1 ? "⭐" : index === 2 ? "📈" : "",
                isCurrentUser: String(item._id) === String(req.id)
            };
        });

        return res.json({ success: true, leaderboard });
    } catch (error) {
        console.error("Leaderboard API Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

//get student dashboard page (renders the dashboard template, which then calls the above APIs to populate data)
const getStudentDashboard = async (req, res) => {
    try {
        const user = await userModel.findById(req.id);
        return res.render("auth/studentDashboard", { userId: user ? user._id.toString() : null });
    } catch (error) {
        console.error("Error rendering dashboard:", error);
        return res.render("auth/studentDashboard", { userId: null });
    }
};

// get lessons for a course filtered by user's current level (used when student clicks on a course to see its lessons)
const studentCourseLessons = async (req, res) => {
    try {
        const course = await courseModel.findById(req.params.courseId);
        if (!course) return res.send("Course not found");

        const user = await userModel.findById(req.id);
        const userLevel = user?.level || "beginner";
        const lessons = course.lessons.filter(lesson => lesson.level === userLevel);

        return res.render("auth/studentCourseLessons", {
            course,
            lessons,
            userLevel
        });
    } catch (error) {
        return res.status(500).send(error.message);
    }
};

export {
    getStudentDashboardData,
    getSmartRecommendations,
    getLeaderboardData,
    getStudentDashboard,
    studentCourseLessons
};