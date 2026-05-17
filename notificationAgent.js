import "./env.js";
import mongoose from "mongoose";
import Notification from "./Model/notificationModel.js";
import userModel from "./Model/userModel.js";
import progressLevelModel from "./Model/progressLevelModel.js";
import courseModel from "./Model/courseModel.js";
import Progress from "./Model/Progress.js";

function getLatestLevelScore(levels = {}) {
  const attemptedLevels = Object.values(levels).filter(
    (level) =>
      level &&
      Number.isFinite(level.lastScore) &&
      (level.quizAttempts ?? 0) > 0
  );

  if (attemptedLevels.length === 0) return null;

  attemptedLevels.sort((a, b) => {
    const aTime = a.lastAttemptAt ? new Date(a.lastAttemptAt).getTime() : 0;
    const bTime = b.lastAttemptAt ? new Date(b.lastAttemptAt).getTime() : 0;
    if (bTime !== aTime) return bTime - aTime;
    return (b.quizAttempts ?? 0) - (a.quizAttempts ?? 0);
  });

  return attemptedLevels[0].lastScore;
}

async function getRealLastScore(userId) {
  const latestProgress = await progressLevelModel
    .findOne({ userId })
    .sort({ updatedAt: -1 })
    .select("levels updatedAt courseId");

  if (!latestProgress) return null;
  return { score: getLatestLevelScore(latestProgress.levels), courseId: latestProgress.courseId };
}

async function getCourseAndLessonDetails(userId, courseId, lessonId = null) {
  try {
    if (!courseId) {
      return { courseName: "Unknown Course", lessonName: "Unknown Lesson" };
    }

    const course = await courseModel.findById(courseId).select("Title lessons");
    if (!course) {
      return { courseName: "Unknown Course", lessonName: "Unknown Lesson" };
    }

    let targetLessonId = lessonId;
    if (!targetLessonId) {
      const studentProgress = await Progress.findOne({ userId, courseId })
        .sort({ lastUpdated: -1 })
        .select("lessonId");
      targetLessonId = studentProgress?.lessonId;
    }

    let lessonName = "Unknown Lesson";
    if (targetLessonId && course.lessons) {
      const lesson = course.lessons.find(
        (l) => l._id.toString() === targetLessonId.toString()
      );
      if (lesson) {
        lessonName = lesson.name;
      }
    }

    return {
      courseName: course.Title || "Unknown Course",
      lessonName,
    };
  } catch (error) {
    console.error("Error fetching course/lesson details:", error);
    return { courseName: "Unknown Course", lessonName: "Unknown Lesson" };
  }
}

function getStudentStats(student) {
  const lastLogin = student.lastLogin ?? student.createdAt ?? new Date();
  const daysAbsent = Math.floor((Date.now() - new Date(lastLogin)) / 86400000);

  return {
    daysAbsent,
    pendingTasks: student.pendingTasks ?? 0,
    completedToday: student.completedToday ?? false,
    userName: student.userName,
  };
}

async function runAgentForStudent(student, stats, scoreData, courseDetails) {
  console.log(`Analyzing: ${student.userName}...`);

  const realScore = scoreData ? scoreData.score : null;
  const courseName = courseDetails.courseName;
  const lessonName = courseDetails.lessonName;

  if (realScore !== null && realScore < 50) {
    return {
      send: true,
      title: "Oops! Quiz attempt did not go well.",
      body: `Hi ${student.userName}, you scored ${realScore}% in the quiz for the lesson "${lessonName}" in the course "${courseName}". Let me help you review the tricky parts.`,
      emoji: "📖",
      reason: `Real score ${realScore}% (below 50%) in "${courseName}" - "${lessonName}".`,
    };
  } else if (stats.daysAbsent > 1) {
    return {
      send: true,
      title: `Hey ${student.userName}, we miss you!`,
      body: `You have not logged in for ${stats.daysAbsent} days. We have new lessons waiting for you in "${courseName}".`,
      emoji: "👋",
      reason: "Inactive for more than a week.",
    };
  } else if (realScore !== null && realScore < 60) {
    return {
      send: true,
      title: "Need help with your studies?",
      body: `Your last score was ${realScore}% in the quiz for "${lessonName}" in "${courseName}". Let's review it together!`,
      emoji: "💪",
      reason: `Real score ${realScore}% (below 60%) in "${courseName}" - "${lessonName}".`,
    };
  } else if (stats.pendingTasks > 2) {
    return {
      send: true,
      title: `You have ${stats.pendingTasks} pending tasks!`,
      body: `Time to catch up? I can help you plan your study session in "${courseName}".`,
      emoji: "🎯",
      reason: "Student has pending tasks.",
    };
  } else {
    return {
      send: false,
      title: "",
      body: "",
      emoji: "",
      reason: "Student is on track.",
    };
  }
}

async function runNotificationAgent() {
  console.log("Connecting to:", process.env.NAME_DB);
  await mongoose.connect(process.env.NAME_DB);
  console.log("Connected to MongoDB. Agent starting...");

  const students = await userModel.find({ role: "student" });
  console.log(`Found ${students.length} student(s) to analyze.`);

  let sent = 0;

  for (const student of students) {
    const stats = getStudentStats(student);
    const scoreData = await getRealLastScore(student._id);

    let courseDetails = { courseName: "Unknown Course", lessonName: "Unknown Lesson" };
    if (scoreData && scoreData.courseId) {
      courseDetails = await getCourseAndLessonDetails(student._id, scoreData.courseId);
    } else {
      const latestProgress = await Progress.findOne({ userId: student._id })
        .sort({ lastUpdated: -1 })
        .select("courseId lessonId");

      if (latestProgress?.courseId) {
        courseDetails = await getCourseAndLessonDetails(
          student._id,
          latestProgress.courseId,
          latestProgress.lessonId
        );
      }
    }

    const realScore = scoreData ? scoreData.score : null;
    console.log(
      `${student.userName} -> realScore: ${realScore}, course: ${courseDetails.courseName}, lesson: ${courseDetails.lessonName}, pendingTasks: ${stats.pendingTasks}, daysAbsent: ${stats.daysAbsent}`
    );

    const notif = await runAgentForStudent(student, stats, scoreData, courseDetails);

    if (notif.send) {
      await Notification.create({
        studentId: student._id,
        type: "ai",
        title: notif.title,
        message: notif.body,
        emoji: notif.emoji,
      });
      console.log(`Sent to ${student.userName}: ${notif.title}`);
      sent++;
    } else {
      console.log(`Skipped ${student.userName} - ${notif.reason}`);
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`Done! Sent: ${sent} | Skipped: ${students.length - sent}`);
  await mongoose.disconnect();
}

runNotificationAgent();