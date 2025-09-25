const mongoose = require('mongoose');

const salesRecordSchema = new mongoose.Schema({
    region: {type: String, trim: true},
    country: {type: String, trim: true},
    itemType: {type: String, trim: true},
    salesChannel: {type: String, enum: ["Online", "Offline"], trim: true},
    orderPriority: {type: String, enum: ["L", "M", "H", "C"], trim: true},

    orderDate: {type: Date, required: true},
    orderId: {type: String, required: true, unique: true, index: true},
    shipDate: {type: Date},

    unitsSold: {type: Number, min: 0},
    unitPrice: {type: Number, min: 0},
    unitCost: {type: Number, min: 0},
    totalRevenue: {type: Number, min: 0},
    totalCost: {type: Number, min: 0},
    totalProfit: {type: Number},

    // reference to logged in user
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},

    // reference to file import (so you know which CSV it came from)
    file: {type: mongoose.Schema.Types.ObjectId, ref: 'FileEntry'}
}, {timestamps: true});

// Prevent duplicate records if same orderId exists
salesRecordSchema.index({orderId: 1, user: 1}, {unique: true});

module.exports = mongoose.model('SalesRecord', salesRecordSchema);
