import {
  signInWithEmailAndPassword,
  signInWithPopup
} from "firebase/auth";
import { auth, googleProvider } from "../assets/loginconfiguration/config";
import "./Login.css";

export default function Login({ onClose, onSwitchToRegister }) {

  const handleLogin = async (e) => {
    e.preventDefault();

    const email = e.target.email.value;
    const password = e.target.password.value;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      onClose(); // close modal after successful login
    } catch (error) {
      alert(error.message);
    }
  };

  const googleLogin = async () => {
    await signInWithPopup(auth, googleProvider);
    onClose();
  };

  return (
    <div className="login-overlay">
      <div className="login-box">
        <h2>Login</h2>

        <form onSubmit={handleLogin}>
          <input name="email" type="email" placeholder="Email" required />
          <input
            name="password"
            type="password"
            placeholder="Password"
            required
          />

          <button type="submit" className="login-btn">
            Login
          </button>
        </form>

        <div className="or"></div>

        <button className="google-btn" onClick={googleLogin}>
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" />
          Login with Google
        </button>

        <p className="switch-text">
          New user?{" "}
          <span onClick={onSwitchToRegister}>Create account</span>
        </p>
      </div>
    </div>
  );
}
