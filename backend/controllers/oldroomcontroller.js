const { Server } = require("socket.io");
const Room = require('../models/room');

class RoomManager {
  constructor() {
    this.rooms = {}; //stores info about rooms including players, room id , custom room or not, room empty or full
    this.queue = []; //contains only the empty rooms for stranger players.
  }

  generateUniqueRoomId() {
    let roomId;
    do {
      roomId = Math.random().toString(36).substring(2, 9);
    } while (this.rooms[roomId]); // Keep generating until we find a unique one
    return roomId;
  }

  createRoom(hostId, playerName, isCustom = false) {
    const roomId = this.generateUniqueRoomId();
    this.rooms[roomId] = {
      players: [hostId],
      isCustom: isCustom,
      empty: true,
      playersName: [playerName],
    };
    return roomId;
  }

  createCustomRoom(hostId) {
    return this.createRoom(hostId, true);
  }

  joinCustomRoom(playerId, roomId, playerName) {
    const room = this.rooms[roomId];
    if (room && room.players.length < 2) {
      room.players.push(playerId);
      room.playersName.push(playerName);
      room.empty = false;
      return true;
    }
    return false;
  }

  matchRandomPlayer(playerId,playerName) {
    if (this.queue.length > 0) {
      const roomId = this.queue.shift(); //remove the first element in queue
      const room = this.rooms[roomId];
      room.players.push(playerId);
      room.playersName.push(playerName);
      room.empty = false;
      return roomId;
    } else {
      // Create a new room and add it to the queue if no match is found
      const newRoomId = this.createRoom(playerId,playerName);
      this.queue.push(newRoomId);
      return newRoomId;
    }
  }

  removeRoom(roomId) {
    delete this.rooms[roomId];
    const index = this.queue.indexOf(roomId);
    if (index > -1) {
      this.queue.splice(index, 1);
    }
  }
}

class RoomController {
  constructor(io, gamesByRoomId, initializeGame, startGame) {
    this.io = io;
    this.gamesByRoomId = gamesByRoomId; // Store reference to the gamesByRoomId
    this.initializeGameForRoom = initializeGame; // Store reference to the initialize game function
    this.startGameForRoom = startGame; 
    this.roomManager = new RoomManager();
    this.registerEvents();
  }
  registerEvents() {
      this.io.on("connection", (socket) => {
        this.handleCreateCustomRoom(socket);
        this.handleJoinCustomRoom(socket);
        this.handlePlayOnline(socket);
        this.handleDisconnection(socket);
      });
    }

    handleCreateCustomRoom(socket) {
      socket.on("create_custom_room", async (data, callback) => {
        const { playerName } = data;
        const roomId = this.roomManager.generateUniqueRoomId();
        try {
          const newRoom = new Room({
            roomId,
            players: [socket.id],
            isCustom: true,
            empty: true,
            playersName: [playerName],
          });
          await newRoom.save();
    
          socket.join(roomId);
          if (typeof callback === 'function') {
            callback({ roomId });
          }
          console.log(`Emitting initialize_game to roomId: ${roomId}, playerName: ${playerName}, id: ${socket.id}`);
          this.initializeGameForRoom(roomId, playerName, socket.id);
          socket.emit("custom_room_created", { roomId });
        } catch (err) {
          console.error('Error saving room to MongoDB:', err);
          socket.emit("room_creation_error", "Failed to create the room.");
        }
      });
    }

    handleJoinCustomRoom(socket) {
      socket.on("join_custom_room", async (data, callback) => {
        const { roomId, playerName } = data;
        try {
          const room = await Room.findOne({ roomId: roomId });
    
          if (room && room.players.length < 2) {
            room.players.push(socket.id);
            room.playersName.push(playerName);
            room.empty = false;
            await room.save();
    
            socket.join(roomId);
            if (typeof callback === 'function') {
              callback({ success: true });
            }
            this.startGameForRoom(roomId, playerName, socket.id);
          } else {
            socket.emit("room_join_error", "Room is full or does not exist.");
          }
        } catch (err) {
          console.error("Error joining custom room:", err);
          socket.emit("room_join_error", "Failed to join the room.");
        }
      });
    }

