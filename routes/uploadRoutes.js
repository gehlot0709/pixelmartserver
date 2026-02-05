const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');

router.post('/', upload.single('image'), (req, res) => {
    // When using Cloudinary storage, req.file.path is the full URL
    res.send(req.file.path);
});

module.exports = router;
