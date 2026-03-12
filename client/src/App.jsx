import { Routes, Route, useLocation } from "react-router-dom";
import { useState } from "react";

import Navbar from "./components/Navbar";
import Home from "./components/Home";
import Interview from "./components/Interview";
import InterviewChat from "./components/InterviewChat"; // ✅ FIX
import GroupDiscussionChat from "./components/GroupDiscussionChat";
import HrRoundChat from "./components/HrRoundChat";
import History from "./components/History";
import Login from "./components/Login";
import Register from "./components/Register";

import { useAuth } from "./context/AuthContext";

function App() {
  const location = useLocation();
  const { user } = useAuth();

  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const hideNavbar = location.pathname === "/interview" || location.pathname === "/chat" || location.pathname === "/hr-chat" || location.pathname === "/gd-chat" || location.pathname === "/history";

  return (
    <>
      {!hideNavbar && (
        <Navbar onLoginClick={() => setShowLogin(true)} />
      )}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/interview"
          element={user ? <Interview /> : <Home />}
        />
        <Route
          path="/chat"
          element={user ? <InterviewChat /> : <Home />}
        />
        <Route
          path="/gd-chat"
          element={user ? <GroupDiscussionChat /> : <Home />}
        />
        <Route
          path="/hr-chat"
          element={user ? <HrRoundChat /> : <Home />}
        />
        <Route
          path="/history"
          element={user ? <History /> : <Home />}
        />
      </Routes>

      {showLogin && (
        <Login
          onClose={() => setShowLogin(false)}
          onSwitchToRegister={() => {
            setShowLogin(false);
            setShowRegister(true);
          }}
        />
      )}

      {showRegister && (
        <Register
          onClose={() => setShowRegister(false)}
          onSwitchToLogin={() => {
            setShowRegister(false);
            setShowLogin(true);
          }}
        />
      )}
    </>
  );
}

export default App;
