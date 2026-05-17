import { Schema, model } from "mongoose";

const notificationSchema = new Schema({
    studentId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    teacherId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: false
    },

    // Added "ai" to support AI Agent notifications
    type: {
        type: String,
        enum: ["course", "quiz", "info", "ai"],
        required: true
    },

    title:   String,
    message: String,
    emoji:   { type: String, default: "🤖" }, // New: for AI notifications

    relatedId: {
        type: Schema.Types.ObjectId,
        required: false
    },

    link: {
        type: String,
        required: false,
        default: ""
    },

    is_read: {
        type: Boolean,
        default: false
    },

    created_at: {
        type: Date,
        default: Date.now
    }
});

export default model("Notification", notificationSchema);