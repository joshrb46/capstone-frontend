import { createContext, useContext, useState } from "react";
import { api } from "../lib/api";
import { disconnectSocket } from "../lib/socket";

const AuthContext = createContext();

/**
 * The backend has no password / JWT auth (see backend README). A "user" is
 * created once by picking a username + avatar via POST /users, which
 * returns a session_token that must be sent back as the x-session-token
 * header on every later request/socket connection. We persist the whole
 * user object (not just a token) in sessionStorage so a page refresh
 * doesn't lose who you are mid-lobby/mid-game.
 */
function loadStoredUser() {
  try {
    const raw = sessionStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadStoredUser);

  function persist(nextUser) {
    setUser(nextUser);
    if (nextUser) sessionStorage.setItem("user", JSON.stringify(nextUser));
    else sessionStorage.removeItem("user");
  }

  /** Creates a new user. avatarType: 'preset' | 'custom'. */
  const register = async ({ username, avatarType, avatarValue }) => {
    const newUser = await api.post("/users", {
      username,
      avatarType,
      avatarValue,
    });
    persist(newUser);
    return newUser;
  };

  const logout = () => {
    disconnectSocket();
    persist(null);
  };

  const value = {
    user,
    sessionToken: user?.session_token ?? null,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw Error("useAuth must be used within an AuthProvider");
  return context;
}
