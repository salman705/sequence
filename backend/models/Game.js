// models/Game.js
const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true
  },
  players: {
    player1: {
      socketId: String,
      name: String,
      hand: [Object],
      isTurn: { type: Boolean, default: true } // First player starts
    },
    player2: {
      socketId: String,
      name: String,
      hand: [Object],
      isTurn: { type: Boolean, default: false }
    },
    player3: {
      socketId: String,
      name: String,
      hand: [Object],
      isTurn: { type: Boolean, default: false }
    }
  },
  scores: {
    red: { type: Number, default: 0 },
    blue: { type: Number, default: 0 },
    green: { type: Number, default: 0 }
  },
  shuffledDeck: [Object],
  cards: [Object],
  protectedPatterns: [Array]
}, { timestamps: true });

module.exports = mongoose.model('Game', GameSchema);
