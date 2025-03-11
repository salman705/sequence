const allCards = require('./data/allCards.js');
exports.deepClone = function(allCards) {
    let filteredCards = allCards.filter(card => card.id <= 100);
    return JSON.parse(JSON.stringify(filteredCards));
};