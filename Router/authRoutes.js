import { forgotPassword, resetPassword } from "../Controller/authController.js";

RouterLogin.post('/forgot-password', forgotPassword);
RouterLogin.post('/reset-password', resetPassword);