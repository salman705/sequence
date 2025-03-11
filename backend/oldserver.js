const express = require('express');
const mongoose = require("mongoose");
const { createServer } = require('http');
const { Server } = require('socket.io');
const allCards = require('./data/allCards.js');
//const jackCards = require('./data/jackCards.js'); for testing
const gameController = require('./controllers/gameController');
const RoomController = require('./controllers/roomController');
const app = express();
const httpServer = createServer(app);
//const allUsers = {};

let filteredCards = allCards.filter(card => card.id <= 100);
let cards = JSON.parse(JSON.stringify(filteredCards));
//let game = gameController.initializeGame(allCards);

require('dotenv').config(); 
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ["GET","POST","OPTIONS"]
    }
});

const gamesByRoomId = {};
new RoomController(io, gamesByRoomId, initializeGameForRoom, startGameForRoom);

// MongoDB connection
const PORT = process.env.PORT || 7000;
const MONGO_URL = process.env.MONGO_URL;

mongoose.connect(MONGO_URL)
  .then(() => {
    console.log('MongoDB connected');
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      new RoomController(io);
    });
  })
  .catch(err => console.error('MongoDB connection error:', err));


function deepClone() {
    let filteredCards = allCards.filter(card => card.id <= 100);
    return JSON.parse(JSON.stringify(filteredCards));
}

// Method to initialize a game in a room
function initializeGameForRoom(roomId, playerName, playerId) {
    if (!this.gamesByRoomId[roomId]) {
      let game = gameController.initializeGame(allCards);
      game.players.player1.socketId = playerId;
      game.players.player1.name = playerName;
      this.gamesByRoomId[roomId] = game;
    //   console.log(`Game initialized in room ${roomId} by ${playerName}`);
    //   console.log(this.gamesByRoomId[roomId].players.player1);
    //   console.log(this.gamesByRoomId[roomId].players.player2);
    }
  }

  // Method to start a game in a room
  function  startGameForRoom(roomId, playerName, playerId) {
    let game = this.gamesByRoomId[roomId];
    let cards = deepClone();
    if (game && !game.players.player2.socketId) {
      game.players.player2.socketId = playerId;
      game.players.player2.name = playerName;
      game.cards = cards;
      const player1Id = game.players.player1.socketId;
      const player2Id = playerId; // The current player

      this.io.to(player1Id).emit('OpponentFound', {
        opponentName: playerName,
        yourHand: game.players.player1.hand,
        playingAs: "player1",
        deckCount: game.shuffledDeck.length,
        cards: game.cards,
      });

      this.io.to(player2Id).emit('OpponentFound', {
        opponentName: this.gamesByRoomId[roomId].players.player1.name,
        yourHand: game.players.player2.hand,
        playingAs: "player2",
        deckCount: game.shuffledDeck.length,
        cards: game.cards,
      });
      console.log(`Game in room ${roomId} ready. Players: ${player1Id}, ${player2Id}`);
    }
  }

io.on("connection", (socket) => {
    console.log(`New connection: ${socket.id}`);

    socket.on('Boardcardclicked', (data) => {
        let { roomId, cardId, selectedCard } = data;
        let game = gamesByRoomId[roomId];
        if (!game) {
            console.log("Game not found for room: ", roomId);
            return;
        }
        let currentTurn = game.players.player1.isTurn ? 'player1' : 'player2';
        let currentPlayer = game.players[currentTurn];
        if (socket.id !== currentPlayer.socketId || !currentPlayer.hand.some(card => card.id === selectedCard)) {
            console.log("Not this player's turn or invalid card manipulation");
            return;
        }
        let cards = game.cards;
        let playerUpdate = gameController.handleCardSelection(game, cardId, game.shuffledDeck, cards, currentTurn, selectedCard);
        if (!playerUpdate.success) {
            console.log('Error: ', playerUpdate.message);
            return;
        }
        let gameResult = gameController.Pattern(playerUpdate.game, game.cards);
        gamesByRoomId[roomId] = gameResult.game;

        if (gameResult.winner) {
            io.emit('gameOver', { winner: gameResult.winner });
        } else {
            Object.entries(game.players).forEach(([key, player]) => {
                io.to(player.socketId).emit('updateGameState', {
                    deckCount: playerUpdate.shuffledDeck.length,
                    score: game.scores,
                    cards: game.cards,
                    prevTurn: playerUpdate.currentPlayer,
                    currentTurn: game.players.player1.isTurn ? 'player1' : 'player2',
                    playerHand: player.hand,
                });
            });
        }
    })

        socket.on('room_closed',roomId =>{

        })
});

httpServer.listen(3000);