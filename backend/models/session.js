const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    roomId: String,
    playingAs: String,
    expiresAt: { type: Date, expires: '2h' },  // Sessions expire after 2 hours
}, { timestamps: true });


module.exports = mongoose.model('Session', sessionSchema);

