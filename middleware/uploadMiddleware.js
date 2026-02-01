const multer = require('multer');
const { storage } = require('../config/cloudinaryConfig');

// Init Upload
const upload = multer({
    storage: storage,
    limits: { fileSize: 5000000 }, // 5MB limit
});

module.exports = upload;
