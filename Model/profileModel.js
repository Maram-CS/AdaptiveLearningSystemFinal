import { Schema,model } from "mongoose";

// profileSchema
const profileSchema = new Schema({
    user :  {
        type: Schema.Types.ObjectId,
        ref: "userModel",
        required: true,
        unique: true,
        },
    firstName : {
        type : String,
        required : true,
    },
    lastName : {
        type : String,
        required : true,     
    },
    userName : {
        type : String,
        required : false,
    },
    email : {
        type : String,
        required : true,
    },
    PhoneNumber : {
        type : String,
        required : false,
    },
    mainTrack : {
        type : String,
        required : false,
        enum: ['Web Development','Mobile Development','Frontend Development','Backend Development','Full Stack Development','DevOps','Cloud Computing','Other'],
    },
    skillLevel : {
        type : String,
        required : false,   
        enum: ['Beginner','Intermediate','Advanced','Expert'],
    },
    profilePicture : {
        type : String,
        required : false,
    },
    
    bio: {
    type: String,
    required: false,  
    },
},{timestamps: true}
);

const profileModel = model("profileModel",profileSchema);

export default profileModel;