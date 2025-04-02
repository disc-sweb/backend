const express = require('express');
const videoController = require('../controllers/videoController');
const router = express.Router();

//Handle multipart form data
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/upload', upload.single('videoFile'), videoController.videoUpload);
router.get('/:videoId', videoController.getVideo);
router.put('/:videoId', upload.single('videoFile'), videoController.editVideo);
router.delete('/:videoId', videoController.deleteVideo);

module.exports = router;
