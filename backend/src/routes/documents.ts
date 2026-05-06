import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, requireAdmin } from '../auth/rbac';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import { Document, DocumentCategory } from '../models/Document';
import { Staff } from '../models/Staff';

const router = express.Router();

// Set up multer for document file uploads
const uploadDir = './uploads/documents';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-z0-9_-]/gi, '_')
      .substring(0, 80);
    cb(null, `doc-${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// Auto-detect category from file extension
function detectCategory(filename: string): DocumentCategory {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (['.ppt', '.pptx', '.key'].includes(ext)) return 'presentation';
  if (['.xls', '.xlsx', '.csv', '.numbers'].includes(ext)) return 'spreadsheet';
  if (['.mp4', '.mov', '.avi', '.webm', '.mkv'].includes(ext)) return 'video';
  return 'other';
}

// Shared include for queries
const staffInclude = [{ model: Staff, as: 'uploadedBy', attributes: ['id', 'fullName', 'email'] }];

router.use(requireAuth);

// GET /api/documents
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { cohort, category } = req.query as Record<string, string | undefined>;
    const where: Record<string, any> = { isVisible: true };
    if (cohort) where.cohort = cohort;
    if (category) where.category = category;

    const documents = await Document.findAll({
      where,
      include: staffInclude,
      order: [['createdAt', 'DESC']],
    });

    res.json({ data: documents });
  })
);

// POST /api/documents — create a link document (admin only)
router.post(
  '/',
  requireAdmin,
  validate(z.object({
    body: z.object({
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      url: z.string().url('Must be a valid URL'),
      category: z.enum(['presentation', 'pdf', 'spreadsheet', 'video', 'link', 'other']).optional(),
      cohort: z.string().optional(),
    }),
  })),
  asyncHandler(async (req: any, res) => {
    const { title, description, url, category = 'link', cohort } = req.body;
    const staffId = req.user?.id;
    if (!staffId) return res.status(401).json({ error: 'Unauthorized' });

    const doc = await Document.create({
      title,
      description,
      url,
      category,
      sourceType: 'link',
      cohort: cohort || undefined,
      uploadedByStaffId: staffId,
      isVisible: true,
    });

    const result = await Document.findByPk(doc.id, { include: staffInclude });
    res.status(201).json(result);
  })
);

// POST /api/documents/upload — upload a file (admin only)
router.post(
  '/upload',
  requireAdmin,
  upload.single('file'),
  asyncHandler(async (req: any, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const staffId = req.user?.id;
    if (!staffId) return res.status(401).json({ error: 'Unauthorized' });

    const { title, description, cohort, category: rawCategory } = req.body;
    const originalName = req.file.originalname;
    const detectedCategory = detectCategory(originalName);
    const category: DocumentCategory = rawCategory || detectedCategory;
    const fileUrl = `/uploads/documents/${req.file.filename}`;

    const doc = await Document.create({
      title: title?.trim() || path.basename(originalName, path.extname(originalName)),
      description: description?.trim() || undefined,
      url: fileUrl,
      category,
      sourceType: 'upload',
      fileName: originalName,
      fileSize: req.file.size,
      cohort: cohort?.trim() || undefined,
      uploadedByStaffId: staffId,
      isVisible: true,
    });

    const result = await Document.findByPk(doc.id, { include: staffInclude });
    res.status(201).json(result);
  })
);

// PATCH /api/documents/:id — update metadata (admin only)
router.patch(
  '/:id',
  requireAdmin,
  validate(z.object({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
      title: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      url: z.string().url('Must be a valid URL').optional(),
      category: z.enum(['presentation', 'pdf', 'spreadsheet', 'video', 'link', 'other']).optional(),
      cohort: z.string().optional(),
      isVisible: z.boolean().optional(),
    }),
  })),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const doc = await Document.findByPk(id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    await doc.update(req.body);
    const updated = await Document.findByPk(id, { include: staffInclude });
    res.json(updated);
  })
);

// DELETE /api/documents/:id — delete document + file (admin only)
router.delete(
  '/:id',
  requireAdmin,
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const doc = await Document.findByPk(id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Delete physical file if it was an upload
    if (doc.sourceType === 'upload' && doc.url) {
      const filePath = path.join(process.cwd(), doc.url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await doc.destroy();
    res.json({ message: 'Document deleted successfully' });
  })
);

export default router;
