import { Router } from "express";
import {addUser,deleteUser}from "../Controller/userController.js";
import {loginUser} from "../Controller/authController.js";
import { forgotPassword, resetPassword } from "../Controller/authController.js";

const RouterLogin = Router();
RouterLogin.post('/login', loginUser);
RouterLogin.post('/register', addUser);
RouterLogin.post('/delete',deleteUser);

// forgot password & reset password
RouterLogin.post('/forgot-password', forgotPassword);
RouterLogin.post('/reset-password', resetPassword);

export default RouterLogin;