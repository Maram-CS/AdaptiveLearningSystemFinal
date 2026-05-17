import {Router} from 'express';


const publicRouter = Router();

publicRouter.get('/login', (req, res) => {
    res.render('auth/login');
});

publicRouter.get("/register",(req,res)=>{
    res.render("auth/register");
});

publicRouter.get("/home",(req,res)=>{
    res.render("auth/home");
});
publicRouter.get("/contact",(req,res)=>{
    res.render("auth/contactUs");
});

// forgot password & reset password
publicRouter.get("/forgot-password", (req,res)=>{
    res.render("auth/forgotPassword");
});

publicRouter.get("/reset-password/:token", (req,res)=>{
    res.render("auth/resetPassword", { token: req.params.token });
});

export default publicRouter;