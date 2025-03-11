import { useState } from 'react';
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Boards from './components/Board';

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Boards />} />
        <Route path="/room/:roomId" element={<Boards />} />
      </Routes>
      </BrowserRouter>
  );
}

export default App