import aiImage from "../assets/AI-img.webp";
import "./Home.css";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";



export default function Home({ onStartInterview }) {

  // ✅ HOOK MUST BE INSIDE COMPONENT
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      {/* HERO SECTION */}
      <section className="home">
        <div className="home-text">
          <h1>AI interview practice built for your dream role</h1>
          <p>
            Practice real interview questions powered by AI.
            Improve confidence, communication, and technical skills.
          </p>

          <button
            className={`start-btn ${!user ? "btn-disabled" : ""}`}
            disabled={!user}
            onClick={() => {
              if (user) {
                navigate("/interview"); // 🔥 GO TO INTERVIEW PAGE
              }
            }}
          >
            Start Interview
          </button>


          {!user && (
            <p style={{ marginTop: "10px", color: "#c24463" }}>
              Please login to start the interview
            </p>
          )}
        </div>

        <div className="home-image">
          {/* <img src={aiImage} alt="AI Interview System" /> */}
        </div>
      </section>

      <section className="feature-grid-wrap" id="about-interview">
        <h2>Core Interview Modules</h2>
        {/* <p className="section-subtitle">
          Designed for complete preparation from personalized technical rounds to HR communication.
        </p> */}
        <div className="feature-grid">
          <article className="feature-card">
            <span className="feature-icon">PI</span>
            <h3>Personalized</h3>
            <p>Role-based question generation using your job description, experience, and skills.</p>
          </article>
          <article className="feature-card">
            <span className="feature-icon">TA</span>
            <h3>Technical Aptitude</h3>
            <p>Domain-focused MCQ assessment across core engineering and problem-solving topics.</p>
          </article>
          <article className="feature-card">
            <span className="feature-icon">EN</span>
            <h3>Aptitude (English)</h3>
            <p>Practice vocabulary reasoning, language comprehension, and verbal confidence.</p>
          </article>
          <article className="feature-card">
            <span className="feature-icon">GD</span>
            <h3>Group Discussion</h3>
            <p>Structured AI conversation simulation for argument quality and clarity.</p>
          </article>
          <article className="feature-card">
            <span className="feature-icon">HR</span>
            <h3>HR Round</h3>
            <p>Behavioral and communication-focused interview practice with scored feedback.</p>
          </article>
        </div>
      </section>

      {/* ABOUT INTERVIEW SECTION */}
      <section id="about-interview" className="about-interview">
        <h2>About the AI Interview</h2>

        <p>
          The AI Interview System is designed to help you prepare for real-world
          job interviews in a simple and effective way.
        </p>

        <div className="about-steps">
          <div className="step">
            <span>1</span>
            <p>
              Click on <strong>Start Interview</strong>
            </p>
          </div>

          <div className="step">
            <span>2</span>
            <p>
              Enter your <strong>Job Title</strong> and choose
              <strong> Frontend </strong> or <strong> Backend</strong>
            </p>
          </div>

          <div className="step">
            <span>3</span>
            <p>
              Provide a short <strong>Job Description</strong>
              so the AI understands your role
            </p>
          </div>

          <div className="step">
            <span>4</span>
            <p>
              Click <strong>Start Interview</strong> and begin answering
              AI-generated interview questions
            </p>
          </div>
        </div>
      </section>
      {/* FOOTER */}
      <footer className="footer">
        <p>&copy; 2026 AI Interview System. All rights reserved.    <span style={{ marginLeft: "150px" }}>Contact: [+91 9797577273]</span><span style={{ marginLeft: "300px" }}> Email: [EMAIL_AI@gmail.com]</span></p>
      </footer>
    </>
  );
}
