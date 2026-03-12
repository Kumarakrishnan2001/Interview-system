import { useEffect, useState } from "react";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "../assets/loginconfiguration/config";
import { useAuth } from "../context/AuthContext";
import "./History.css";

const getDisplayScore = (item) => {
    if (item.totalScore !== undefined) return item.totalScore;
    if (item.score !== undefined) return item.score;
    if (item.type === 'hr-round' && item.evaluation) {
        const comm = Number(item.evaluation.communicationScore) || 0;
        const conf = Number(item.evaluation.confidenceScore) || 0;
        const cont = Number(item.evaluation.contentQualityScore) || 0;
        return Math.round((comm + conf + cont) / 3);
    }
    return "Incomplete";
};

export default function History() {
    const { user } = useAuth();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedInterview, setSelectedInterview] = useState(null);

    const handlePreview = (interview) => {
        setSelectedInterview(interview);
    };

    const closePreview = () => {
        setSelectedInterview(null);
    };

    useEffect(() => {
        if (user) {
            fetchHistory();
        }
    }, [user]);

    const fetchHistory = async () => {
        try {
            const q = query(
                collection(db, "interviews"),
                where("uid", "==", user.uid)
            );
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            // Client-side sorting and filtering out soft-deleted records
            const filteredData = data.filter(item => !item.deletedLocally);
            filteredData.sort((a, b) => {
                const dateA = a.createdAt?.seconds || a.completedAt?.seconds || 0;
                const dateB = b.createdAt?.seconds || b.completedAt?.seconds || 0;
                return dateB - dateA;
            });
            setHistory(filteredData);
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to remove this record from your history view?")) {
            try {
                // Soft delete: update doc with flag instead of deleteDoc
                await updateDoc(doc(db, "interviews", id), {
                    deletedLocally: true
                });
                setHistory(history.filter((item) => item.id !== id));
            } catch (error) {
                console.error("Error hiding document:", error);
                alert("Failed to remove record.");
            }
        }
    };

    if (loading) {
        return <div className="history-container loading">Loading History...</div>;
    }

    return (
        <div className="history-container">
            <h2 className="history-title">Interview History</h2>

            {history.length === 0 ? (
                <div className="no-history">No interview history found.</div>
            ) : (
                <div className="history-grid">
                    {history.map((item) => (
                        <div key={item.id} className="history-card">
                            <div className="history-header">
                                <span className={`badge ${item.type || 'personal'}`}>
                                    {(item.type === 'group-discussion' ? 'Group Discussion' : item.type === 'hr-round' ? 'HR Round' : item.type || 'Personal').toUpperCase()}
                                </span>
                                <span className="date">
                                    {(item.createdAt || item.completedAt)?.toDate().toLocaleDateString() || "Unknown Date"}
                                </span>
                            </div>

                            <div className="history-body">
                                {item.type === 'technical' && (
                                    <h3>{item.domain}</h3>
                                )}
                                {item.type === 'aptitude' && (
                                    <h3>English Aptitude</h3>
                                )}
                                {item.type === 'group-discussion' && (
                                    <h3>{item.role} - GD</h3>
                                )}
                                {item.type === 'hr-round' && (
                                    <h3>HR Interview</h3>
                                )}
                                {(!item.type || item.type === 'personal') && (
                                    <h3>{item.role || "Custom Role"}</h3>
                                )}

                                {item.type === 'group-discussion' ? (
                                    <p className="topic-subtext">{item.topic?.substring(0, 40)}...</p>
                                ) : item.type === 'hr-round' ? (
                                    <p className="topic-subtext">Self Intro Based...</p>
                                ) : null}

                                <p className="score">
                                    Score: {getDisplayScore(item)}
                                    {item.type === 'group-discussion' ? " / 100" : item.type === 'hr-round' ? " / 10 (Avg)" : ` / ${item.totalQuestions ? item.totalQuestions : (item.questions ? item.questions.length * 10 : 0)}`}
                                </p>
                            </div>

                            <div className="history-actions">
                                <button
                                    className="preview-btn"
                                    onClick={() => handlePreview(item)}
                                >
                                    Preview
                                </button>
                                <button
                                    className="delete-btn"
                                    onClick={() => handleDelete(item.id)}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Preview Modal */}
            {selectedInterview && (
                <div className="modal-overlay" onClick={closePreview}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Interview Details</h2>
                            <button className="close-btn" onClick={closePreview}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <div className="modal-summary">
                                <span className={`badge ${selectedInterview.type || 'personal'}`}>
                                    {(selectedInterview.type === 'hr-round' ? 'HR Round' : selectedInterview.type || 'Personal').toUpperCase()}
                                </span>
                                <p className="modal-score">
                                    Score: <strong>{getDisplayScore(selectedInterview)}</strong>
                                </p>
                            </div>

                            <div className="qa-list">
                                {selectedInterview.type === 'group-discussion' ? (
                                    // Group Discussion Layout
                                    <div>
                                        <div className="gd-modal-topic">
                                            <strong>Topic:</strong> {selectedInterview.topic}
                                        </div>
                                        {selectedInterview.evaluation && (
                                            <div className="gd-modal-feedback">
                                                <h4>Feedback</h4>
                                                <p><strong>Analysis:</strong> {selectedInterview.evaluation.communicationAnalysis}</p>
                                                <p><strong>Strengths:</strong> {selectedInterview.evaluation.strengths?.join(', ')}</p>
                                                <p><strong>Areas for Improvement:</strong> {selectedInterview.evaluation.areasForImprovement?.join(', ')}</p>
                                                <p><strong>Final Note:</strong> {selectedInterview.evaluation.finalFeedback}</p>
                                            </div>
                                        )}
                                        <h4 style={{ marginTop: '20px' }}>Full Transcript</h4>
                                        <div className="gd-transcript-box">
                                            {selectedInterview.conversation && selectedInterview.conversation.map((msg, idx) => (
                                                <div key={idx} className={`transcript-msg ${msg.speaker === 'User' ? 'user' : 'ai'}`}>
                                                    <strong>{msg.speaker}:</strong> {msg.text}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : selectedInterview.type === 'hr-round' ? (
                                    // HR Round Layout
                                    <div>
                                        {selectedInterview.evaluation && (
                                            <div className="gd-modal-feedback">
                                                <h4>HR Evaluation</h4>
                                                <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                                                    <p><strong>Communication:</strong> {selectedInterview.evaluation.communicationScore}/10</p>
                                                    <p><strong>Confidence:</strong> {selectedInterview.evaluation.confidenceScore}/10</p>
                                                    <p><strong>Content:</strong> {selectedInterview.evaluation.contentQualityScore}/10</p>
                                                </div>
                                                <p><strong>Strengths:</strong> {selectedInterview.evaluation.strengths?.join(', ')}</p>
                                                <p><strong>Areas for Improvement:</strong> {selectedInterview.evaluation.areasForImprovement?.join(', ')}</p>
                                                <p><strong>Final Feedback:</strong> {selectedInterview.evaluation.finalFeedback}</p>
                                            </div>
                                        )}
                                        <h4 style={{ marginTop: '20px' }}>Interview Transcript</h4>
                                        <div className="gd-transcript-box">
                                            {selectedInterview.conversation && selectedInterview.conversation.map((msg, idx) => (
                                                <div key={idx} className={`transcript-msg ${msg.speaker === 'User' ? 'user' : 'ai'}`}>
                                                    <strong>{msg.speaker}:</strong> {msg.text}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : selectedInterview.type === 'personal' || !selectedInterview.type ? (
                                    // Personal Interview Layout
                                    selectedInterview.responses && selectedInterview.responses.length > 0 ? (
                                        selectedInterview.responses.map((resp, idx) => (
                                            <div key={idx} className="qa-item personal">
                                                <p className="question"><strong>Q{idx + 1}:</strong> {resp.question}</p>
                                                <div className="answer-block user-answer">
                                                    <strong>Your Answer:</strong>
                                                    <p>{resp.userAnswer || "No audio recorded"}</p>
                                                </div>
                                                <div className="answer-block ai-feedback">
                                                    <strong>AI Feedback:</strong>
                                                    <p>{resp.aiFeedback}</p>
                                                    <span className="feedback-score">Score: {resp.score}/10</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="no-details">No detailed responses available for this interview.</p>
                                    )
                                ) : (
                                    // Technical / Aptitude Layout
                                    selectedInterview.questions && selectedInterview.questions[0]?.userAnswer !== undefined ? (
                                        selectedInterview.questions.map((q, idx) => (
                                            <div key={idx} className={`qa-item technical ${q.isCorrect ? 'correct' : 'incorrect'}`}>
                                                <p className="question"><strong>Q{idx + 1}:</strong> {q.question}</p>
                                                <div className="options-grid">
                                                    {q.options && q.options.map((opt, i) => (
                                                        <div key={i} className={`option-pill 
                                                            ${opt === q.userAnswer ? 'selected' : ''} 
                                                            ${opt === q.correctAnswer ? 'correct-answer' : ''}
                                                            ${opt === q.userAnswer && opt !== q.correctAnswer ? 'wrong-selection' : ''}
                                                        `}>
                                                            {opt}
                                                        </div>
                                                    ))}
                                                </div>
                                                {!q.isCorrect && (
                                                    <p className="correct-answer-text">Correct Answer: {q.correctAnswer}</p>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="no-details">Detailed question data is not available for this legacy record.</p>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
