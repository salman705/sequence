
//   useEffect(() => {
//     if (socket) {
//       socket.on("connect", () => {
//       });

//       socket.on("OpponentNotFound", () => {
//         setOpponentName(false);
//       });

//       socket.on("OpponentFound", (data) => {
//         setIsWaitingForMatch(false);
//         setPlayingAs(data.playingAs);
//         setOpponentName(data.opponentName);
//         setYourHand(data.yourHand);
//         setDeckCount(data.deckCount);
//         setCards(data.cards);
//       });

//       socket.on("gameOver", (data) => {
//         Swal.fire({
//           title: `${data.winner} Won the game`,
//           icon: "success",
//         });
//       });

//       socket.on("custom_room_created", (data) => {
//         setInCustomGame(true);
//         setCustomRoomId(data.roomId);
//         Swal.fire(`Room created successfully. Room ID: ${data.roomId}`);
//       });

//       socket.on("custom_room_joined", () => {
//         setInCustomGame(true);
//         Swal.fire("Joined room successfully.");
//       });

//       socket.on("room_join_error", (error) => {
//         Swal.fire("Error", error.message, "error");
//       });

//       // Check for room code in URL on component mount
//       const urlParams = new URLSearchParams(window.location.search);
//       const roomCode = urlParams.get("roomCode");
//       if (roomCode) {
//         joinCustomRoom(roomCode); // Attempt to join the room if a code is present
//       }

//       return () => {
//         socket.off("connect");
//         socket.off("OpponentNotFound");
//         socket.off("OpponentFound");
//         socket.off("gameOver");
//         socket.off("custom_room_created");
//         socket.off("custom_room_joined");
//         socket.off("room_join_error");
//       };
//     }
//   }, [socket]);

//   useEffect(() => {
//     socket?.on("updateGameState", (gameState) => {
//       setDeckCount(gameState.deckCount);
//       setCards(gameState.cards);
//       setYourHand(gameState.playerHand);
//       setCurrentPlayer(gameState.currentTurn);
//       setBlueScore(gameState.score.blue);
//       setRedScore(gameState.score.red);
//     });
//     return () => {
//       socket?.off("updateGameState");
//     };
//   }, [socket]);

// // Function to handle the creation of a custom room with username prompt
// const createCustomRoom = async () => {
//   const result = await inputPlayerName();
//   if (!result.isConfirmed) {
//     return;
//   }
//   const username = result.value;
//   setPlayerName(username);

//   if (!socket) {
//     const newSocket = io("http://localhost:3000", { autoConnect: true });
//     setSocket(newSocket);
//   }
//   socket.emit("start_game", {playerName: username});
//   socket.emit("create_custom_room", { playerName: username }, (response) => {
//     if (response.roomId) {
//       setInCustomGame(true);
//       setCustomRoomId(response.roomId);
//       setPlayOnline(true);
//       setIsWaitingForMatch(true); 
//       navigate(`/room/${response.roomId}`); // Navigate to the room URL
//       console.log("Room created with ID:", response.roomId);
//     } else {
//       console.error("Failed to create custom room.");
//     }
//   });
// };


//   // Function to handle joining a custom room
//   const joinCustomRoom = async () => {
//     const roomCodeInput = await Swal.fire({
//       title: "Enter the Room ID",
//       input: "text",
//       showCancelButton: true,
//       inputValidator: (value) => {
//         if (!value) {
//           return "You need to write something!";
//         }
//       },
//     });
  
//     if (!roomCodeInput.isConfirmed) {
//       return;
//     }
//     const roomCode = roomCodeInput.value;
//     const result = await inputPlayerName();
//     if (!result.isConfirmed) {
//       return;
//     }
//     const username = result.value;
//     setPlayerName(username);
//     setPlayOnline(true);
//     socket.emit("start_game", {playerName: username});
//     socket.emit("join_custom_room", { roomId: roomCode, playerName: username }, (response) => {
//       if (response.success) {
//         setInCustomGame(true);
//         setCustomRoomId(roomCode);
//         navigate(`/room/${roomCode}`); 
//         console.log("Joined room successfully:", roomCode);
//       } else {
//         console.error("Failed to join custom room.");
//         Swal.fire("Error", response.message || "Failed to join room.", "error");
//       }
//     });
//   };

