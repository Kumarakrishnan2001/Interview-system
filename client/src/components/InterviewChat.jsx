import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { evaluateAnswer } from "../services/geminiService";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../assets/loginconfiguration/config";
import "./InterviewChat.css";

const InterviewChat = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const { qa, interviewId, cameraEnabled } = location.state || {};

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState("");
    const [loading, setLoading] = useState(false);
    const [totalScore, setTotalScore] = useState(0);
    const [feedback, setFeedback] = useState(null); // To show feedback after answer
    const [isListening, setIsListening] = useState(false);
    const [interviewComplete, setInterviewComplete] = useState(false);

    // Speech Recognition Setup
    const recognitionRef = useRef(null);

    // Camera Setup
    const videoRef = useRef(null);
    const canvasRef = useRef(null); // Hidden canvas for capture
    const streamRef = useRef(null);

    useEffect(() => {
        if (!qa || !qa.length) {
            if (!location.state) {
                navigate("/interview");
            }
        }

        // Initialize Speech Recognition
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;

            recognitionRef.current.onresult = (event) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    }
                }
                // Append to existing answer or set it
                if (finalTranscript) {
                    setUserAnswer(prev => prev + " " + finalTranscript);
                }
            };

            recognitionRef.current.onerror = (event) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
            };

            recognitionRef.current.onend = () => {
                // Auto-restart if we think it should be listening? No, manual toggle is better.
                if (isListening) {
                    // Optionally restart
                } else {
                    setIsListening(false);
                }
            };
        }

        // Initialize Camera if enabled
        const startCamera = async () => {
            if (cameraEnabled) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    streamRef.current = stream;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                } catch (err) {
                    console.error("Error accessing camera in Chat:", err);
                    alert("Could not access camera. Please check permissions.");
                }
            }
        };

        startCamera();

        // Cleanup function to stop stream
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };

    }, [qa, navigate, location.state, cameraEnabled]);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert("Speech recognition not supported in this browser.");
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    const captureImage = () => {
        if (cameraEnabled && videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            // Set canvas dimensions to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Draw
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Get data URL (image/jpeg for smaller size)
            return canvas.toDataURL('image/jpeg', 0.7);
        }
        return null; // No image
    };

    const handleSubmitAnswer = async () => {
        if (!userAnswer.trim()) return;
        setLoading(true);
        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        }

        const currentQ = qa[currentQuestionIndex];

        // Capture image before processing
        const capturedImage = captureImage();

        try {
            const evaluation = await evaluateAnswer(
                currentQ.question,
                userAnswer,
                currentQ.answer
            );

            const score = evaluation.score || 0;
            setTotalScore(prev => prev + score);
            setFeedback({
                score: score,
                text: evaluation.feedback
            });

            // Save to Firebase
            if (interviewId) {
                const interviewRef = doc(db, "interviews", interviewId);
                await updateDoc(interviewRef, {
                    responses: arrayUnion({
                        question: currentQ.question,
                        userAnswer: userAnswer,
                        aiFeedback: evaluation.feedback,
                        score: score,
                        timestamp: new Date().toISOString(),
                        capturedImage: capturedImage // Save the base64 string (might be large, but fulfills requirement)
                    })
                });
            }

        } catch (error) {
            console.error("Evaluation error", error);
            alert("Error evaluating answer. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleNextQuestion = async () => {
        setFeedback(null);
        setUserAnswer("");

        if (currentQuestionIndex < qa.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            finishInterview();
        }
    };

    const finishInterview = async () => {
        setInterviewComplete(true);
        // Final Firebase Update
        if (interviewId) {
            try {
                const interviewRef = doc(db, "interviews", interviewId);
                // Note: totalScore state might lag one render if we just updated it, 
                // but since we are in handleNextQuestion flow which is triggered by user
                // clicking 'Next' AFTER handleSubmitAnswer set the score, it should be fine.
                // Actually safer to pass current total in finishInterview or rely on state if enough time passed.
                // Let's rely on state.
                await updateDoc(interviewRef, {
                    totalScore: totalScore,
                    status: "completed"
                });
            } catch (e) {
                console.error("Error saving final score", e);
            }
        }
    };

    if (!qa) return <div>Loading...</div>;

    if (interviewComplete) {
        return (
            <div className="interview-container final-screen">
                <h2>Interview Completed!</h2>
                <div className="score-card">
                    <h3>Total Score</h3>
                    <div className="score-big">{totalScore} / {qa.length * 10}</div>
                </div>
                <button className="btn-primary" onClick={() => navigate("/")}>
                    Return to Home
                </button>
            </div>
        );
    }

    const currentQ = qa[currentQuestionIndex];

    return (
        <div className="interview-container chat-redesign">

            {/* Camera Preview */}
            {cameraEnabled && (
                <div className="video-container">
                    <video ref={videoRef} autoPlay playsInline muted className="chat-video"></video>
                </div>
            )}
            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

            <div className="progress-bar">
                Step {currentQuestionIndex + 1} of {qa.length}
            </div>

            <div className="question-card">
                <h3>Question {currentQuestionIndex + 1}</h3>
                <p className="question-text">{currentQ.question}</p>
            </div>

            {!feedback ? (
                <div className="answer-section">
                    <textarea
                        className="answer-input"
                        placeholder="Type your answer or use the microphone..."
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        disabled={loading}
                    />

                    <div className="controls">
                        <button
                            className={`btn-mic ${isListening ? 'listening' : ''}`}
                            onClick={toggleListening}
                            disabled={loading}
                        >
                            {isListening ? "🛑 Stop Recording" : "🎤 Start Recording"}
                        </button>

                        <button
                            className="btn-submit"
                            onClick={handleSubmitAnswer}
                            disabled={loading || !userAnswer.trim()}
                        >
                            {loading ? "Evaluating..." : "Submit Answer"}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="feedback-section">
                    <div className={`feedback-card ${feedback.score >= 5 ? 'good' : 'poor'}`}>
                        <h4>Score: {feedback.score} / 10</h4>
                        <p>{feedback.text}</p>
                    </div>
                    <button className="btn-primary btn-next" onClick={handleNextQuestion}>
                        {currentQuestionIndex < qa.length - 1 ? "Next Question" : "Finish Interview"}
                    </button>
                </div>
            )}
        </div>
    );
};

export default InterviewChat;
