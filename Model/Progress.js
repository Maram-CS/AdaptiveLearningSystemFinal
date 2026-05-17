import mongoose from "mongoose";

// progressSchema
const progressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  lessonId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  progress: {
    type: Number,
    default: 0,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  pointsEarned: {
    type: Number,
    default: 0,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

// Middleware to update lastUpdated on every save
progressSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
});

// Middleware to update lastUpdated on findByIdAndUpdate and similar operations
progressSchema.pre('findOneAndUpdate', function() {
  this.set({ lastUpdated: new Date() });
});

progressSchema.pre('updateOne', function() {
  this.set({ lastUpdated: new Date() });
});

progressSchema.pre('updateMany', function() {
  this.set({ lastUpdated: new Date() });
});

export default mongoose.model("Progress", progressSchema);
