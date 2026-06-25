import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import Landing from "./pages/Landing";
import LobbyCreate from "./pages/LobbyCreate";
import LobbyJoin from "./pages/LobbyJoin";
import Game from "./pages/Game";
import Results from "./pages/Results";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/lobby/create"
            element={
              <Protected>
                <LobbyCreate />
              </Protected>
            }
          />
          <Route
            path="/lobby/join/:code"
            element={
              <Protected>
                <LobbyJoin />
              </Protected>
            }
          />
          <Route
            path="/game/:code"
            element={
              <Protected>
                <Game />
              </Protected>
            }
          />
          <Route
            path="/results/:code"
            element={
              <Protected>
                <Results />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
