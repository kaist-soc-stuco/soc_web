import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from '@/pages/home-page';
import { BoardPage } from '@/pages/board-page';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/board/:category" element={<BoardPage />} />
      </Routes>
    </BrowserRouter>
  );
}
