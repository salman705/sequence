// models/Room.js
const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true
  },
  players: [{
    type: String
  }],
  isCustom: {
    type: Boolean,
    default: false
  },
  empty: {
    type: Boolean,
    default: true
  },
  playersName:[{
    type: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('Room', RoomSchema);