    handlePlayOnline(socket) {
      socket.on("play_online", async (data, callback) => {
        const { playerName } = data; 
        try {
          let room = await Room.findOne({ empty: true });
          if (!room) {
            const roomId = this.roomManager.generateUniqueRoomId();
            room = new Room({
              roomId,
              players: [socket.id],
              isCustom: false,
              empty: true,
              playersName: [playerName],
            });
            await room.save();
          } else {
            room.players.push(socket.id);
            room.playersName.push(playerName);
            room.empty = room.players.length < 2;
            await room.save();
          }
    
          let id = socket.id;
          socket.join(room.roomId);
          if (room.players.length === 2) {
            this.startGameForRoom(room.roomId, playerName, id);
            callback({ roomId: room.roomId });
          } else {
            callback({ waiting: true, waitingroom: room.roomId });
            this.initializeGameForRoom(room.roomId, playerName, id);
            socket.emit("waiting_for_match", { roomId: room.roomId });
          }
        } catch (err) {
          console.error("Error handling play online:", err);
          socket.emit("play_online_error", "Failed to find or create a room.");
        }
      });
    }
    handleDisconnection(socket) {
      socket.on("gameOverclicked", async (roomId) => {
        try {
          await Room.deleteOne({ roomId: roomId });
          this.io.to(roomId).emit("room_closed", roomId);
        } catch (err) {
          console.error("Error removing room:", err);
        }
      });
    }
    
    
  //   handleCreateCustomRoom(socket) {
  //     socket.on("create_custom_room", (data, callback) => {
  //       const {playerName } = data;
  //       const roomId = this.roomManager.createCustomRoom(socket.id,playerName);
  //       let id = socket.id;
  //       socket.join(roomId);
  //       if (typeof callback === 'function') {
  //         callback({ roomId });
  //       }
  //       console.log(`Emitting initialize_game to roomId: ${roomId}, playerName: ${playerName}, id: ${id}`);
  //       this.initializeGameForRoom(roomId, playerName, id);
  //       socket.emit("custom_room_created", { roomId });
  //     });
  //   }
  
  //   handleJoinCustomRoom(socket) {
  //     socket.on("join_custom_room", (data, callback) => {
  //       const { roomId, playerName } = data;
  //       if (this.roomManager.joinCustomRoom(socket.id, roomId, playerName)) {
  //         let id = socket.id;
  //         socket.join(roomId);
  //         const roomDetails = this.roomManager.rooms[roomId];
  //         if (typeof callback === 'function') {
  //           callback({ success: true });
  //         }
  //         this.startGameForRoom(roomId, playerName, id);
  //       } else {
  //         socket.emit("room_join_error", "Room is full or does not exist.");
  //       }
  //     });
  //   }
  
  //   handlePlayOnline(socket) {
  //     socket.on("play_online", (data, callback) => {
  //       const {playerName } = data;
  //       const roomId = this.roomManager.matchRandomPlayer(socket.id, playerName);
  //       let id = socket.id;
  //       socket.join(roomId);
  //       if (this.roomManager.rooms[roomId].players.length === 2) {
  //         const roomDetails = this.roomManager.rooms[roomId];
  //         this.startGameForRoom(roomId,playerName, id);
  //         if (typeof callback === 'function') {
  //           callback({ roomId });
  //         }
  //       } else {
  //         if (typeof callback === 'function') {
  //           callback({ waiting: true, waitingroom: roomId });
  //         }
  //         this.initializeGameForRoom(roomId, playerName, id);
  //       }
  //     });
  //   }
  
  //   handleDisconnection(socket) {
  //     socket.on("gameOverclicked", (roomId) => {
  //       this.roomManager.removeRoom(roomId);
  //       this.io.to(roomId).emit("room_closed",roomId);
  //     });
  //   }
  }

module.exports = RoomController;
