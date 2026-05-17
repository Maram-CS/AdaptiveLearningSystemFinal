import courseModel from "../Model/courseModel.js";
import userModel from "../Model/userModel.js";
import levelProgressModel from "../Model/progressLevelModel.js";
import QuizMistake from "../Model/recommandation.js";        
import { extractTopic } from "../utils/topicExtractor.js";    

//Score a single question based on its type
function scoreQuestion(question, rawAnswer) {
    const type = question.questionType || "multiple-choice";
    // For multiple-choice and true-false, correctAnswer is the index of the correct option
    switch (type) {
        case "multiple-choice":
        case "true-false": {
            return parseInt(rawAnswer) === question.correctAnswer ? 1 : 0;
        }
        // For multi-select, correctAnswers is an array of indices
        case "multi-select": {
            const submitted = (Array.isArray(rawAnswer) ? rawAnswer : [rawAnswer])
                .map(Number)
                .sort();
            const correct = [...(question.correctAnswers || [])].sort();
            if (submitted.length !== correct.length) return 0;
            return submitted.every((v, i) => v === correct[i]) ? 1 : 0;
        }
        // For written, correctAnswerText is the expected answer text
        case "written": {
            const expected = (question.correctAnswerText || "").trim().toLowerCase();
            const given = (rawAnswer || "").toString().trim().toLowerCase();
            return given === expected ? 1 : 0;
        }
        default:
            return 0;
    }
}

// get the display text for the correct answer based on question type (used for showing correct answers in recommendations)
function getCorrectAnswerDisplay(question) {
    const type = question.questionType || "multiple-choice";
    if (type === "written") return question.correctAnswerText || "";
    if (type === "multi-select") return question.correctAnswers?.join(", ") || "";
    // multiple-choice / true-false → return the option text
    const idx = question.correctAnswer ?? 0;
    return question.options?.[idx] ?? String(idx);
}

//save the user's mistakes for a quiz attempt, which will be used for generating smart recommendations later
async function saveMistakes({ userId, courseId, quizId, quizType, level, quiz, answers }) {
    const mistakeDocs = [];

    quiz.questions.forEach((q, i) => {
        const correct = scoreQuestion(q, answers[i]);
        if (!correct) {
            mistakeDocs.push({
                userId,
                courseId,
                quizId,
                quizType,
                level: level || null,
                questionIndex: i,
                questionText: q.question || `Question ${i + 1}`,
                studentAnswer: answers[i],
                correctAnswer: getCorrectAnswerDisplay(q),
                topic: extractTopic(q.question || "")
            });
        }
    });

    if (mistakeDocs.length > 0) {
        // Delete old mistakes for this exact quiz attempt before saving new ones
        await QuizMistake.deleteMany({ userId, courseId, quizId });
        await QuizMistake.insertMany(mistakeDocs);
    }
}

// submit quiz answers, calculate score, update progress, and return result with personalized message
const submitQuiz = async (req, res) => {
    try {
        const { courseId, quizId, answers, level } = req.body;
        const userId = req.id;

        const course = await courseModel.findById(courseId);
        if (!course) return res.status(404).json({ message: "Course not found" });

        const quiz = course.quizzes.id(quizId);
        if (!quiz) return res.status(404).json({ message: "Quiz not found" });

        // Score every question
        let score = 0;
        quiz.questions.forEach((q, i) => {
            score += scoreQuestion(q, answers[i]);
        });

        const percentage = Math.round((score / quiz.questions.length) * 100);
        const passingScore = quiz.passingScore || 70;
        const passed = percentage >= passingScore;

        // ── Save mistakes for smart recommendations ──────────────────────────
        await saveMistakes({
            userId,
            courseId,
            quizId,
            quizType: "level",
            level: level || null,
            quiz,
            answers
        });

        // Update LevelProgress
        let levelProgress = await levelProgressModel.findOne({ userId, courseId });
        if (!levelProgress) {
            levelProgress = await levelProgressModel.create({
                userId,
                courseId,
                currentLevel: level || "beginner"
            });
        }

        const levelKey = level || levelProgress.currentLevel;
        const levelData = levelProgress.levels[levelKey];
        if (levelData) {
            levelData.quizPassed = passed;
            levelData.lastScore = percentage;
            levelData.quizAttempts += 1;
        }

        let nextLevel = null;
        let message = "";

        if (passed) {
            const levels = ["beginner", "intermediate", "advanced"];
            const currentIndex = levels.indexOf(levelKey);

            if (currentIndex < levels.length - 1) {
                nextLevel = levels[currentIndex + 1];
                levelProgress.currentLevel = nextLevel;
                message = `🎉 Congratulations! Score: ${percentage}%. You advance to ${nextLevel.toUpperCase()}!`;
            } else {
                levelProgress.currentLevel = "completed";
                levelProgress.completedAt = new Date();
                message = `🎓 BRAVO! You completed the course with ${percentage}%! 🎓`;
            }
        } else {
            message = `❌ Score: ${percentage}%. Review the lessons and try again! (Minimum: ${passingScore}%)`;
        }

        await levelProgress.save();
        await userModel.findByIdAndUpdate(userId, { level: levelProgress.currentLevel });

        return res.json({
            success: true,
            passed,
            percentage,
            nextLevel,
            currentLevel: levelProgress.currentLevel,
            message,
            needsRetry: !passed
        });

    } catch (error) {
        console.error("submitQuiz error:", error);
        return res.status(500).json({ message: error.message });
    }
};

// get quiz page with quiz data (used for rendering the quiz page when a student clicks "Take Quiz")
const getQuizPage = async (req, res) => {
    try {
        const { courseId, quizId } = req.params;
        const course = await courseModel.findById(courseId);
        if (!course) return res.send("Course not found");
        const quiz = course.quizzes.id(quizId);
        if (!quiz) return res.send("Quiz not found");
        res.render("auth/quiz", { courseId, quiz });
    } catch (error) {
        res.status(500).send(error.message);
    }
};

export { submitQuiz, getQuizPage, scoreQuestion, getCorrectAnswerDisplay };