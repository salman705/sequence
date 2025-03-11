const Session = require('./models/session');

exports.createSession = async function(socketId, roomId = null, playingAs) {
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
};

exports.joinRoom = async function(socketId, roomId) {
    const session = await Session.findOne({ sessionId: socketId });
    if (session) {
      session.roomId = roomId;
      await session.save();
    }
};