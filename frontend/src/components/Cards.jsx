import { useState } from "react"

export default function Cards({roomId, socket,selectCard, cards,hoveredCard,playingAs,currentPlayer}){

    function handleClick(cardId,selectCard,socket,card){
        let card_matches = card.matches;
        let validMove = false;
        if (selectCard > 100 && selectCard <= 104 && ![1, 10, 91, 100].includes(cardId) && !card.selected) {
            validMove = true;
        }
        else if (selectCard > 104 && selectCard <= 108 && card.selected) {
            validMove = true;
        }

        else if (card_matches.includes(selectCard) && !card.selected) {
            validMove = true;
        }

       if (playingAs === currentPlayer && validMove) {
            socket?.emit('Boardcardclicked', { roomId, cardId: cardId, selectedCard: selectCard  });
        }
        else{
            alert('Invalid move! This action is not allowed.');
        }
    }
      
    return (
        <>
        <div className="inner-container">
             {cards.map((card) => (
               <div key={card.id} className={`card ${hoveredCard.includes(card.id) ? 'highlighted' : ''}`} 
               onClick={() => handleClick(card.id, selectCard,socket,card)}>
                   {card.img && <img src={card.img} alt={`Card ${card.id}`} />} 
                   {card.selected && (
                    <div className={`poker-chip-${card.selectedby === "red" ? "red" : "blue"} absolute`}></div>
                    )}
                </div>
            ))}
        </div>
        </>
    )
    }