function shuffleDeck(cards) {
    let shuffledCards = cards.slice();
    for (let i = shuffledCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledCards[i], shuffledCards[j]] = [shuffledCards[j], shuffledCards[i]];
    }
    return shuffledCards;
}

function initializeGame(cards) {
    const initialDeck = shuffleDeck(
        cards.filter((card) => ![1, 10, 91, 100].includes(card.id))
    );
    const player1InitialHand = initialDeck.slice(0, 5);
    const player2InitialHand = initialDeck.slice(5, 10);
    const player3InitialHand = initialDeck.slice(10, 15);
    const remainingDeck = initialDeck.slice(15);

    const games = {
        players: {
            player1: { hand: player1InitialHand, isTurn: true, socketId: null, name: null },
            player2: { hand: player2InitialHand, isTurn: false, socketId: null, name: null },
            player3: { hand: player3InitialHand, isTurn: false, socketId: null, name: null },
        },
        scores: {
            red: 0,
            green: 0,
            blue: 0,
        },
        shuffledDeck: remainingDeck,
        cards: null,
        protectedPatterns: [],
    };
    
    return games;
}

function handleCardSelection(
    game,
    cardId,
    shuffledDeck,
    cards,
    currentTurn,
    selectedCard
) {
    const playerOrder = ['player1', 'player2', 'player3'];
    const currentIndex = playerOrder.indexOf(currentTurn);
    const nextPlayer = playerOrder[(currentIndex + 1) % 3];
    const playerColors = {
        player1: "blue",
        player2: "red",
        player3: "green"
    };

    let cardIndex = cardId - 1;
    let playerHand = game.players[currentTurn].hand;
    let cardInQuestion = cards[cardIndex];

    const isCardProtected = (cardIndex, protectedPatterns) => {
        return protectedPatterns.some(pattern => pattern.includes(cardIndex + 1));
    };

    if (selectedCard > 100 && selectedCard <= 104) {
        cardInQuestion.selected = "True";
        cardInQuestion.selectedby = playerColors[currentTurn];
    } else if (selectedCard > 104 && selectedCard <= 108 && cardInQuestion.selected === "True") {
        if (!isCardProtected(cardIndex, game.protectedPatterns)) {
            cardInQuestion.selected = false;
            cardInQuestion.selectedby = "";
        } else {
            return { success: false, message: "Wrong move: Card is protected." };
        }
    } else {
        cardInQuestion.selected = "True";
        cardInQuestion.selectedby = playerColors[currentTurn];
    }

    const indexToRemove = playerHand.findIndex(
        (card) => card.id === cardId || 
        (selectedCard > 100 && selectedCard < 109 && card.id === selectedCard) || 
        (card.matches && card.matches.includes(cardId))
    );
    
    if (indexToRemove === -1) {
        return { success: false, message: "Card not found in hand" };
    }

    playerHand.splice(indexToRemove, 1);
    if (shuffledDeck.length > 0) {
        const newCard = shuffledDeck.shift();
        playerHand.push(newCard);
    }

    // Update turns
    playerOrder.forEach(player => {
        game.players[player].isTurn = (player === nextPlayer);
    });

    return { 
        success: true, 
        game: {
            ...game,
            players: {
                ...game.players,
                [currentTurn]: {
                    ...game.players[currentTurn],
                    hand: playerHand
                }
            },
            shuffledDeck,
            cards
        },
        currentPlayer: currentTurn,
        nextPlayer
    };
}

