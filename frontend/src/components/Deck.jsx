import React from 'react';

export default function Deck({ deckCount }) {
    return (
        <>
      <div className="shuffled-deck-container">
        <div className="flex -space-x-8">
          {[...Array(4)].map((_, index) => (
            <img
              key={index}
              src="../assests/1B.svg"
              alt="Card Back"
              className={`w-14 h-24 ${index > 0 ? '-ml-8' : ''}`}
            style={{ zIndex: 4 - index }} 
            />
          ))}
        </div>
        <p className="deck-count text-sm bg-white p-2 rounded-full text-gray-700 font-bold shadow-md hover:shadow-xl transition duration-500 ease-in-out">
          Deck Count: {deckCount}</p>
      </div>
      </>
    );
  }