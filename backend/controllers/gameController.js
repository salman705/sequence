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
    const remainingDeck = initialDeck.slice(10);

    games = {
        players: {
            player1: { hand: player1InitialHand, isTurn: true, socketId: null , name: null },
            player2: { hand: player2InitialHand, isTurn: false, socketId: null , name: null},
        },
        scores: {
            red: 0,
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
    let cardIndex = cardId - 1; // cardId starts from 1 and maps directly to the index by subtracting 1
    let currentPlayer = currentTurn === 'player1' ? 'player1' : 'player2';
    let nextPlayer = currentPlayer === 'player1' ? 'player2' : 'player1';
    let playerHand = game.players[currentPlayer].hand;
    let cardInQuestion = game.cards[cardIndex];

    const isCardProtected = (cardIndex, protectedPatterns) => {
        return protectedPatterns.includes(cardIndex);
    }

    if (selectedCard > 100 && selectedCard <= 104) {
        cardInQuestion.selected = "True";
        cardInQuestion.selectedby = currentPlayer == "player1" ? "blue" : "red";
    }
    else if (selectedCard > 104 && selectedCard <= 108 && cardInQuestion.selected === "True") {
        if (!isCardProtected(cardInQuestion, game.protectedPatterns)) {
            cardInQuestion.selected = false;
            cardInQuestion.selectedby = "";
        }
        else {
            return { success: false, message: "Wrong move: Card is protected." };
        }
    }
    else {
        cardInQuestion.selected = "True";
        cardInQuestion.selectedby = currentPlayer == "player1" ? "blue" : "red";
    }

    let indexToRemove = playerHand.findIndex(
        (card) => card.id === cardId || (selectedCard > 100 && selectedCard < 109 && card.id === selectedCard) || (card.matches && card.matches.includes(cardId))
    );
    playerHand.splice(indexToRemove, 1);
    if (shuffledDeck.length > 0) {
        let newCard = shuffledDeck.shift();
        playerHand.push(newCard);
    }

    game.players[currentPlayer].isTurn = false;
    game.players[nextPlayer].isTurn = true;
    game.players[currentPlayer].hand = playerHand;

    return (player = { success: true, game, shuffledDeck, cards, currentPlayer, nextPlayer, playerHand });
}

function Pattern(game, cards) {
    let board = Array(10).fill(null).map(() => Array(10).fill({ color: null, isPartOfPattern: false, index: -1 }));
    game.protectedPatterns = game.protectedPatterns || [];
    const cornerIndices = [1, 10, 91, 100];

    const getPositionFromId = (id) => {
        let row = Math.floor((id - 1) / 10);
        let col = (id - 1) % 10;
        return { row, col };
    };

    if (Array.isArray(cards)) {
        cards.forEach((card) => {
            if (card.selected === "True") {
                const { row, col } = getPositionFromId(card.id);
                board[row][col] = { color: card.selectedby, isPartOfPattern: false, index: card.id };
            }

        });
    }

    const isCornerIndex = (index) => cornerIndices.includes(index);

    const checkConsecutive = (arr, color) => {
        let count = 0;
        let patternIndices = [];
        for (let i = 0; i < arr.length; i++) {
            let cell = arr[i];
            let effectiveColor = cell.color || (isCornerIndex(cell.index) ? color : null);
            if (effectiveColor == color) {
                count++;
                patternIndices.push(cell.index);
                if (count >= 5) {
                    console.log(patternIndices);
                    if (isPatternNew(patternIndices)) {
                        return { isPattern: true, patternIndices };
                    }
                }
            } else {
                count = 0;
                patternIndices = [];
            }
        };
        return { isPattern: false, patternIndices: [] };
    };

    const isPatternNew = (patternIndices) => {
        let existingPatterns = game.protectedPatterns || [];
        //if the new pattern is entirely new
        let isEntirelyNew = !existingPatterns.some(pattern =>
            patternIndices.every(index => pattern.includes(index))
        );
        //for overlap with existing protected patterns, allowing up to one card ID overlap
        let isValidOverlap = existingPatterns.map(pattern =>
            patternIndices.filter(index => pattern.includes(index)).length
        ).every(count => count <= 1);

        return isEntirelyNew && isValidOverlap;
    };

    const addProtectedPattern = (pattern) => {
        game.protectedPatterns = game.protectedPatterns || [];
        game.protectedPatterns.push(pattern);
    };

    const checkPatterns = (color) => {
        const getSequencesOfFive = (arr) => {
            let sequences = [];
            for (let i = 0; i <= arr.length - 5; i++) {
                sequences.push(arr.slice(i, i + 5));
            }
            return sequences;
        };

        const getDownRightDiagonal = (startRow, startCol) => {
            let cells = [];
            for (let i = 0; startRow + i < 10 && startCol + i < 10; i++) {
                cells.push({ ...board[startRow + i][startCol + i], index: (startRow + i) * 10 + startCol + i + 1 }); // Adjusted index to match card IDs
            }
            return cells;
        };

        const getUpRightDiagonal = (startRow, startCol) => {
            let cells = [];
            for (let i = 0; startRow - i >= 0 && startCol + i < 10; i++) {
                cells.push({ ...board[startRow - i][startCol + i], index: (startRow - i) * 10 + startCol + i + 1 }); // Adjusted index to match card IDs
            }
            return cells;
        };

        const getDiagonals = (board, getDiagonalCells) => {
            let diagonals = [];
            for (let row = 0; row < 10; row++) {
                for (let col = 0; col < 10; col++) {
                    let diagonalCells = getDiagonalCells(row, col, board);
                    if (diagonalCells.length >= 5) {
                        diagonals.push(diagonalCells);
                    }
                }
            }
            return diagonals;
        };

        const allDiagonals = [
            ...getDiagonals(board, getDownRightDiagonal),
            ...getDiagonals(board, getUpRightDiagonal)
        ];

        allDiagonals.forEach(diagonal => {
            getSequencesOfFive(diagonal).forEach(sequence => {
                let result = checkConsecutive(sequence, color);
                if (result.isPattern && isPatternNew(result.patternIndices)) {
                    addProtectedPattern(result.patternIndices);
                    game.scores[color] += 1; // Increment score for new diagonal patterns
                }
            });
        });

        for (let i = 0; i < 10; i++) {

            let row = board[i].map((cell, index) => ({ ...cell, index: i * 10 + index + 1 }));
            getSequencesOfFive(row).forEach(sequence => {
                let rowResult = checkConsecutive(sequence, color);
                if (rowResult.isPattern && isPatternNew(rowResult.patternIndices)) {
                    addProtectedPattern(rowResult.patternIndices);
                    game.scores[color] += 1; // Increment score here for new horizontal patterns
                }
            });

            let col = board.map((_, rowIndex) => board[rowIndex][i]).map((cell, index) => ({ ...cell, index: index * 10 + i + 1 }));
            getSequencesOfFive(col).forEach(sequence => {
                let colResult = checkConsecutive(sequence, color);
                if (colResult.isPattern && isPatternNew(colResult.patternIndices)) {
                    addProtectedPattern(colResult.patternIndices);
                    game.scores[color] += 1; // Increment score here for new vertical patterns
                }
            });
        }
    };

    ["blue", "red"].forEach(color => checkPatterns(color));
    let winner = Object.keys(game?.scores || {}).find(color => game.scores[color] === 2) || null;
    return (result = { winner, game });
}

function checkForWinner(game, cards) {
    let result = Pattern(game, cards);
    return result;
}

module.exports = {
    initializeGame,
    handleCardSelection,
    Pattern,
    checkForWinner,
};
