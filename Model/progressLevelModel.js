import mongoose, { model } from "mongoose";

// progressLevelSchema
const levelProgressSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "course", required: true },
    currentLevel: {
        type: String,
        enum: ["beginner", "intermediate", "advanced", "completed"],
        default: "beginner"
    },
    placementCompleted: { type: Boolean, default: false }, 
    placementScore: { type: Number, default: 0 },           
    levels: {
        beginner: {
            quizPassed: { type: Boolean, default: false },
            quizAttempts: { type: Number, default: 0 },
            lastScore: { type: Number, default: 0 }
        },
        intermediate: {
            quizPassed: { type: Boolean, default: false },
            quizAttempts: { type: Number, default: 0 },
            lastScore: { type: Number, default: 0 }
        },
        advanced: {
            quizPassed: { type: Boolean, default: false },
            quizAttempts: { type: Number, default: 0 },
            lastScore: { type: Number, default: 0 }
        }
    },
    completedAt: { type: Date }
}, { timestamps: true });

const progressLevelModel = model("progressLevel",levelProgressSchema);
export default progressLevelModel;