//   //Enter playerName
//   const inputPlayerName = async () => {
//     const result = await Swal.fire({
//       title: "Enter your Name",
//       input: "text",
//       showCancelButton: true,
//       inputValidator: (value) => {
//         if (!value) {
//           return "You need to write something!";
//         }
//       },
//     });
//     return result;
//   };

//   //clicking play button
//   async function onlineButton() {
//     const result = await inputPlayerName();
//     if (!result.isConfirmed) {
//       return;
//     }
//     const username = result.value;
//     setPlayerName(username);
//     // Check if socket is already initialized to avoid duplicate connections
//     if (!socket) {
//       const newSocket = io("http://localhost:3000", { autoConnect: true });
//       setSocket(newSocket);
//       registerSocketEvents();
//     }
//     socket.emit("start_game", {playerName: username});
//     socket.emit("play_online", { playerName: username }, (response) => {
//       setPlayOnline(true);
//       if (response.roomId) {
//         navigate(`/room/${response.roomId}`);
//       } else if (response.waiting) {
//         setIsWaitingForMatch(true);
//         navigate(`/room/${response.waitingroom}`);
//       } 
//     });
//   }

//   if (inCustomGame && !playOnline) {
//     return (
//       <div className="main-bg">
//         <div className="buttonContainer">
//           <button onClick={createCustomRoom} className="createRoomBtn">
//             Create Custom Room
//           </button>
//           <button onClick={joinCustomRoom} className="joinRoomBtn">
//             Join Custom Room
//           </button>
//         </div>
//       </div>
//     );
//   }

//   if (!playOnline && !inCustomGame) {
//     // Player hasn't chosen a mode yet
//     return (
//       <div className="main-bg">
//         <button onClick={onlineButton} className="playOnline">
//           Play Online
//         </button>
//         <button
//           onClick={() => setInCustomGame(true)}
//           className="playWithFriendsBtn"
//         >
//           Play with Friends
//         </button>
//       </div>
//     );
//   } else if (
//     playOnline &&
//     !opponentName &&
//     !inCustomGame &&
//     isWaitingForMatch
//   ) {
//     // Waiting for an online match
//     return (
//       <div className="waiting">
//         <p>Waiting for an opponent...</p>
//       </div>
//     );
//   } else if (inCustomGame && !opponentName) {
//     // In a custom game but waiting for a friend
//     return (
//       <div className="customGameWaiting">
//         <p>Room ID: {customRoomId}</p>
//         <p>Waiting for a friend to join...</p>
//       </div>
//     );
//   } else {
//     // Either playing online or in a custom game and the game is ready to start
//     return (
//       <>
//         <div className="game-board">
//           <span className="sequence-text sequence-text-left">SEQUENCE</span>
//           <Cards
//             socket={socket}
//             cards={cards}
//             selectCard={selectCard}
//             hoveredCard={hoveredCard}
//             currentPlayer={currentPlayer}
//             playingAs={playingAs}
//           />
//           <span className="sequence-text sequence-text-right">SEQUENCE</span>
//         </div>
//         <div className="flex flex-col justify-end items-end relative mr-4 mb-4">
//           <Deck deckCount={deckCount} />
//           <PlayerDeck
//             socket={socket}
//             playerHand={yourHand}
//             setSelectCard={setSelectCard}
//             setHoveredCard={setHoveredCard}
//             currentPlayer={currentPlayer}
//             playingAs={playingAs}
//           />
//           <ScoreComponent redScore={redScore} blueScore={blueScore} />
//           <PlayerTurn
//             playerName={playerName}
//             opponentName={opponentName}
//             currentPlayer={currentPlayer}
//             playingAs={playingAs}
//           />
//         </div>
//       </>
//     );
//   }
// }
