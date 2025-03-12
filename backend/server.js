const express = require('express');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const gameController = require('./controllers/gameController');
const RoomController = require('./controllers/roomController');
const Game = require('./models/Game');
const Session = require('./models/session');
const config = require('./config/config');
const gameLogic = require('./gameLogic');

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: config.corsOptions,
    pingTimeout: 60000
});

mongoose.connect(config.MONGO_URL)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const activeSockets = new Map();

async function joinRoom(socketId, roomId) {
    try {
        const session = await Session.findOne({ userId: socketId });
        if (session) {
            session.roomId = roomId;
            await session.save();
        }
    } catch (err) {
        console.error('Error updating session room:', err);
    }
}

async function createSession(socketId, roomId = null, playingAs) {
    try {
        const expirationTime = new Date(Date.now() + (2 * 60 * 60 * 1000)); // 2 hours
        const newSession = new Session({  
            userId: socketId,
            roomId: roomId,
            playingAs: playingAs,
            expiresAt: expirationTime
        });

        await newSession.save();
        console.log(`Session created for ${socketId} as ${playingAs}`);
        return socketId;
    } catch (err) {
        console.error('Failed to create session:', err);
        return null;
    }
}

async function initializeGameForRoom(roomId, playerName, playerId) {
    try {
        const existingGame = await Game.findOne({ roomId });
        if (!existingGame) {
            const allCards = gameLogic.deepClone(require('./data/allCards'));
            const gameInitialState = gameController.initializeGame(allCards);
            
            gameInitialState.players.player1.socketId = playerId;
            gameInitialState.players.player1.name = playerName;
            gameInitialState.cards = allCards;

            const newGame = new Game({
                roomId,
                players: gameInitialState.players,
                scores: gameInitialState.scores,
                shuffledDeck: gameInitialState.shuffledDeck,
                cards: gameInitialState.cards,
                protectedPatterns: gameInitialState.protectedPatterns
            });

            await newGame.save();
            console.log(`Game initialized in ${roomId} by ${playerName}`);
        }
    } catch (err) {
        console.error('Error initializing game:', err);
        throw err;
    }
}

async function startGameForRoom(roomId, playerName, playerId) {
    try {
        const game = await Game.findOne({ roomId });
        if (!game) {
            console.log(`Game not found for room ${roomId}`);
            return;
        }

        const players = ['player1', 'player2', 'player3'];
        const availablePlayer = players.find(p => !game.players[p].socketId);

        if (!availablePlayer) {
            console.log(`Room ${roomId} is full`);
            return;
        }

        game.players[availablePlayer].socketId = playerId;
        game.players[availablePlayer].name = playerName;
        game.markModified('players');
        await game.save();

        // Notify players when all 3 are connected
        if (players.every(p => game.players[p].socketId)) {
            players.forEach(playerKey => {
                const player = game.players[playerKey];
                const opponents = players
                    .filter(p => p !== playerKey)
                    .map(p => game.players[p].name);

                io.to(player.socketId).emit('OpponentFound', {
                    opponents,
                    yourHand: player.hand,
                    playingAs: playerKey,
                    deckCount: game.shuffledDeck.length,
                    cards: game.cards
                });
            });
            console.log(`Game started in ${roomId} with 3 players`);
        }
    } catch (err) {
        console.error('Error starting game:', err);
        throw err;
    }
}

const roomController = new RoomController(io, initializeGameForRoom, startGameForRoom);

io.on('connection', async (socket) => {
    try {
        const sessionID = socket.handshake.query.sessionId;
        console.log('Connection attempt with session:', sessionID);

        // Handle reconnection
        if (sessionID) {
            const existingSocket = activeSockets.get(sessionID);
            if (existingSocket) {
                existingSocket.disconnect();
                activeSockets.delete(sessionID);
            }
            activeSockets.set(sessionID, socket);
            
            const session = await Session.findOne({ userId: sessionID });
            if (session) {
                const game = await Game.findOne({ roomId: session.roomId });
                if (game) {
                    const playerKey = session.playingAs;
                    const opponents = ['player1', 'player2', 'player3']
                        .filter(p => p !== playerKey)
                        .map(p => game.players[p].name);

                    socket.emit('gameReconnected', {
                        opponents,
                        yourHand: game.players[playerKey].hand,
                        playingAs: playerKey,
                        deckCount: game.shuffledDeck.length,
                        cards: game.cards,
                        currentTurn: Object.keys(game.players).find(p => game.players[p].isTurn)
                    });
                }
            }
            return;
        }

        // New connection
        const newSessionId = await createSession(socket.id);
        activeSockets.set(newSessionId, socket);
        console.log(`New connection: ${socket.id}`);

    } catch (err) {
        console.error('Connection error:', err);
    }

    socket.on('Boardcardclicked', async (data) => {
        try {
            const { roomId, cardId, selectedCard } = data;
            const game = await Game.findOne({ roomId });
            
            if (!game) {
                console.log(`Game not found for room ${roomId}`);
                return;
            }

            const players = ['player1', 'player2', 'player3'];
            const currentTurn = players.find(p => game.players[p].isTurn);
            const currentPlayer = game.players[currentTurn];

            // Validate move
            if (socket.id !== currentPlayer.socketId || 
                !currentPlayer.hand.some(card => card.id === selectedCard)) {
                console.log(`Invalid move attempt by ${socket.id}`);
                return;
            }

            // Process card selection
            const updatedGame = gameController.handleCardSelection(
                game.toObject(),
                cardId,
                game.shuffledDeck,
                game.cards,
                currentTurn,
                selectedCard
            );

            if (!updatedGame.success) {
                socket.emit('moveError', { message: updatedGame.message });
                return;
            }

            // Update database
            await Game.updateOne({ roomId }, { $set: updatedGame.game });

            // Check for winner
            const patternResult = gameController.Pattern(updatedGame.game, updatedGame.game.cards);
            if (patternResult.winner) {
                io.to(roomId).emit('gameOver', { winner: patternResult.winner });
                await Game.deleteOne({ roomId });
                return;
            }

            // Broadcast updates
            const nextTurn = players.find(p => updatedGame.game.players[p].isTurn);
            const updatePayload = {
                deckCount: updatedGame.game.shuffledDeck.length,
                scores: updatedGame.game.scores,
                cards: updatedGame.game.cards,
                currentTurn: nextTurn,
                protectedPatterns: updatedGame.game.protectedPatterns
            };

            players.forEach(playerKey => {
                const player = updatedGame.game.players[playerKey];
                io.to(player.socketId).emit('updateGameState', {
                    ...updatePayload,
                    playerHand: player.hand,
                    yourTurn: playerKey === nextTurn
                });
            });

        } catch (err) {
            console.error('Card click error:', err);
            socket.emit('gameError', { message: 'Server error processing move' });
        }
    });

    socket.on('disconnect', async () => {
        try {
            const session = await Session.findOne({ userId: socket.id });
            if (session) {
                console.log(`Disconnected: ${socket.id} from room ${session.roomId}`);
                await Session.deleteOne({ userId: socket.id });
                activeSockets.delete(socket.id);
            }
        } catch (err) {
            console.error('Disconnect error:', err);
        }
    });
});

httpServer.listen(3000, () => {
    console.log('Server running on port 3000');
});