function Pattern(game, cards) {
    let board = Array(10).fill(null).map(() => 
        Array(10).fill({ color: null, isPartOfPattern: false, index: -1 })
    );
    game.protectedPatterns = game.protectedPatterns || [];
    const cornerIndices = [1, 10, 91, 100];

    const getPositionFromId = (id) => {
        const row = Math.floor((id - 1) / 10);
        const col = (id - 1) % 10;
        return { row, col };
    };

    if (Array.isArray(cards)) {
        cards.forEach((card) => {
            if (card.selected === "True") {
                const { row, col } = getPositionFromId(card.id);
                board[row][col] = { 
                    color: card.selectedby, 
                    isPartOfPattern: false, 
                    index: card.id 
                };
            }
        });
    }

    const isCornerIndex = (index) => cornerIndices.includes(index);

    const checkConsecutive = (arr, color) => {
        let count = 0;
        let patternIndices = [];
        for (let i = 0; i < arr.length; i++) {
            const cell = arr[i];
            const effectiveColor = cell.color || (isCornerIndex(cell.index) ? color : null);
            if (effectiveColor === color) {
                count++;
                patternIndices.push(cell.index);
                if (count >= 5 && isPatternNew(patternIndices)) {
                    return { isPattern: true, patternIndices };
                }
            } else {
                count = 0;
                patternIndices = [];
            }
        }
        return { isPattern: false, patternIndices: [] };
    };

    const isPatternNew = (patternIndices) => {
        const existingPatterns = game.protectedPatterns || [];
        const isEntirelyNew = !existingPatterns.some(pattern =>
            patternIndices.every(index => pattern.includes(index))
        );
        const isValidOverlap = existingPatterns.every(pattern =>
            patternIndices.filter(index => pattern.includes(index)).length <= 1
        );
        return isEntirelyNew && isValidOverlap;
    };

    const addProtectedPattern = (pattern) => {
        game.protectedPatterns.push(pattern);
    };

    const checkPatterns = (color) => {
        const getSequencesOfFive = (arr) => {
            const sequences = [];
            for (let i = 0; i <= arr.length - 5; i++) {
                sequences.push(arr.slice(i, i + 5));
            }
            return sequences;
        };

        const getDiagonals = (board, diagonalFunc) => {
            const diagonals = [];
            for (let row = 0; row < 10; row++) {
                for (let col = 0; col < 10; col++) {
                    const cells = diagonalFunc(row, col);
                    if (cells.length >= 5) {
                        diagonals.push(cells);
                    }
                }
            }
            return diagonals;
        };

        // Check rows
        for (let row = 0; row < 10; row++) {
            const rowCells = board[row].map((cell, col) => ({
                ...cell,
                index: row * 10 + col + 1
            }));
            getSequencesOfFive(rowCells).forEach(sequence => {
                const result = checkConsecutive(sequence, color);
                if (result.isPattern) {
                    addProtectedPattern(result.patternIndices);
                    game.scores[color]++;
                }
            });
        }

        // Check columns
        for (let col = 0; col < 10; col++) {
            const colCells = board.map((row, rowIndex) => ({
                ...row[col],
                index: rowIndex * 10 + col + 1
            }));
            getSequencesOfFive(colCells).forEach(sequence => {
                const result = checkConsecutive(sequence, color);
                if (result.isPattern) {
                    addProtectedPattern(result.patternIndices);
                    game.scores[color]++;
                }
            });
        }

        // Check diagonals
        const checkDiagonal = (startRow, startCol, rowStep, colStep) => {
            const cells = [];
            let row = startRow;
            let col = startCol;
            while (row >= 0 && row < 10 && col >= 0 && col < 10) {
                cells.push({
                    ...board[row][col],
                    index: row * 10 + col + 1
                });
                row += rowStep;
                col += colStep;
            }
            return cells;
        };

        // Check all possible diagonals
        for (let i = 0; i < 10; i++) {
            [checkDiagonal(i, 0, 1, 1),    // Down-right from left edge
             checkDiagonal(0, i, 1, 1),    // Down-right from top edge
             checkDiagonal(i, 9, 1, -1),   // Down-left from right edge
             checkDiagonal(0, i, 1, -1)]   // Down-left from top edge
            .forEach(diagonal => {
                getSequencesOfFive(diagonal).forEach(sequence => {
                    const result = checkConsecutive(sequence, color);
                    if (result.isPattern) {
                        addProtectedPattern(result.patternIndices);
                        game.scores[color]++;
                    }
                });
            });
        }
    };

    ["blue", "red", "green"].forEach(color => checkPatterns(color));
    const winner = Object.keys(game.scores).find(color => game.scores[color] >= 2) || null;
    
    return { winner, game };
}

function checkForWinner(game, cards) {
    return Pattern(game, cards);
}

module.exports = {
    initializeGame,
    handleCardSelection,
    Pattern,
    checkForWinner,
};