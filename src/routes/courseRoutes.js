const express = require('express');
const courseController = require('../controllers/courseController');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');

// Use memory storage instead of disk storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 100MB limit
  },
});

const uploadCourseAssets = upload.fields([
  { name: 'videoFile', maxCount: 1 },
  { name: 'imageFile', maxCount: 1 },
]);

router.post(
  '/upload',
  authMiddleware,
  uploadCourseAssets,
  courseController.courseUpload
);
router.get('/:courseId', authMiddleware, courseController.getCourse);
router.get('/', authMiddleware, courseController.getAllCourses);
router.put(
  '/:courseId',
  authMiddleware,
  uploadCourseAssets,
  courseController.editCourse
);
router.delete('/:courseId', authMiddleware, courseController.deleteCourse);
router.post(
  '/purchaseCourse/:courseId',
  authMiddleware,
  courseController.purchaseCourse
);
router.post('/stripeWebhook', courseController.stripeWebhook);
router.post('/getUserCourses', courseController.getUserCourses);

module.exports = router;
