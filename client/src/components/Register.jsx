import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { auth, googleProvider } from "../assets/loginconfiguration/config";
import "./Register.css";

export default function Register({ onClose, onSwitchToLogin }) {

  const registerUser = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;

    try {
      // 1️⃣ Create account
      await createUserWithEmailAndPassword(auth, email, password);

      // 2️⃣ FORCE LOGOUT (IMPORTANT)
      await signOut(auth);

      // 3️⃣ Close register & open login
      onClose();
      onSwitchToLogin();

    } catch (error) {
      alert(error.message);
    }
  };

  const registerWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
    onClose(); // Google login can auto-login
  };

  return (
    <div className="login-overlay">
      <div className="register-box">
        <h2>Create Account</h2>

        <form onSubmit={registerUser}>
          <input name="email" type="email" placeholder="Email" required />
          <input name="password" type="password" placeholder="Password" required />

          <button type="submit" className="register-btn">
            Register
          </button>
        </form>

        <div className="or">OR</div>

        <button className="google-btn" onClick={registerWithGoogle}>
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" />
          Register with Google
        </button>

        <p className="switch-text">
          Already have an account?{" "}
          <span onClick={onSwitchToLogin}>Login</span>
        </p>
      </div>
    </div>
  );
}
