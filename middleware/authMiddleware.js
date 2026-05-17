import jwt from "jsonwebtoken";

const password = process.env.SECRET;
const authRequest = (req,res,next)=>{
   // Get token from cookies
   const token = req.cookies.token;

   if(!token){
      return res.status(401).json({message:"Unauthorized"});
   }

   try{

      const decoded = jwt.verify(token,password);

      req.id = decoded.id; // Attach the user ID to the request object for further use in controllers
      req.role = decoded.role; // Attach the user role to the request object for further use in controllers

      next();

   }catch(err){

      console.error(err);
      return res.status(401).json({message:"Invalid token"});

   }

}

export default authRequest;