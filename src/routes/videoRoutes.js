const express = require('express');
const videoController = require('../controllers/videoController');
const router = express.Router();

//Handle multipart form data
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/upload", upload.single('videoFile'), videoController.videoUpload);
router.get("/:videoId", videoController.getVideo);
router.put("/:videoId", videoController.editVideo);

module.exports = router;
