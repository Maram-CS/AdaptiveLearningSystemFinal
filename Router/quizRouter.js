import { submitQuiz , getQuizPage } from "../Controller/quizController.js";
import authRequest from "../middleware/authMiddleware.js";
import { Router } from "express";

const quizRouter = Router();

quizRouter.get("/course/:courseId/quiz/:quizId", authRequest, getQuizPage);

quizRouter.post("/submit", authRequest, submitQuiz);
export default quizRouter;