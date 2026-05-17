import { Schema, model } from "mongoose";
import slugify from "slugify";

// Lesson Schema
const lessonSchema = new Schema({
    name: { type: String, required: true },
    level: {
        type: String,
        enum: ["beginner", "intermediate", "advanced"],
        default: "beginner"
    },
    type: {
        type: String,
        enum: ["video", "PDF"],
        default: "video"
    },
    duration: { type: String, required: true },
    file: { type: String, default: "" },
    videoUrl: { type: String, default: "" },
    content: { type: String, default: "" },
});

// Resource Schema
const resourceSchema = new Schema({
    name: { type: String, required: true },
    type: { type: String, required: true },
    link: { type: String, default: "#" },
    fileUrl: { type: String, default: "" }
});

// question Schema defines the structure for quiz questions, supporting multiple types of questions with different answer formats.
const questionSchema = new Schema({
    question: { type: String, required: true },

    questionType: {
        type: String,
        enum: ["multiple-choice", "true-false", "multi-select", "written"],
        default: "multiple-choice"
    },

    // Used by: multiple-choice, true-false, multi-select
    options: { type: [String], default: [] },

    // Used by: multiple-choice, true-false  → single correct index
    correctAnswer: { type: Number, default: null },

    // Used by: multi-select → array of correct indices
    correctAnswers: { type: [Number], default: [] },

    // Used by: written → the expected text answer
    correctAnswerText: { type: String, default: "" },
});

// quiz schema
const quizSchema = new Schema({
    title: { type: String, required: true },

    // "placement" = the level-test quiz (first quiz); others = level quizzes
    quizType: {
        type: String,
        enum: ["placement", "level"],
        default: "level"
    },

    level: {
        type: String,
        enum: ["beginner", "intermediate", "advanced"],
        required: false   // not required for placement quizzes
    },

    questions: [questionSchema],

    passingScore: { type: Number, default: 70 },

    createdAt: { type: Date, default: Date.now }
});

//Main Course Schema
const courseSchema = new Schema({
    Title: { type: String, required: true, trim: true },
    Description: { type: String, required: true },

    Instructor: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: false,
    },

    category: {
        type: String,
        required: true,
        enum: ["frontend", "backend", "database", "tools", "design", "deployment"],
    },

    image: { type: String, required: true },
    totalDuration: { type: String, default: "Coming soon" },

    level: {
        type: String,
        enum: ["beginner", "intermediate", "advanced"],
        default: "beginner"
    },

    price: { type: Number, default: 0 },

    averageRating: { type: Number, default: 0 },

    rating: [
        {
            userId: String,
            value: Number,
            createdAt: { type: Date, default: Date.now }
        }
    ],

    lessons: [lessonSchema],

    //All quizzes (placement + level)
    quizzes: [quizSchema],

    resources: [resourceSchema],

    enrolledStudents: [{ type: Schema.Types.ObjectId, ref: "User" }],

    isPublished: { type: Boolean, default: true },

    slug: {
        type: String,
        unique: true,
        required: false,
        lowercase: true,
        trim: true
    },

}, { timestamps: true });

// hook to calculate average rating before saving a course
courseSchema.pre("save", function () {
    if (this.rating.length === 0) {
        this.averageRating = 0;
    } else {
        const total = this.rating.reduce((acc, item) => acc + item.value, 0);
        this.averageRating = total / this.rating.length;
    }
});
// hook to generate slug from title if not provided
courseSchema.pre("save", function () {
    if (this.isModified("Title") && !this.slug) {
        this.slug = slugify(this.Title, { lower: true, strict: true });
    }
});

// Indexes
courseSchema.index({ Title: 1 });
courseSchema.index({ category: 1 });
courseSchema.index({ Instructor: 1 });
courseSchema.index({ isPublished: 1 });

const courseModel = model("course", courseSchema);
export default courseModel;