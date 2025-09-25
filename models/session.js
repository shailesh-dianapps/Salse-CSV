const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    token: {type: String, required: true},
    createdAt: {type: Date, default: Date.now, expires: '1d'} // auto-remove after 1 day
}, {timestamps: true});

sessionSchema.index({token: 1});

module.exports = mongoose.model('Session', sessionSchema);
