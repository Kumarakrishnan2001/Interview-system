import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../assets/loginconfiguration/config";
import { useNavigate, useLocation } from "react-router-dom";
import "./Navbar.css";
import logo from "../assets/logo.png";

export default function Navbar({ onLoginClick }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const logout = async () => {
    await signOut(auth);
  };

  const scrollToAbout = () => {
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => {
        document
          .getElementById("about-interview")
          ?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    } else {
      document
        .getElementById("about-interview")
        ?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <nav className="navbar">

      <div className="logo" onClick={() => navigate("/")}>
        AI-Interview
      </div>

      <button
        className={`menu-toggle ${menuOpen ? "open" : ""}`}
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label="Toggle menu"
        aria-expanded={menuOpen}
      >
        <span />
        <span />
        <span />
      </button>

      <ul className={`nav-links ${menuOpen ? "open" : ""}`}>
        <li
          className={`lio ${location.pathname === "/" ? "active" : ""}`}
          onClick={() => {
            scrollToAbout();
            setMenuOpen(false);
          }}
        >
          About
        </li>

        <li
          className={`${!user ? "disabled" : "lio"} ${location.pathname === "/interview" ? "active" : ""}`}
          onClick={() => {
            if (user) navigate("/interview");
            setMenuOpen(false);
          }}
        >
          Interview
        </li>

        <li
          className={`${!user ? "disabled" : "lio"} ${location.pathname === "/history" ? "active" : ""}`}
          onClick={() => {
            if (user) navigate("/history");
            setMenuOpen(false);
          }}
        >
          History
        </li>

        {!user ? (
          <li
            className="login-btn"
            onClick={() => {
              onLoginClick();
              setMenuOpen(false);
            }}
          >
            Login
          </li>
        ) : (
          <li className="profile">
            <img
              src={
                user.photoURL ||
                "https://ui-avatars.com/api/?name=User&background=0D8ABC&color=fff"
              }
              alt="profile"
            />
            <span>{user.email}</span>
            <button className="i" onClick={logout}>Logout</button>
          </li>
        )}
      </ul>
    </nav>
  );
}
