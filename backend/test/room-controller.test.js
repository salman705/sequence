const { Server } = require('socket.io');
const Client = require('socket.io-client');
const RoomController = require('../controllers/roomController');

describe('RoomController', () => {
  let io, roomController, clientA, clientB;

  beforeEach((done) => {
    io = new Server();
    roomController = new RoomController(io);
    clientA = Client('http://localhost:3000');
    clientB = Client('http://localhost:3000');
    io.on('connection', (socket) => {
      socket.on('disconnect', () => {
        socket.disconnect(true);
      });
    });
    io.listen(3000);
    done();
  });

  afterEach((done) => {
    io.close();
    clientA.disconnect();
    clientB.disconnect();
    done();
  });

  it('should create a custom room', (done) => {
    clientA.on('custom_room_created', (data) => {
      expect(data.roomId).toEqual(expect.any(String));
      expect(roomController.roomManager.rooms[data.roomId].isCustom).toBe(true);
      done();
    });
    clientA.emit('create_custom_room');
  });

  it('should join a custom room', (done) => {
    clientA.on('custom_room_created', (data) => {
      const roomId = data.roomId;
      clientB.on('start_game', () => {
        expect(roomController.roomManager.rooms[roomId].players).toContain(clientB.id);
        expect(roomController.roomManager.rooms[roomId].empty).toBe(false);
        done();
      });
      clientB.emit('join_custom_room', { roomId });
    });
    clientA.emit('create_custom_room');
  });

  it('should match players in random queue', (done) => {
    clientA.emit('play_online');
    clientB.emit('play_online');
    setTimeout(() => {
      // Find the room that contains both clientA and clientB
      const room = Object.values(roomController.roomManager.rooms).find((r) =>
        r.players.includes(clientA.id) && r.players.includes(clientB.id)
      );
      expect(room).toBeDefined();
      expect(room.players).toContain(clientA.id);
      expect(room.players).toContain(clientB.id);
      expect(room.empty).toBe(false);
      done();
    }, 500);
  });

  it('should remove a room when gameOverclicked is emitted', (done) => {
    clientA.emit('create_custom_room');
    clientA.on('custom_room_created', (data) => {
      let {roomId} = data;
      roomId = clientA.emit('gameOverclicked', { roomId });
      setTimeout(() => {
        expect(roomController.roomManager.rooms[roomId]).toBeUndefined();
        expect(roomController.roomManager.queue).not.toContain(roomId);
        done();
      }, 500);
    });
  });

  
});