const Game = require('../models/Game');
const { createSession, joinRoom } = require('../sessionManager');
const gameLogic = require('../gameLogic');
const gameController = require('./gameController');

exports.initializeGameForRoom = async function(roomId, playerName, playerId) {
    const newSessionId = await createSession(playerId, roomId, 'player1');
    await joinRoom(playerId, roomId);
    let existingGame = await Game.findOne({ roomId: roomId });
  
    if (!existingGame) {
        const allCards = gameLogic.deepClone(require('../data/allCards'));
        let gameInitialState = gameController.initializeGame(allCards);
        gameInitialState.players.player1.socketId = playerId;
        gameInitialState.players.player1.name = playerName;
        gameInitialState.cards = allCards;

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
            console.log(`Game initialized in room ${roomId} by ${playerName}`);
        } catch (err) {
            console.error('Error saving new game to MongoDB:', err);
            throw err;
        }
    } else {
        console.log(`Game already exists for room ${roomId}`);
    }
};

exports.startGameForRoom = async function(roomId, playerName, playerId) {
    try {
        const game = await Game.findOne({ roomId: roomId });
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

        // When all players have joined
        if (players.every(p => game.players[p].socketId)) {
            const opponentNames = players
                .filter(p => p !== availablePlayer)
                .map(p => game.players[p].name);

            players.forEach(playerKey => {
                const player = game.players[playerKey];
                const otherPlayers = players.filter(p => p !== playerKey);

                this.io.to(player.socketId).emit('OpponentFound', {
                    opponents: otherPlayers.map(p => game.players[p].name),
                    yourHand: player.hand,
                    playingAs: playerKey,
                    deckCount: game.shuffledDeck.length,
                    cards: game.cards,
                });
            });

            console.log(`Game in room ${roomId} started with 3 players`);
        }
    } catch (err) {
        console.error(`Error updating game for room ${roomId}:`, err);
        throw err;
    }
};

exports.handleCardClick = async function(data, socket, io) {
    const { roomId, cardId, selectedCard } = data;

    try {
        const game = await Game.findOne({ roomId: roomId });
        if (!game) {
            console.log("Game not found for room:", roomId);
            return;
        }

        const players = ['player1', 'player2', 'player3'];
        const currentTurn = players.find(p => game.players[p].isTurn);
        const currentPlayer = game.players[currentTurn];

        // Validate player turn
        if (socket.id !== currentPlayer.socketId || 
            !currentPlayer.hand.some(card => card.id === selectedCard)) {
            console.log("Invalid move attempt by:", socket.id);
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
            console.log('Move failed:', updatedGame.message);
            return;
        }

        // Update database
        const updateData = {
            players: updatedGame.game.players,
            scores: updatedGame.game.scores,
            shuffledDeck: updatedGame.game.shuffledDeck,
            cards: updatedGame.game.cards,
            protectedPatterns: updatedGame.game.protectedPatterns
        };

        await Game.updateOne({ roomId }, { $set: updateData });

        // Check for winner
        const patternResult = gameController.Pattern(updatedGame.game, updatedGame.game.cards);
        if (patternResult.winner) {
            io.to(roomId).emit('gameOver', { winner: patternResult.winner });
            await Game.deleteOne({ roomId });
            return;
        }

        // Broadcast updated state
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
        console.error('Error processing card click:', err);
        io.to(socket.id).emit('gameError', { message: 'Failed to process move' });
    }
};

exports.handleRoomClosure = async function(roomId) {
    try {
        await Game.deleteOne({ roomId });
        console.log(`Room ${roomId} closed and game deleted`);
    } catch (err) {
        console.error('Error closing room:', err);
    }
};