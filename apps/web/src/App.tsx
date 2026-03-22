import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from '@/pages/home-page';
import { BoardPage } from '@/pages/board-page';
import { TreeLogin } from '@/pages/login-page';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/board/:category" element={<BoardPage />} />
        <Route path="/login" element={<TreeLogin />} />
      </Routes>
    </BrowserRouter>
  );
}
