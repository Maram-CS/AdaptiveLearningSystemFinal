import userModel from "../Model/userModel.js";
import Notification from "../Model/notificationModel.js";

// Notify students of new course added by a teacher
const notifyNewCourse = async (teacherId, course) => {
    try {

        const teacher = await userModel.findById(teacherId);

        const students = await userModel.find({ role: "student" });

        const notifications = students.map(student => ({
            studentId: student._id,
            teacherId: teacherId,
            type: "course",
            title: "New Course 📘",
            message: `Professor ${teacher.userName} added a new course: "${course.Title}"`,
            relatedId: course._id,
            link: `/courses/course/${course.slug || course._id}`
        }));

        await Notification.insertMany(notifications);

    } catch (err) {
        console.log(err);
    }
};

const notifyNewQuiz = async (teacherId, course, quiz) => {
    try {
        const teacher = await userModel.findById(teacherId);
        const students = await userModel.find({ role: "student" });

        const quizLabel = quiz.quizType === "placement"
            ? "Placement quiz"
            : `Level ${quiz.level || "quiz"}`;

        const notifications = students.map(student => ({
            studentId: student._id,
            teacherId: teacherId,
            type: "quiz",
            title: `New Quiz Available 🎯`,
            message: `Professor ${teacher.userName} added a new ${quizLabel} in "${course.Title}".`,
            relatedId: quiz._id,
            link: `/quiz/course/${course._id}/quiz/${quiz._id}`
        }));

        await Notification.insertMany(notifications);

    } catch (err) {
        console.log(err);
    }
};

export { notifyNewCourse, notifyNewQuiz };