const mongoose = require('mongoose');

const fileEntrySchema = new mongoose.Schema({
    filename: {type: String, required: true, unique: true, trim: true},
    folderPath: {type: String, required: true}, 
    uploadDate: {type: Date, default: Date.now},

    processed: {type: Boolean, default: false},
    processedAt: {type: Date},

    // Track how many records were inserted from this file
    recordCount: {type: Number, default: 0}
}, {timestamps: true});

// Index for quick lookup of unprocessed files
fileEntrySchema.index({processed: 1, uploadDate: 1});

module.exports = mongoose.model('FileEntry', fileEntrySchema);
