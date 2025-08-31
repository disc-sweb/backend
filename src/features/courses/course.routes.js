const express = require('express');
const router = express.Router();
const { createCourse, getCourseById, updateCourse, deleteCourse } = require('./course.service');

router.post('/', createCourse);
router.get('/:id', getCourseById);
router.put('/:id', updateCourse);
router.delete('/:id', deleteCourse);

module.exports = router;
