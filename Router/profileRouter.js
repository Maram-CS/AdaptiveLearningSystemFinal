import {Router} from "express";
import {createProfile,editProfile,viewProfile} from "../Controller/profileController.js";
import authRequest from "../middleware/authMiddleware.js";
import { upload } from "../ConfigDB/multerConfig.js";

const profileRouter = Router();
profileRouter.post("/create",authRequest, upload.single("profilePicture"), createProfile);
profileRouter.post("/edit", authRequest, upload.single("profilePicture"), editProfile);
profileRouter.get("/Profile-view", authRequest, viewProfile);
export default profileRouter;



