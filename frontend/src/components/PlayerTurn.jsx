export default function PlayerTurn({ playerName,opponentName, currentPlayer, playingAs }) {
    return (
      <div className="player-turn-container">
        <div className="score-container transform scale-150 flex flex-col items-center justify-center">
          <div className="current-turn flex items-center mb-4">
            <h2 className="font-bold mr-2">Current Turn:</h2>
            <span className={`font-bold ${currentPlayer === playingAs ? 'text-green-500' : 'text-white-500'}`}>
            {currentPlayer === playingAs ? playerName : opponentName }
          </span>
          </div>
          <div className="player-tokens flex items-center">
          <div className={`token-info flex items-center mr-4 ${currentPlayer === playingAs ? "current-move-" + currentPlayer : "other-move-" + currentPlayer}`}>
          <div>{playerName}</div>
          </div>
          <div className={`token-info flex items-center ${currentPlayer !== playingAs ? "current-move-" + currentPlayer : "other-move-" + currentPlayer}`}>
            <div>{opponentName}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
