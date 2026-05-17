import express from "express";
import authRequest from "../middleware/authMiddleware.js";
import {
    getStudentDashboardData,
    getSmartRecommendations,   // ← NEW
    getStudentDashboard,
    getLeaderboardData,
    studentCourseLessons
} from "../Controller/studentDashboardController.js";

const studentDashboardRouter = express.Router();

studentDashboardRouter.get("/get",             authRequest, getStudentDashboardData);
studentDashboardRouter.get("/leaderboard",     authRequest, getLeaderboardData);
studentDashboardRouter.get("/recommendations", authRequest, getSmartRecommendations); // ← NEW
studentDashboardRouter.get("/",                authRequest, getStudentDashboard);
studentDashboardRouter.get("/course/:courseId",authRequest, studentCourseLessons);

export default studentDashboardRouter;
