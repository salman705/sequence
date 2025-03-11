const { initializeGameForRoom, startGameForRoom, handleCardClick, handleRoomClosure } = require('./controllers/startController');
const { createSession, joinRoom } = require('./sessionManager');
const Game = require('./models/Game');
const Session = require('./models/session');
const activeSockets = new Map();

module.exports = function setupSocketHandlers(io) {
    io.on("connection", async (socket) => {
        let sessionID = socket.handshake.query.sessionId;
        console.log(`Socket connected: ${sessionID || socket.id}`);

        if (sessionID) {
            reconnectClient(socket, sessionID);
        } else {
            console.log(`New connection: ${socket.id}`);
            const newSessionID = await createSession(socket.id);
            activeSockets.set(newSessionID, socket);
        }

        socket.on('Boardcardclicked', data => handleCardClick(data, socket, io));
        socket.on('room_closed', roomId => handleRoomClosure(roomId));
    });
};

async function reconnectClient(socket, sessionID) {
    const existingSocket = activeSockets.get(sessionID);
    if (existingSocket) {
        existingSocket.disconnect();
        activeSockets.delete(sessionID);
    }
    activeSockets.set(sessionID, socket);

    const existingSession = await Session.findOne({ sessionId: sessionID });
    if (existingSession) {
        const { roomId, userId, playingAs } = existingSession;
        emitGameUpdate(roomId, userId, playingAs, socket);
    }
    console.log(`Reconnected client ${sessionID}`);
}

async function emitGameUpdate(roomId, userId, playingAs, socket) {
    const game = await Game.findOne({ roomId });
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
