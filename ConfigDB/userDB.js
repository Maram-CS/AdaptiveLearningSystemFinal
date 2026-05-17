import mongoose from "mongoose";

// Function to connect to the UserDB MongoDB database
const UserDB = async () => {
  try {
    await mongoose.connect(process.env.NAME_DB);
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.log("❌ Error connecting to UserDB:", err.message);
  }
};

export default UserDB;