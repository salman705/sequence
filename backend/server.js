const express = require('express');
const mongoose = require("mongoose");
const { createServer } = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const allCards = require('./data/allCards.js');
const gameController = require('./controllers/gameController');
const RoomController = require('./controllers/roomController');
const Game = require('./models/Game');
const Session = require('./models/session');
const config = require('./config/config');
//const setupSocketHandlers = require('./socketHandlers');
//const { initializeGameForRoom, startGameForRoom } = require('./controllers/startController');

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: config.corsOptions
});

mongoose.connect(config.MONGO_URL)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

  // Initialize the Room Controller here after setting up all dependencies
// const roomController = new RoomController(io, initializeGameForRoom, startGameForRoom);

// setupSocketHandlers(io);

// httpServer.listen(3000, () => {
//     console.log(`Server running on port 3000`);
// });

const activeSockets = new Map();

function deepClone() {
    let filteredCards = allCards.filter(card => card.id <= 100);
    return JSON.parse(JSON.stringify(filteredCards));
}

async function joinRoom(socketId, roomId) {
    const session = await Session.findOne({ sessionId: socketId });
    if (session) {
      session.roomId = roomId;
      await session.save();
    }
  }


async function createSession(socketId,roomId = null, playingAs) {
    const expirationTime = new Date(new Date().getTime() + (2 * 60 * 60 * 1000)); // 2 hours from now
    const newSession = new Session({  
        userId: socketId,    
        roomId: roomId,    
        playingAs: playingAs,
        expiresAt: expirationTime
    });

    try {
        await newSession.save();
        console.log(`New session created for socket ${socketId} with expiration at ${expirationTime}`);
        return socketId;
    } catch (err) {
        console.error('Failed to save session:', err);
        return null;
    }
}


// Method to initialize a game in a room
async function initializeGameForRoom(roomId, playerName, playerId) {
    // Check if a game already exists for the roomId
    const newSessionId = await createSession(playerId, roomId, playingAs='player1');
    await joinRoom(playerId, roomId);
    let existingGame = await Game.findOne({ roomId: roomId });
  
    if (!existingGame) {
      let gameInitialState = gameController.initializeGame(allCards);
      gameInitialState.players.player1.socketId = playerId;
      gameInitialState.players.player1.name = playerName;

      let newGame = new Game({
        roomId: roomId,
        players: gameInitialState.players,
        scores: gameInitialState.scores,
        shuffledDeck: gameInitialState.shuffledDeck,
        cards: gameInitialState.cards,
        protectedPatterns: gameInitialState.protectedPatterns
      });
  
      try {
        await newGame.save();
        //console.log(`Game initialized in room ${roomId} by ${playerName}`);
      } catch (err) {
        console.error('Error saving new game to MongoDB:', err);
      }
    } else {
      //console.log(`Game already exists for room ${roomId}, proceeding with existing game.`);
    }
  }

  // Method to start a game in a room
async function startGameForRoom(roomId, playerName, playerId) {
    const newSessionId = await createSession(playerId, roomId, playingAs='player2');
    await joinRoom(playerId, roomId);
    try {
        let game = await Game.findOne({ roomId: roomId });
        if (game && !game.players.player2.socketId) {
            game.players.player2.socketId = playerId;
            game.players.player2.name = playerName;
            game.cards = deepClone();
            // Save the updated game state back to the database
            await game.save();

            this.io.to(game.players.player1.socketId).emit('OpponentFound', {
                opponentName: playerName,
                yourHand: game.players.player1.hand,
                playingAs: "player1",
                deckCount: game.shuffledDeck.length,
                cards: game.cards,
            });

            this.io.to(playerId).emit('OpponentFound', {
                opponentName: game.players.player1.name,
                yourHand: game.players.player2.hand,
                playingAs: "player2",
                deckCount: game.shuffledDeck.length,
                cards: game.cards,
            });

            //console.log(`Game in room ${roomId} ready. Players: ${game.players.player1.socketId}, ${playerId}`);
        } else {
            console.log(`Game not found for room ${roomId}, or player2 already exists.`);
        }
    } catch (err) {
        console.error(`Error updating game for room ${roomId}:`, err);
    }
}
const roomController = new RoomController(io, initializeGameForRoom, startGameForRoom);

