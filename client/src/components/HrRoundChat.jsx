import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { evaluateHRInterview } from "../services/geminiService";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../assets/loginconfiguration/config";
import "./HrRoundChat.css";

const HrRoundChat = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const { questions, interviewId, selfIntroduction } = location.state || {};

    const [conversation, setConversation] = useState([]); // { speaker: 'AI' | 'User', text: string }
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userInput, setUserInput] = useState("");
    const [isListening, setIsListening] = useState(false);

    // Evaluation state
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [result, setResult] = useState(null);

    // Refs
    const recognitionRef = useRef(null);
    const hasStartedRef = useRef(false);
    const isUnmountedRef = useRef(false);

    useEffect(() => {
        isUnmountedRef.current = false;

        if (!questions || !questions.length) {
            navigate("/interview");
            return;
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
                if (finalTranscript) {
                    setUserInput(prev => prev + " " + finalTranscript);
                }
            };

            recognitionRef.current.onerror = (event) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
            };

            recognitionRef.current.onend = () => {
                if (!isUnmountedRef.current) {
                    setIsListening(false);
                }
            };
        }

        // Initial AI Start - Ask the first question
        if (!hasStartedRef.current) {
            hasStartedRef.current = true;

            // Add the initial self-introduction context invisibly or explicitly to the transcript
            // We'll just start by asking the first question
            setTimeout(() => {
                if (!isUnmountedRef.current) {
                    addMessage("AI", questions[0]);
                }
            }, 500);
        }

        return () => {
            isUnmountedRef.current = true;
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            window.speechSynthesis.cancel();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate, questions]);

    const speakText = (text) => {
        if (!isUnmountedRef.current && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            window.speechSynthesis.speak(utterance);
        }
    };

    const addMessage = (speaker, text) => {
        if (isUnmountedRef.current) return;
        setConversation(prev => [...prev, { speaker, text }]);
        if (speaker === "AI") {
            speakText(text);
        }
    };

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert("Speech recognition not supported in this browser.");
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            setUserInput(""); // clear previous before new dictation
            window.speechSynthesis.cancel(); // Stop AI speaking if user interrupts
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    const handleSendUserMessage = async () => {
        if (!userInput.trim()) return;

        if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }

        const newMsgText = userInput.trim();
        setUserInput("");
        setConversation(prev => [...prev, { speaker: "User", text: newMsgText }]);

        // Move to the next question or evaluate
        const nextIndex = currentQuestionIndex + 1;
        if (nextIndex < questions.length) {
            setCurrentQuestionIndex(nextIndex);
            setTimeout(() => {
                addMessage("AI", questions[nextIndex]);
            }, 1000);
        } else {
            // Finished all questions
            await processEvaluation([...conversation, { speaker: "User", text: newMsgText }]);
        }
    };

    const processEvaluation = async (finalConversation) => {
        setIsEvaluating(true);
        try {
            // We prepend the self-introduction to the context so the evaluator knows the background
            const fullContext = [
                { speaker: "User", text: `[Self Introduction Context: ${selfIntroduction}]` },
                ...finalConversation
            ];

            const evalResult = await evaluateHRInterview(fullContext);
            setResult(evalResult);

            // Save to Firebase
            if (interviewId) {
                const interviewRef = doc(db, "interviews", interviewId);
                await updateDoc(interviewRef, {
                    type: "hr-round",
                    conversation: finalConversation, // Exclude the bracketed intro context if you want, but keep in transcript
                    evaluation: evalResult,
                    status: "completed",
                    completedAt: serverTimestamp()
                });
            }
        } catch (error) {
            console.error("Evaluation failed", error);
            alert("Error generating final evaluation. Please try again or check console.");
        } finally {
            if (!isUnmountedRef.current) {
                setIsEvaluating(false);
            }
        }
    };

    // Rendering Result Screen
    if (result) {
        return (
            <div className="hr-container result-container">
                <h2>HR Interview Results</h2>

                <div className="hr-score-card">
                    <div className="score-item">
                        <h4>Communication</h4>
                        <div className="hr-score-big">{result.communicationScore} / 10</div>
                    </div>
                    <div className="score-item">
                        <h4>Confidence</h4>
                        <div className="hr-score-big">{result.confidenceScore} / 10</div>
                    </div>
                    <div className="score-item">
                        <h4>Content Quality</h4>
                        <div className="hr-score-big">{result.contentQualityScore} / 10</div>
                    </div>
                </div>

                <div className="hr-feedback-grid">
                    <div className="hr-feedback-box strengths">
                        <h4>Strengths</h4>
                        <ul>
                            {result.strengths?.map((item, idx) => <li key={idx}>{item}</li>)}
                        </ul>
                    </div>
                    <div className="hr-feedback-box improvements">
                        <h4>Areas for Improvement</h4>
                        <ul>
                            {result.areasForImprovement?.map((item, idx) => <li key={idx}>{item}</li>)}
                        </ul>
                    </div>
                </div>

                <div className="hr-analysis-box final">
                    <h4>Final Feedback</h4>
                    <p>{result.finalFeedback}</p>
                </div>

                <button className="btn-primary" onClick={() => navigate("/", { replace: true })}>
                    Return to Home
                </button>
            </div>
        );
    }

    if (isEvaluating) {
        return (
            <div className="hr-container loading-eval">
                <h2>Evaluating HR Round...</h2>
                <p>Please wait while the AI analyzes your interview performance.</p>
                <div className="spinner"></div>
            </div>
        );
    }

    // Active Chat Interface
    return (
        <div className="hr-container chat-redesign">
            <div className="hr-header">
                <div className="hr-topic-banner">
                    <span className="label">HR Interview Round</span>
                </div>
                <div className="progress-bar">
                    Question {currentQuestionIndex + 1} of {questions.length}
                </div>
            </div>

            <div className="hr-conversation-box">
                {conversation.map((msg, idx) => (
                    <div key={idx} className={`hr - message - row ${msg.speaker === 'User' ? 'user-row' : 'ai-row'}`}>
                        <div className={`hr - bubble ${msg.speaker === 'User' ? 'user-bubble' : 'ai-bubble'}`}>
                            <strong>{msg.speaker}:</strong> <br />
                            {msg.text}
                        </div>
                    </div>
                ))}
            </div>

            <div className="hr-input-area">
                <textarea
                    className="hr-answer-input"
                    placeholder="Type your response or use voice input..."
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                />

                <div className="hr-action-buttons">
                    <button
                        className={`btn - mic ${isListening ? 'listening' : ''}`}
                        onClick={toggleListening}
                    >
                        {isListening ? "🛑 Stop Voice" : "🎤 Start Voice"}
                    </button>
                    <button
                        className="btn-submit"
                        onClick={handleSendUserMessage}
                        disabled={!userInput.trim()}
                    >
                        {currentQuestionIndex === questions.length - 1 ? "➤ Submit Interview" : "➤ Send Answer"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HrRoundChat;
