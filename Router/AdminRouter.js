import express from 'express';
import {
    getDashboardStats,
    getAllUsers,
    getSystemAnalytics,
    addUser,
    deleteUser
} from '../Controller/userController.js';

const router = express.Router();

router.get('/stats', getDashboardStats);
router.get('/users', getAllUsers);
router.post('/users', addUser);
router.delete('/users/:id', deleteUser);
router.get('/analytics', getSystemAnalytics);

export default router;