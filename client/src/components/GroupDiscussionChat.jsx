import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { generateGDResponse, evaluateGD } from "../services/geminiService";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../assets/loginconfiguration/config";
import "./GroupDiscussionChat.css";

const GroupDiscussionChat = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const { topic, interviewId, startOption } = location.state || {};

    const [conversation, setConversation] = useState([]); // { speaker: 'AI' | 'User', text: string }
    const [userInput, setUserInput] = useState("");
    const [isListening, setIsListening] = useState(false);
    const [loadingAI, setLoadingAI] = useState(false);

    // Timer state
    const [timeLeft, setTimeLeft] = useState(10 * 60); // 10 minutes in seconds
    const [isDiscussionActive, setIsDiscussionActive] = useState(true);

    // Evaluation state
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [result, setResult] = useState(null);

    // Refs
    const recognitionRef = useRef(null);
    const timerRef = useRef(null);
    const hasStartedRef = useRef(false);

    // Force unmount cleanup flag
    const isUnmountedRef = useRef(false);

    useEffect(() => {
        isUnmountedRef.current = false;

        if (!topic && !location.state) {
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

        // Timer Logic
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    handleStopDiscussion();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Initial AI Start
        if (startOption === 'ai' && !hasStartedRef.current) {
            hasStartedRef.current = true;
            initAIStart();
        }

        return () => {
            // Cleanup on Unmount
            isUnmountedRef.current = true;
            clearInterval(timerRef.current);
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            window.speechSynthesis.cancel();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate, location.state, topic, startOption]);

    const initAIStart = async () => {
        setLoadingAI(true);
        try {
            const aiResp = await generateGDResponse(topic, []);
            addMessage("AI", aiResp.response);
        } catch (err) {
            console.error(err);
        } finally {
            if (!isUnmountedRef.current) setLoadingAI(false);
        }
    };

    const speakText = (text) => {
        if (!isUnmountedRef.current && window.speechSynthesis) {
            window.speechSynthesis.cancel(); // cancel any ongoing speech
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
            setUserInput(""); // clear previous before new dictation (optional)
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

        setLoadingAI(true);
        try {
            // Include new user message in history sent to AI
            const updatedHistory = [...conversation, { speaker: "User", text: newMsgText }];
            const aiResp = await generateGDResponse(topic, updatedHistory);

            if (!isDiscussionActive) return; // if user clicked stop while waiting

            addMessage("AI", aiResp.response);
        } catch (err) {
            console.error("AI Error:", err);
            addMessage("AI", "Oops, I encountered an error. Could you repeat that?");
        } finally {
            if (!isUnmountedRef.current) setLoadingAI(false);
        }
    };

    const handleStopDiscussion = async () => {
        setIsDiscussionActive(false);
        clearInterval(timerRef.current);
        window.speechSynthesis.cancel();
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }

        await processEvaluation(conversation);
    };

    const processEvaluation = async (historyToEvaluate) => {
        setIsEvaluating(true);
        try {
            const evalResult = await evaluateGD(topic, historyToEvaluate);
            setResult(evalResult);

            // Save to Firebase
            if (interviewId) {
                const interviewRef = doc(db, "interviews", interviewId);
                await updateDoc(interviewRef, {
                    type: "group-discussion",
                    topic: topic,
                    conversation: historyToEvaluate,
                    totalScore: evalResult.score,
                    evaluation: evalResult,
                    status: "completed",
                    completedAt: serverTimestamp()
                });
            }
        } catch (error) {
            console.error("Evaluation failed", error);
            alert("Error generating final evaluation.");
        } finally {
            if (!isUnmountedRef.current) {
                setIsEvaluating(false);
            }
        }
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // Rendering Result Screen
    if (result) {
        return (
            <div className="gd-container result-container">
                <h2>Group Discussion Results</h2>

                <div className="gd-score-card">
                    <h3>Overall Score</h3>
                    <div className="gd-score-big">{result.score} / 100</div>
                </div>

                <div className="gd-feedback-grid">
                    <div className="gd-feedback-box strengths">
                        <h4>Strengths</h4>
                        <ul>
                            {result.strengths?.map((item, idx) => <li key={idx}>{item}</li>)}
                        </ul>
                    </div>
                    <div className="gd-feedback-box improvements">
                        <h4>Areas for Improvement</h4>
                        <ul>
                            {result.areasForImprovement?.map((item, idx) => <li key={idx}>{item}</li>)}
                        </ul>
                    </div>
                </div>

                <div className="gd-analysis-box">
                    <h4>Communication Analysis</h4>
                    <p>{result.communicationAnalysis}</p>
                </div>

                <div className="gd-analysis-box final">
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
            <div className="gd-container loading-eval">
                <h2>Evaluating Discussion...</h2>
                <p>Please wait while the AI analyzes your performance.</p>
                <div className="spinner"></div>
            </div>
        );
    }

    // Active Chat Interface
    return (
        <div className="gd-container chat-redesign">
            <div className="gd-header">
                <div className="gd-topic-banner">
                    <span className="label">Topic:</span> {topic}
                </div>
                <div className="gd-controls-top">
                    <div className={`gd-timer ${timeLeft < 60 ? 'urgent' : ''}`}>
                        ⏱️ {formatTime(timeLeft)}
                    </div>
                    <button className="btn-danger stop-btn" onClick={handleStopDiscussion}>
                        ⏹ Stop & Analyze
                    </button>
                </div>
            </div>

            <div className="gd-conversation-box">
                {conversation.length === 0 && !loadingAI && startOption === "user" && (
                    <div className="gd-prompt">You can start the discussion now.</div>
                )}
                {conversation.map((msg, idx) => (
                    <div key={idx} className={`gd-message-row ${msg.speaker === 'User' ? 'user-row' : 'ai-row'}`}>
                        <div className={`gd-bubble ${msg.speaker === 'User' ? 'user-bubble' : 'ai-bubble'}`}>
                            <strong>{msg.speaker}:</strong> <br />
                            {msg.text}
                        </div>
                    </div>
                ))}
                {loadingAI && (
                    <div className="gd-message-row ai-row">
                        <div className="gd-bubble ai-bubble typing">AI is typing and thinking...</div>
                    </div>
                )}
            </div>

            <div className="gd-input-area">
                <textarea
                    className="gd-answer-input"
                    placeholder="Type your response or use voice input..."
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    disabled={!isDiscussionActive}
                />

                <div className="gd-action-buttons">
                    <button
                        className={`btn-mic ${isListening ? 'listening' : ''}`}
                        onClick={toggleListening}
                        disabled={!isDiscussionActive || loadingAI}
                    >
                        {isListening ? "🛑 Stop Voice" : "🎤 Start Voice"}
                    </button>
                    <button
                        className="btn-submit"
                        onClick={handleSendUserMessage}
                        disabled={!isDiscussionActive || !userInput.trim() || loadingAI}
                    >
                        ➤ Send
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GroupDiscussionChat;
