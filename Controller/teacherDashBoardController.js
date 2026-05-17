import userModel from "../Model/userModel.js";
import courseModel from "../Model/courseModel.js";

// Get teacher dashboard data (courses, students, quizzes) for API endpoint
const getTeacherDashboard = async (req, res) => {
    try {
        const user = await userModel.findById(req.id);

        const totalCourses = await courseModel.countDocuments({ Instructor: req.id });

        const totalStudents = await userModel.countDocuments({ role: "student" });
        
        const courses = await courseModel.find({ Instructor: req.id });

        const totalQuizzes = courses.reduce((acc, course) => {
            return acc + (course.quizzes?.length || 0);
        }, 0);

        // Calculate average rating for each course
        const enrichedCourses = courses.map(course => {
            const ratingsCount = course.rating?.length || 0;

            const average = ratingsCount > 0
                ? course.rating.reduce((sum, r) => sum + r.value, 0) / ratingsCount
                : 0;

            return {
                ...course.toObject(),
                ratingsCount,
                averageRating: average.toFixed(1)
            };
         })
        .sort((a, b) => b.averageRating - a.averageRating);

        res.render("auth/teacherDashboard", {
            user,
            totalCourses,
            totalStudents,
            totalQuizzes,
            courses: enrichedCourses
        });

    } catch (error) {
        console.error("Error fetching teacher dashboard data:", error);
        res.status(500).send("Internal Server Error");
    }
};

export { getTeacherDashboard };