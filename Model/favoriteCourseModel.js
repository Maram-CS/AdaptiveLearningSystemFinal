import { Schema, model } from "mongoose";
// favoriteCourseSchema
const favoriteCourseSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicates per user
favoriteCourseSchema.index({ userId: 1, courseId: 1 }, { unique: true });// This compound index ensures that a user cannot favorite the same course more than once, maintaining data integrity and optimizing query performance when checking for existing favorites.

const favoriteCourseModel = model(
  "FavoriteCourse",
  favoriteCourseSchema
);

export default favoriteCourseModel;

