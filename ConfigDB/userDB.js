import mongoose from "mongoose";

let isConnected = false;

const UserDB = async () => {
  if (isConnected) return;
  
  try {
    await mongoose.connect(process.env.NAME_DB, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.log("❌ Error connecting to UserDB:", err.message);
  }
};

export default UserDB;