io.on("connection", async(socket) => {
    let sessionID = socket.handshake.query.sessionId;
    console.log(sessionID);
    if (sessionID) {
        const existingSocket = activeSockets.get(sessionID);
        if (existingSocket) {
        existingSocket.disconnect();
        activeSockets.delete(sessionID);
        }
        activeSockets.set(sessionID, socket);
        console.log(`Reconnected client ${sessionID}`);

        // Check if the user has an existing session and room ID
        const existingSession = await Session.findOne({ sessionId: sessionID });
        if (existingSession) {
        const roomId = existingSession.roomId;
        const playerId = existingSession.userId;
        const playingAs = existingSession.playingAs;
        
        // Fetch game data and emit it to the client
        let game = await Game.findOne({ roomId: roomId });
        if (playingAs === "player1") {
            this.io.to(playerId).emit('OpponentFound', {
              opponentName: game.players.player2.name,
              yourHand: game.players.player1.hand,
              playingAs: "player1",
              deckCount: game.shuffledDeck.length,
              cards: game.cards,
            });
          } else {
            this.io.to(playerId).emit('OpponentFound', {
              opponentName: game.players.player1.name,
              yourHand: game.players.player2.hand,
              playingAs: "player2",
              deckCount: game.shuffledDeck.length,
              cards: game.cards,
            });
          }

        }
    } else {
        console.log(`New connection: ${socket.id}`);
        const newSessionID = createSession(socket.id);
        activeSockets.set(newSessionID, socket);
    }
    socket.on('Boardcardclicked', async (data) => {
        const { roomId, cardId, selectedCard } = data;

        try {
            // Fetch the game state from MongoDB
            let game = await Game.findOne({ roomId: roomId });
            if (!game) {
                console.log("Game not found for room: ", roomId);
                return;
            }

            // Determine the current player based on the game state
            let currentTurn = game.players.player1.isTurn ? 'player1' : 'player2';
            let currentPlayer = game.players[currentTurn];
            if (socket.id !== currentPlayer.socketId || !currentPlayer.hand.some(card => card.id === selectedCard)) {
                console.log("Not this player's turn or invalid card manipulation");
                return;
            }
            let cards = game.cards;

            // Handle card selection and update the game state
            let  updatedGame = gameController.handleCardSelection(game, cardId, game.shuffledDeck,cards, currentTurn, selectedCard);
            if (!updatedGame.success) {
                console.log('Error: ', message);
                return;
            }

            let updateData = {
                'players.player1': updatedGame.game.players.player1,
                'players.player2': updatedGame.game.players.player2,
                'scores': updatedGame.game.scores,
                'shuffledDeck': updatedGame.game.shuffledDeck,
                'cards': updatedGame.game.cards,
                'protectedPatterns': updatedGame.game.protectedPatterns
            };
    
            await Game.updateOne({ roomId: roomId }, { $set: updateData });
            let patternResult = gameController.Pattern(updatedGame.game, game.cards);
            if (patternResult.winner) {
                io.emit('gameOver', { winner: patternResult.winner });
            } else {
                if (patternResult.updated) {
                    await game.save();
                }

                Object.keys(game.players).forEach(playerKey => {
                    const player = game.players[playerKey];
                    io.to(player.socketId).emit('updateGameState', {
                        deckCount: game.shuffledDeck.length,
                        score: game.scores,
                        cards: game.cards,
                        prevTurn: currentTurn,
                        currentTurn: game.players.player1.isTurn ? 'player1' : 'player2',
                        playerHand: player.hand,
                    });
                });
            }
        } catch (err) {
            console.error('Error processing Boardcardclicked:', err);
        }
    });

    socket.on('room_closed', roomId => {
        // Handle room closure, if necessary
    });
});

httpServer.listen(3000);