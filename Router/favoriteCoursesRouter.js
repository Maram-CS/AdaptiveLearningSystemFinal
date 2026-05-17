import { Router } from "express";
import authRequest from "../middleware/authMiddleware.js";
import { getAllCourses, toggleFavorite } from "../Controller/favoriteCourseController.js";

const favoriteCoursesRouter = Router();

favoriteCoursesRouter.get("/All", authRequest, getAllCourses);
favoriteCoursesRouter.post("/toggle", authRequest, toggleFavorite);

export default favoriteCoursesRouter;
