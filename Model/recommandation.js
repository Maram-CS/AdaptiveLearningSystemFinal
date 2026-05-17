import mongoose from "mongoose";

// Stores every wrong answer a student gives, so we can generate smart recommendations
const quizMistakeSchema = new mongoose.Schema({
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User",   required: true },
    courseId:   { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    quizId:     { type: mongoose.Schema.Types.ObjectId,                required: true },
    quizType:   { type: String, enum: ["placement", "level"],          required: true },
    level:      { type: String, default: null }, // only for level quizzes

    // The question that was answered wrong
    questionIndex: { type: Number, required: true },
    questionText:  { type: String, required: true },

    // What the student submitted vs what was correct
    studentAnswer:  { type: mongoose.Schema.Types.Mixed },
    correctAnswer:  { type: mongoose.Schema.Types.Mixed },

    // Auto-extracted topic keyword from the question text
    topic: { type: String, default: "General" },

    createdAt: { type: Date, default: Date.now }
});

// Index for fast lookup per user+course
quizMistakeSchema.index({ userId: 1, courseId: 1 });

export default mongoose.model("QuizMistake", quizMistakeSchema);
