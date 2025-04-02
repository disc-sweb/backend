const express = require('express');
const courseController = require('../controllers/courseController');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

//Handle multipart form data
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ dest: 'uploads/' });

router.post(
  '/upload',
  upload.single('videoFile'),
  authMiddleware,
  courseController.courseUpload
);
router.get('/:courseId', authMiddleware, courseController.getCourse);
router.get('/', courseController.getAllCourses);
router.put(
  '/:courseId',
  upload.single('videoFile'),
  authMiddleware,
  courseController.editCourse
);
router.delete('/:courseId', authMiddleware, courseController.deleteCourse);
router.post('/purchaseCourse', courseController.purchaseCourse);
router.post('/getUserCourses', courseController.getUserCourses);

module.exports = router;
