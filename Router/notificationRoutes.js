import { Router } from "express";
import authRequest from "../middleware/authMiddleware.js";
import Notification from "../Model/notificationModel.js";

const router = Router();

// njib notf mn database w n3awd nhotha f json
router.get("/api/notifications", authRequest, async (req, res) => {
    try {
        const notifications = await Notification.find({
            studentId: req.id
        }).sort({ created_at: -1 });

        res.json({
            success: true,
            notifications
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// mark as read
router.put("/api/notifications/:id/read", authRequest, async (req, res) => {
    await Notification.findOneAndUpdate(
        { _id: req.params.id, studentId: req.id },
        { is_read: true }
    );

    res.json({ success: true });
});

//supprimer notification
router.delete("/api/notifications/:id", authRequest, async (req, res) => {
    await Notification.findOneAndDelete({
        _id: req.params.id,
        studentId: req.id
    });

    res.json({ success: true });
});

// get unread notifications count
router.get("/api/notifications/unread-count", authRequest, async (req, res) => {
    const count = await Notification.countDocuments({
        studentId: req.id,
        is_read: false
    });

    res.json({
        success: true,
        unreadCount: count
    });
});
// mark all as read
router.put("/api/notifications/read-all", authRequest, async (req, res) => {
    try {

        await Notification.updateMany(
            { studentId: req.id, is_read: false },
            { $set: { is_read: true } }
        );

        res.json({
            success: true,
            message: "All notifications marked as read"
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

export default router;