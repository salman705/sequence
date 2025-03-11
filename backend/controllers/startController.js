const Game = require('../models/Game');
const { createSession, joinRoom } = require('../sessionManager');
const gameLogic = require('../gameLogic');
const gameController = require('./gameController');

exports.initializeGameForRoom = async function(roomId, playerName, playerId){
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

exports.startGameForRoom = async function(roomId, playerName, playerId) {
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
};

exports.handleCardClick = async function(data, socket, io) {
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
                io.emit('gameOver', { winner: gameResult.winner });
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
    };

    exports.handleRoomClosure = async function(roomId) {
        // Handle 'room_closed' event
    };