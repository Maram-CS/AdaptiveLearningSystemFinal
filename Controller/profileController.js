import profileModel from "../Model/profileModel.js";
import userModel from "../Model/userModel.js";
import authRequest from "../middleware/authMiddleware.js";


// create profile function
const createProfile = async (req, res,next) => {
    try {
        console.log(req.file);
        const { email, firstName, lastName, userName, PhoneNumber, mainTrack, skillLevel,bio } = req.body;
        const user = await userModel.findById(req.id);

        if(!user) return res.render("auth/createProfile",{error: "User not found. Please create an account first."});
        const existingProfile = await profileModel.findOne({user: req.id});
        if(existingProfile) return res.render("auth/createProfile",{error: "Profile already exists" });

        const profilePicturePath = req.file ? req.file.path : undefined;

        const profile = new profileModel({
            user: user._id,
            email,
            firstName,
            lastName,
            userName,
            PhoneNumber,
            mainTrack,
            skillLevel,
            bio,
            profilePicture: profilePicturePath
        });

        await profile.save();

        if(req.role === "teacher") {
            return res.render("auth/viewProfileTeacher", { profile });
          } else {
            return res.render("auth/Profile-view",{profile});
          }
          
    } catch(err) {
        console.error("CREATE PROFILE ERROR:", err.message);
        console.error("STACK:", err.stack);
        res.status(500).send("Error: " + err.message);
    }
};

// edit profile function
const editProfile = async (req, res,next) => {
    try {
        const { email, firstName, lastName, userName, PhoneNumber, mainTrack, skillLevel,bio } = req.body;
        const profile = await profileModel.findOne({user: req.id});
        if(!profile) return res.render("auth/editProfile",{error: "Profile not found. Please create a profile first."});

        if(req.file) {
            profile.profilePicture = req.file.path;
        }
        profile.email = email;
        profile.firstName = firstName;
        profile.lastName = lastName;
        profile.userName = userName;
        profile.PhoneNumber = PhoneNumber;
        profile.mainTrack = mainTrack;
        profile.skillLevel = skillLevel;
        profile.bio = bio;

        await profile.save();
        if(req.role === "teacher") {
            return res.render("auth/viewProfileTeacher", { profile });
          } else {
            return res.render("auth/Profile-view", { profile });
          }
        
    } catch(err) {
        console.error("EDIT PROFILE ERROR:", err.message);
        console.error("STACK:", err.stack);
        res.status(500).send("Error: " + err.message);
    }
};

// view profile function
const viewProfile = async (req, res) => {
    try {
        const profile = await profileModel.findOne({ user: req.id });

        if (!profile) {
            if (req.role === "teacher") {
                return res.render("auth/createProfileTeacher", { error: null });
            } else {      
                return res.render("auth/createProfile", { error: null });
            }
        }
        if (req.role === "teacher") {
            return res.render("auth/viewProfileTeacher", { profile });
        } else {
            return res.render("auth/Profile-view", { profile });
        }

    } catch (err) {
        console.error("VIEW PROFILE ERROR:", err.message);
        res.status(500).send("Error: " + err.message);
    }
};


export { createProfile, editProfile, viewProfile };