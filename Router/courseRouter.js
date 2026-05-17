import { Router } from "express";
import {
    getAllCourses, getCourseBySlug, createCourse, editCourse, deleteCourse,
    getCourseLessonsPage, getCourseBySlugForStudent, getEditCoursePage,
    getLessonsByLevel, getCourseLearnPage, completeLesson, openLesson,
    submitPlacementQuiz, saveQuiz, deleteQuiz, getLevelQuiz, getLevelLessons,
    rateCourse, getUserRating   // ⭐ إضافة جديدة
} from "../Controller/courseController.js";

import authRequest from "../middleware/authMiddleware.js";
import { roleRequest } from "../middleware/roleMiddleware.js";
import { upload } from "../ConfigDB/multerConfig.js";

const coursesRouter = Router();

const courseUpload = upload.fields([
    { name: "image", maxCount: 1 },
    { name: "lessonFiles", maxCount: 50 }
]);

// ── Public ─────────────────────────────────────────────────────────────
coursesRouter.get("/All",authRequest, getAllCourses);
coursesRouter.get("/getCourse/:slug", getCourseBySlug);

// ── Instructor ────────────────────────────────────────────────────────
coursesRouter.post("/create", authRequest, roleRequest, courseUpload, createCourse);
coursesRouter.post("/edit/:slug", authRequest, roleRequest, courseUpload, editCourse);
coursesRouter.post("/delete/:slug", authRequest, roleRequest, deleteCourse);

// Teacher: lesson management page
coursesRouter.get("/content/:slug", authRequest, roleRequest, getCourseLessonsPage);
coursesRouter.get("/edit/:slug", authRequest, roleRequest, getEditCoursePage);

// Teacher: quiz CRUD
coursesRouter.post("/content/:slug/quiz/save", authRequest, roleRequest, saveQuiz);
coursesRouter.delete("/content/:slug/quiz/:quizId", authRequest, roleRequest, deleteQuiz);

// ── Student ───────────────────────────────────────────────────────────
// View Details
coursesRouter.get("/course/:slug", authRequest, getCourseBySlugForStudent);
coursesRouter.get("/course/:slug/learn", authRequest, getCourseLearnPage);

// Lesson level filter
coursesRouter.get("/:courseId/lessons/:level", getLessonsByLevel);

// ── API endpoints ─────────────────────────────────────────────────────
coursesRouter.post("/api/complete-lesson", authRequest, completeLesson);
coursesRouter.post("/api/open-lesson", authRequest, openLesson);
coursesRouter.post("/api/submit-quiz", authRequest, submitPlacementQuiz);

coursesRouter.get("/api/level-quiz", authRequest, getLevelQuiz);
coursesRouter.get("/api/level-lessons", authRequest, getLevelLessons);

// ⭐⭐⭐ Rating System ⭐⭐⭐
coursesRouter.post("/api/rate", authRequest, rateCourse);
coursesRouter.get("/api/rating/:courseId", authRequest, getUserRating);

export default coursesRouter;
