import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import Landing from "./pages/Landing";
import Lobby from "./pages/Lobby";
import Game from "./pages/Game";
import Podium from "./pages/Podium";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/lobby/:code" element={<Lobby />} />
          <Route path="/game/:code/:matchId" element={<Game />} />
          <Route path="/podium/:code/:matchId" element={<Podium />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
