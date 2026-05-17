// ============================================================


const express = require("express");
const router  = express.Router();
const mongoose = require("mongoose");

// ── Reuse your Student model (adjust path if needed) ──────────
const Student = mongoose.model("Student");

// ── GET: Show notification for logged-in student ──────────────
router.get("/notification", async (req, res) => {
  try {
    // Assumes you store student id in session (adjust to your auth)
    const studentId = req.session?.userId;
    if (!studentId) return res.redirect("/login");

    const student = await Student.findById(studentId);
    if (!student) return res.redirect("/login");

    const notif = student.notification;

    // Mark as seen
    if (notif && !notif.seen) {
      await Student.findByIdAndUpdate(studentId, {
        "notification.seen": true,
      });
    }

    res.render("notification", {
      studentName: student.name,
      notification: notif,
    });

  } catch (err) {
    console.error("Notification route error:", err.message);
    res.status(500).send("Something went wrong.");
  }
});

// ── GET API: Check if student has unseen notification ─────────
router.get("/api/notification/check", async (req, res) => {
  try {
    const studentId = req.session?.userId;
    if (!studentId) return res.json({ hasNotification: false });

    const student = await Student.findById(studentId);
    const hasNotification =
      student?.notification?.message && !student?.notification?.seen;

    res.json({
      hasNotification: !!hasNotification,
      title:   student?.notification?.title   || "",
      message: student?.notification?.message || "",
      emoji:   student?.notification?.emoji   || "",
    });
  } catch (err) {
    res.json({ hasNotification: false });
  }
});

module.exports = router;