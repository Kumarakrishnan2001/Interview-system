import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../assets/loginconfiguration/config";
import { useAuth } from "../context/AuthContext";
import "./Interview.css";

import { generateInterviewQuestions, generateAptitudeQuestions, generateTechnicalQuestions, generateGDTopic, generateHRQuestions } from "../services/geminiService";

export default function Interview() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [interviewType, setInterviewType] = useState("personal"); // personal, technical, aptitude, group-discussion, hr-round
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [experience, setExperience] = useState("");
  const [skills, setSkills] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);

  // GD State
  const [gdTopic, setGdTopic] = useState("");
  const [isGdSetup, setIsGdSetup] = useState(false);
  const [gdStartOption, setGdStartOption] = useState("");

  // HR Round State
  const [selfIntroduction, setSelfIntroduction] = useState("");
  const [isListeningIntro, setIsListeningIntro] = useState(false);
  const introRecognitionRef = useRef(null);

  // Quiz Mode State
  const [quizMode, setQuizMode] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);

  // Camera State
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraPermissionError, setCameraPermissionError] = useState(null);
  const [isInterviewStarted, setIsInterviewStarted] = useState(false); // New state to track if "Start" was clicked
  const [fetchedData, setFetchedData] = useState(null); // Store fetched questions/id

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Cleanup on unmount or navigation
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (introRecognitionRef.current) {
        introRecognitionRef.current.stop();
      }
    };
  }, []);

  // Initialize Speech Recognition for HR Intro
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      introRecognitionRef.current = new SpeechRecognition();
      introRecognitionRef.current.continuous = true;
      introRecognitionRef.current.interimResults = true;

      introRecognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setSelfIntroduction(prev => prev + " " + finalTranscript);
        }
      };

      introRecognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsListeningIntro(false);
      };

      introRecognitionRef.current.onend = () => {
        setIsListeningIntro(false);
      };
    }
  }, []);

  const toggleListeningIntro = () => {
    if (!introRecognitionRef.current) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    if (isListeningIntro) {
      introRecognitionRef.current.stop();
      setIsListeningIntro(false);
    } else {
      introRecognitionRef.current.start();
      setIsListeningIntro(true);
    }
  };


  const handleEnableCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setCameraEnabled(true);
      setCameraPermissionError(null);
    } catch (err) {
      console.error("Camera permission denied:", err);
      setCameraPermissionError("Could not access camera. Please allow camera permissions to proceed.");
      setCameraEnabled(false);
    }
  };

  const handleStartInterview = async (e) => {
    e.preventDefault();

    if (!user) {
      alert("Please login first");
      return;
    }

    setLoading(true);

    try {
      let data = [];
      let interviewData = {
        uid: user.uid,
        email: user.email,
        type: interviewType,
        createdAt: serverTimestamp(),
      };

      // 🔹 1. Call Gemini Service based on type
      if (interviewType === "personal") {
        data = await generateInterviewQuestions(role, description, experience, skills);
        interviewData = { ...interviewData, role, description, experience, skills };

        // Save initial interview data
        const docRef = await addDoc(collection(db, "interviews"), {
          ...interviewData,
          questions: data,
        });

        // Store data and switch to Camera Setup mode instead of navigating
        setFetchedData({
          interviewId: docRef.id,
          qa: data
        });
        setIsInterviewStarted(true); // Show camera setup
        setLoading(false);
        return;

      } else if (interviewType === "group-discussion") {
        const topicData = await generateGDTopic(role);
        interviewData = { ...interviewData, role, topic: topicData.topic };

        // Save initial interview data
        const docRef = await addDoc(collection(db, "interviews"), {
          ...interviewData
        });

        setFetchedData({
          interviewId: docRef.id,
          topic: topicData.topic
        });
        setGdTopic(topicData.topic);
        setIsGdSetup(true); // Show AI/User start options
        setLoading(false);
        return;
      } else if (interviewType === "hr-round") {
        if (!selfIntroduction.trim()) {
          throw new Error("Self introduction cannot be empty.");
        }

        // Ensure mic stops
        if (isListeningIntro && introRecognitionRef.current) {
          introRecognitionRef.current.stop();
          setIsListeningIntro(false);
        }

        data = await generateHRQuestions(selfIntroduction);

        // Save initial interview data
        const docRef = await addDoc(collection(db, "interviews"), {
          ...interviewData,
          selfIntroduction
        });

        setFetchedData({
          interviewId: docRef.id,
          questions: data,
          selfIntroduction
        });

        // Navigate directly to HR Chat
        navigate("/hr-chat", {
          state: {
            interviewId: docRef.id,
            questions: data,
            selfIntroduction
          }
        });
        setLoading(false);
        return;
      } else if (interviewType === "technical") {
        data = await generateTechnicalQuestions(domain);
        interviewData = { ...interviewData, domain };
      } else if (interviewType === "aptitude") {
        data = await generateAptitudeQuestions();
        interviewData = { ...interviewData, topic: "English Vocabulary" };
      }

      if (!data || data.length === 0) {
        throw new Error("No questions returned");
      }

      // 🔹 2. For Technical/Aptitude: Start Quiz Mode locally
      setQuestions(data);
      setQuizMode(true);
      setCurrentQuestionIndex(0);
      setScore(0);
      setShowResult(false);

    } catch (error) {
      console.error("Interview error:", error);
      const errorMessage = error.message || error.toString();
      if (errorMessage.includes("429") || errorMessage.includes("Quota") || errorMessage.includes("quota")) {
        alert("Server is busy (API Rate Limit). Please wait a few moments and try again.");
      } else {
        alert("Interview could not be started. Error: " + errorMessage);
      }
    } finally {
      if (interviewType !== "personal" && interviewType !== "group-discussion") {
        setLoading(false);
      }
    }
  };

  const handleEnterGD = () => {
    if (!gdStartOption) {
      alert("Please select who starts first!");
      return;
    }
    navigate("/gd-chat", {
      state: {
        interviewId: fetchedData.interviewId,
        topic: fetchedData.topic,
        startOption: gdStartOption
      },
    });
  };

  const handleEnterInterview = () => {
    // Stop camera stream before navigating
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    navigate("/chat", {
      state: {
        interviewId: fetchedData.interviewId,
        qa: fetchedData.qa,
        cameraEnabled: cameraEnabled
      },
    });
  };

  const handleAnswerSelect = (option) => {
    setSelectedAnswer(option);
  };


  const [userAnswers, setUserAnswers] = useState({});

  const handleNextQuestion = async () => {
    const currentQ = questions[currentQuestionIndex];

    // Store answer
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: selectedAnswer
    }));

    // Check answer for immediate score update (keep existing logic)
    if (selectedAnswer === currentQ.answer) {
      setScore(prev => prev + 1);
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer("");
    } else {
      await finishQuiz();
    }
  };

  const finishQuiz = async () => {
    // Add final score check for the last question before showing result
    let finalScore = score;
    const currentQ = questions[currentQuestionIndex];

    // Capture the last answer
    const finalUserAnswers = {
      ...userAnswers,
      [currentQuestionIndex]: selectedAnswer
    };

    if (selectedAnswer === currentQ.answer) {
      finalScore += 1;
      setScore(finalScore);
    }

    setLoading(true);
    try {
      // Prepare detailed responses for history preview
      const detailedQuestions = questions.map((q, index) => ({
        question: q.question,
        options: q.options,
        correctAnswer: q.answer,
        userAnswer: finalUserAnswers[index] || null,
        isCorrect: finalUserAnswers[index] === q.answer
      }));

      await addDoc(collection(db, "interviews"), {
        uid: user.uid,
        email: user.email,
        type: interviewType,
        domain: domain || "Aptitude",
        totalScore: finalScore,
        totalQuestions: questions.length,
        questions: detailedQuestions, // Saving full details
        createdAt: serverTimestamp(),
        status: "completed"
      });
      setShowResult(true);
    } catch (error) {
      console.error("Error saving result", error);
      alert("Error saving result");
    } finally {
      setLoading(false);
    }
  };

  if (showResult) {
    return (
      <div className="interview-container result-container">
        <h2>Result</h2>
        <div className="score-display">
          You scored {score} out of {questions.length}
        </div>
        <button className="btn-primary" onClick={() => window.location.reload()}>Take Another Interview</button>
        <button className="btn-primary" onClick={() => navigate("/")}>Go Home</button>
      </div>
    );
  }

  if (quizMode) {
    const currentQ = questions[currentQuestionIndex];
    return (
      <div className="interview-container quiz-container">
        <div className="quiz-header">
          <h3 style={{ color: "#ffffffff" }}>Question {currentQuestionIndex + 1} / {questions.length}</h3>
          <span className="quiz-type">{interviewType.toUpperCase()}</span>
        </div>

        <div className="question-card">
          <p className="question-text">{currentQ.question}</p>

          <div className="options-list">
            {currentQ.options.map((option, idx) => (
              <label key={idx} className={`option-item ${selectedAnswer === option ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="quiz-option"
                  value={option}
                  checked={selectedAnswer === option}
                  onChange={() => handleAnswerSelect(option)}
                />
                <span className="option-text">{option}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={handleNextQuestion}
          disabled={!selectedAnswer}
        >
          {currentQuestionIndex === questions.length - 1 ? "Finish" : "Next"}
        </button>
      </div>
    );
  }

  return (
    <div className="interview-container">
      <h2 className="interview-title">AI Interview Setup</h2>

      <div className="interview-tabs">
        <button
          className={interviewType === "personal" ? "active" : ""}
          onClick={() => setInterviewType("personal")}
          disabled={loading || isInterviewStarted}
        >
          Personalized
        </button>
        <button
          className={interviewType === "technical" ? "active" : ""}
          onClick={() => setInterviewType("technical")}
          disabled={loading || isInterviewStarted}
        >
          Technical Aptitude
        </button>
        <button
          className={interviewType === "aptitude" ? "active" : ""}
          onClick={() => setInterviewType("aptitude")}
          disabled={loading || isInterviewStarted}
        >
          Aptitude (English)
        </button>
        <button
          className={interviewType === "group-discussion" ? "active" : ""}
          onClick={() => setInterviewType("group-discussion")}
          disabled={loading || isInterviewStarted || isGdSetup}
        >
          Group Discussion
        </button>
        <button
          className={interviewType === "hr-round" ? "active" : ""}
          onClick={() => setInterviewType("hr-round")}
          disabled={loading || isInterviewStarted}
        >
          HR Round
        </button>
      </div>

      <form className="interview-form" onSubmit={handleStartInterview}>

        {interviewType === "hr-round" && !isInterviewStarted && (
          <div className="hr-setup-section">
            <label>Self Introduction</label>
            <p className="info-text" style={{ marginBottom: "10px", color: "#fdfaf9" }}>
              Please provide a brief self-introduction. The AI HR will ask questions based on this.
            </p>
            <textarea
              placeholder="Hi, I am a software engineer with 2 years of experience... Or use the mic to speak."
              value={selfIntroduction}
              onChange={(e) => setSelfIntroduction(e.target.value)}
              required
              rows={5}
              disabled={isListeningIntro || loading}
              style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #f1ebebff", marginBottom: "10px", backgroundColor: "#f1ebebff", color: "#1a1818" }}
            />
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className={`btn-mic ${isListeningIntro ? 'listening' : ''}`}
                onClick={toggleListeningIntro}
                disabled={loading}
                style={{ padding: "10px", borderRadius: "5px", cursor: "pointer" }}
              >
                {isListeningIntro ? "🛑 Stop Audio" : "🎤 Voice Input"}
              </button>
            </div>
          </div>
        )}

        {(interviewType === "personal" || interviewType === "group-discussion") && !isGdSetup && !isInterviewStarted && (
          <>
            <label>Job Role</label>
            <input
              type="text"
              placeholder="Software Developer"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              disabled={isInterviewStarted || isGdSetup}
            />

            {/* Extra inputs for personal */}
            {interviewType === "personal" && (
              <>
                <label>Job Description</label>
                <textarea
                  placeholder="Describe the role..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  disabled={isInterviewStarted}
                />

                <label>Years of Experience</label>
                <input
                  type="number"
                  placeholder="2"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  required
                  disabled={isInterviewStarted}
                />

                <label>Skills</label>
                <input
                  type="text"
                  placeholder="React, JavaScript, Firebase"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  required
                  disabled={isInterviewStarted}
                />
              </>
            )}

          </>
        )}

        {/* Camera Setup Section for Personal - Only Visible After Start Clicked */}
        {interviewType === "personal" && isInterviewStarted && (
          <div className="camera-setup active">
            <h3>Camera Setup</h3>
            <p>Please enable your camera to proceed with the interview.</p>

            {cameraPermissionError && <p className="error-text">{cameraPermissionError}</p>}

            <div className="video-preview-box">
              {cameraEnabled ? (
                <div className="video-wrapper">
                  <video ref={videoRef} autoPlay playsInline muted className="preview-video"></video>
                  <div className="video-overlay">Camera Active</div>
                </div>
              ) : (
                <div className="video-placeholder">Camera Off</div>
              )}
            </div>

            <div className="camera-controls">
              {!cameraEnabled ? (
                <button type="button" className="btn-secondary" onClick={handleEnableCamera}>
                  Enable Camera
                </button>
              ) : (
                <button type="button" className="btn-primary" onClick={handleEnterInterview}>
                  Enter Interview Room
                </button>
              )}
            </div>
          </div>
        )}

        {/* GD Setup Section */}
        {interviewType === "group-discussion" && isGdSetup && (
          <div className="gd-setup-active">
            <h3>Discussion Topic:</h3>
            <div className="gd-topic-box">
              <p><strong style={{ color: "#eee7e7ff" }}>{gdTopic}</strong></p>
            </div>

            <div className="gd-start-options">
              <h4 style={{ color: "#6058d1ff" }}>Who should start first?</h4>
              <div className="options-list">
                <label className={`option-item ${gdStartOption === 'ai' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="gd-start"
                    value="ai"
                    checked={gdStartOption === 'ai'}
                    onChange={() => setGdStartOption('ai')}
                  />
                  <span className="option-text">AI Start First</span>
                </label>
                <label className={`option-item ${gdStartOption === 'user' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="gd-start"
                    value="user"
                    checked={gdStartOption === 'user'}
                    onChange={() => setGdStartOption('user')}
                  />
                  <span className="option-text">User Start First</span>
                </label>
              </div>
            </div>

            <button type="button" className="btn-primary" onClick={handleEnterGD}>
              Enter Discussion Room
            </button>
          </div>
        )}

        {interviewType === "technical" && (
          <>
            <label>Select Domain</label>
            <br />
            <select className="btn-primary"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              required
            >
              <option value="">Select a Domain</option>
              <option value="React">React</option>
              <option value="Node.js">Node.js</option>
              <option value="Python">Python</option>
              <option value="Java">Java</option>
              <option value="C++">C++</option>
              <option value="SQL">SQL</option>
              <option value="Data Structures">Data Structures</option>
            </select>
            <p className="info-text" style={{ color: "#fdfaf9" }}>You will face 5 multiple-choice questions.</p>
          </>
        )}

        {interviewType === "aptitude" && (
          <div className="aptitude-info">
            <p>This will generate 5 English Vocabulary questions to test your verbal ability.</p>
            <p className="info-text">Format: Multiple Choice Questions.</p>
          </div>
        )}

        {!isInterviewStarted && !isGdSetup && (
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Preparing Interview..." : "Start Interview"}
          </button>
        )}
      </form>
    </div>
  );
}
