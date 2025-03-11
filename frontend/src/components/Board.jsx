import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Cards from "./Cards";
import PlayerDeck from "./PlayerDeck";
import Deck from "./Deck";
import ScoreComponent from "./Score";
import { io } from "socket.io-client";
import PlayerTurn from "./PlayerTurn";
import Swal from "sweetalert2";

const SERVER_URL = "http://localhost:3000";

export default function Boards() {
  const [cards, setCards] = useState([]);
  const [hoveredCard, setHoveredCard] = useState([]); // State for hovered card identifiers
  const [redScore, setRedScore] = useState(0);
  const [blueScore, setBlueScore] = useState(0);
  const [playOnline, setPlayOnline] = useState(false);
  const [socket, setSocket] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [opponentName, setOpponentName] = useState(null);
  const [playingAs, setPlayingAs] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState("player1");
  const [yourHand, setYourHand] = useState(null);
  const [deckCount, setDeckCount] = useState(null);
  const [selectCard, setSelectCard] = useState(null);
  const [customRoomId, setCustomRoomId] = useState("");
  const [inCustomGame, setInCustomGame] = useState(false);
  const [isWaitingForMatch, setIsWaitingForMatch] = useState(false);
  const [room, setRoom] = useState("");
  const [socketId, setSocketId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!socket) {
      const newSocket = io(SERVER_URL, { autoConnect: true });
      setSocket(newSocket);
      console.log(socket);
      return () => {
        newSocket.close();
      };
    }
  }, []);

  useEffect(() => {
    if (socket) {
      registerSocketEvents();
      checkForRoomCode();
    }
  }, [socket]);

  useEffect(() => {
    if (socket) {
      socket.on("updateGameState", (gameState) => {
        setDeckCount(gameState.deckCount);
        setCards(gameState.cards);
        setYourHand(gameState.playerHand);
        setCurrentPlayer(gameState.currentTurn);
        setBlueScore(gameState.score.blue);
        setRedScore(gameState.score.red);
      });
      return () => {
        socket.off("updateGameState");
      };
    }
  }, [socket]);

  const createCustomRoom = useCallback(async () => {
    const result = await inputPlayerName();
    if (!result.isConfirmed) {
      return;
    }
    const username = result.value;
    setPlayerName(username);
    
    socket.emit("create_custom_room", { playerName: username }, (response) => {
      if (response.roomId) {
        setInCustomGame(true);
        setCustomRoomId(response.roomId);
        setPlayOnline(true);
        setIsWaitingForMatch(true);
        setRoom(`${response.roomId}`);
        navigate(`/room/${response.roomId}`);
      } else {
        console.error("Failed to create custom room.");
      }
    });
  }, [socket, navigate]);

  const joinCustomRoom = useCallback(async () => {
    const roomCodeInput = await Swal.fire({
      title: "Enter the Room ID",
      input: "text",
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) {
          return "You need to write something!";
        }
      },
    });

    if (!roomCodeInput.isConfirmed) {
      return;
    }
    const roomCode = roomCodeInput.value;
    const result = await inputPlayerName();
    if (!result.isConfirmed) {
      return;
    }
    const username = result.value;
    setPlayerName(username);
    setPlayOnline(true);
    //socket.emit("initialize_game", { playerName: username });
    socket.emit("join_custom_room", { roomId: roomCode, playerName: username }, (response) => {
      if (response.success) {
        setInCustomGame(true);
        setCustomRoomId(roomCode);
        setRoom(`${roomCode}`);
        navigate(`/room/${roomCode}`);
      } else {
        console.error("Failed to join custom room.");
        Swal.fire("Error", response.message || "Failed to join room.", "error");
      }
    });
  }, [socket, navigate]);

  const onlineButton = useCallback(async () => {
    const result = await inputPlayerName();
    if (!result.isConfirmed) {
      return;
    }
    const username = result.value;
    setPlayerName(username);

    socket.emit("play_online", { playerName: username }, (response) => {
      setPlayOnline(true);
      if (response.roomId) {
        setRoom(`${response.roomId}`);
        navigate(`/room/${response.roomId}`);

      } else if (response.waiting) {
        setIsWaitingForMatch(true);
        setRoom(`${response.waitingroom}`);
        navigate(`/room/${response.waitingroom}`);
      }
    });
  }, [socket, navigate]);

  const inputPlayerName = useCallback(async () => {
    return await Swal.fire({
      title: "Enter your Name",
      input: "text",
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) {
          return "You need to write something!";
        }
      },
    });
  }, []);

  const registerSocketEvents = useCallback(() => {
    socket.on("connect", () => {});
      //   // console.log('Connected');
      //   // console.log(socket.id);
      //   // const newSocketId = socket.id;
      //   // const storedSocketId = localStorage.setItem("socketId", newSocketId); ;
      //   // setSocketId(storedSocketId);
      //  });
      socket.on("OpponentNotFound", () => {
        setOpponentName(false);
      });
      socket.on("OpponentFound", (data) => {
        setIsWaitingForMatch(false);
        setPlayingAs(data.playingAs);
        setOpponentName(data.opponentName);
        setYourHand(data.yourHand);
        setDeckCount(data.deckCount);
        setCards(data.cards);
      });
      socket.on("gameOver", (data) => {
        Swal.fire({
          title: `${data.winner} Won the game`,
          icon: "success",
        });
      });
      socket.on("custom_room_created", (data) => {
        setInCustomGame(true);
        setCustomRoomId(data.roomId);
        Swal.fire(`Room created successfully. Room ID: ${data.roomId}`);
      });
      socket.on("custom_room_joined", () => {
        setInCustomGame(true);
        Swal.fire("Joined room successfully.");
      });
      socket.on("room_join_error", (error) => {
        Swal.fire("Error", error.message, "error");
      });
  
      return () => {
        socket.off("connect");
        socket.off("OpponentNotFound");
        socket.off("OpponentFound");
        socket.off("gameOver");
        socket.off("custom_room_created");
        socket.off("custom_room_joined");
        socket.off("room_join_error");
      };
  }, [socket]);

  const checkForRoomCode = useCallback(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get("roomCode");
    if (roomCode) {
      joinCustomRoom(roomCode); // Attempt to join the room if a code is present
    }
  }, [joinCustomRoom]);

  if (inCustomGame && !playOnline) {
    return (
      <div className="main-bg">
        <div className="buttonContainer">
          <button onClick={createCustomRoom} className="createRoomBtn">
            Create Custom Room
          </button>
          <button onClick={joinCustomRoom} className="joinRoomBtn">
            Join Custom Room
          </button>
        </div>
      </div>
    );
  }

  if (!playOnline && !inCustomGame) {
    return (
      <div className="main-bg">
        <button onClick={onlineButton} className="playOnline">
          Play Online
        </button>
        <button
          onClick={() => setInCustomGame(true)}
          className="playWithFriendsBtn"
        >
          Play with Friends
        </button>
      </div>
    );
  } else if (playOnline && !opponentName && !inCustomGame && isWaitingForMatch) {
    return (
      <div className="waiting">
        <p>Waiting for an opponent...</p>
      </div>
    );
  } else if (inCustomGame && !opponentName) {
    return (
      <div className="customGameWaiting main-bg text-center text-white p-8">
        <p className="mb-4">Room ID: {customRoomId}</p>
        <p>Waiting for a friend to join...</p>
      </div>
    );
  } else {
    return (
      <>
        <div className="game-board relative mx-auto my-8">
          <span className="sequence-text sequence-text-left">SEQUENCE</span>
          <Cards
            roomId={room} 
            socket={socket}
            cards={cards}
            selectCard={selectCard}
            hoveredCard={hoveredCard}
            currentPlayer={currentPlayer}
            playingAs={playingAs}
          />
          <span className="sequence-text sequence-text-right">SEQUENCE</span>
        </div>
        <div className="flex flex-col justify-end items-end relative mr-4 mb-4">
          <Deck deckCount={deckCount} />
          <PlayerDeck
            socket={socket}
            playerHand={yourHand}
            setSelectCard={setSelectCard}
            setHoveredCard={setHoveredCard}
            currentPlayer={currentPlayer}
            playingAs={playingAs}
          />
          <ScoreComponent redScore={redScore} blueScore={blueScore} />
          <PlayerTurn
            playerName={playerName}
            opponentName={opponentName}
            currentPlayer={currentPlayer}
            playingAs={playingAs}
          />
        </div>
      </>
    );
  }
};