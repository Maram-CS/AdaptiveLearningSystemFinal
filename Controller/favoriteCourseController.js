import courseModel from "../Model/courseModel.js";
import favoriteCourseModel from "../Model/favoriteCourseModel.js";

// get all favorite courses for logged-in user
const getAllCourses = async (req, res) => {
    try {
        const userId = req.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const favorites = await favoriteCourseModel.find({ userId }).select("courseId");
        const courseIds = favorites.map((f) => f.courseId);

        // Courses the user has favorite
        const favoriteCourses = courseIds.length
            ? await courseModel.find({ _id: { $in: courseIds }, isPublished: true })
            : [];

        // All published courses — needed so the favorites page can
        // look up full course objects by id (courseById map in the template)
        const allCourses = await courseModel.find({ isPublished: true });

        return res.render("auth/favoriteCourses", {
            courses: favoriteCourses,
            allCourses,                                  
            favoriteIds: courseIds.map(String),
        });
    } catch (err) {
        console.error("getAllCourses error:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// POST: toggle favorite for logged-in user
// body: { courseId }
const toggleFavorite = async (req, res) => {
    try {
        const userId = req.id;
        const { courseId } = req.body || {};

        if (!userId)   return res.status(401).json({ success: false, message: "Unauthorized" });
        if (!courseId) return res.status(400).json({ success: false, message: "courseId is required" });

        const courseExists = await courseModel.findById(courseId);
        if (!courseExists) return res.status(404).json({ success: false, message: "Course not found" });

        const existing = await favoriteCourseModel.findOne({ userId, courseId });

        if (existing) {
            await favoriteCourseModel.deleteOne({ _id: existing._id });
            return res.json({ success: true, isFavorite: false });
        }

        await favoriteCourseModel.create({ userId, courseId });
        return res.json({ success: true, isFavorite: true });
    } catch (err) {
        console.error("toggleFavorite error:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export { getAllCourses, toggleFavorite };