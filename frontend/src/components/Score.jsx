import React from 'react';

const ScoreComponent = ({ redScore, blueScore }) => {
  return (
    <div className="score-container transform scale-150 sm:scale-100 sm:p-4 p-2">
      <div className="mb-1 flex justify-between items-center border-b border-gray-600 pb-1">
        <span className="font-bold">Goal:</span>
        <span>{2}</span>
      </div>
      <div className="flex justify-between items-center">
        <div className="mr-2 text-center">
          <div className="text-red-500 font-bold">Red</div>
          <div className="text-center">{redScore}</div>
        </div>
        <div className="ml-2 text-center">
          <div className="text-blue-500 font-bold">Blue</div>
          <div className="text-center">{blueScore}</div>
        </div>
      </div>
    </div>
  );
};

export default ScoreComponent;
