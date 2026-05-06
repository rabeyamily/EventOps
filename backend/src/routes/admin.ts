import express from 'express';
import { requireAuth, requireAdmin } from '../auth/rbac';
import { asyncHandler } from '../middleware/errorHandler';
import { recalculateAllStudentStatuses } from '../utils/studentStatus';

const router = express.Router();

// All routes require admin authentication
router.use(requireAuth);
router.use(requireAdmin);

// POST /api/admin/recalculate-statuses - Recalculate all student statuses (maintenance)
router.post('/recalculate-statuses', asyncHandler(async (_req, res) => {
  await recalculateAllStudentStatuses();
  res.json({ 
    success: true, 
    message: 'All student statuses recalculated successfully' 
  });
}));

export default router;

