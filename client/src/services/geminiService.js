const API_URL = "/api/gemini";

async function callAPI(action, params = {}) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...params }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || response.statusText);
  }

  return response.json();
}

export const generateInterviewQuestions = async (role, description, experience, skills) => {
  return callAPI("generateInterviewQuestions", { role, description, experience, skills });
};

export const generateAptitudeQuestions = async () => {
  return callAPI("generateAptitudeQuestions");
};

export const generateTechnicalQuestions = async (domain) => {
  return callAPI("generateTechnicalQuestions", { domain });
};

export const evaluateAnswer = async (question, userAnswer, idealAnswer) => {
  try {
    return await callAPI("evaluateAnswer", { question, userAnswer, idealAnswer });
  } catch (error) {
    console.error("Error evaluating answer:", error);
    return { score: 0, feedback: "Error evaluating answer. Please try again." };
  }
};

export const generateGDTopic = async (role) => {
  return callAPI("generateGDTopic", { role });
};

export const generateGDResponse = async (topic, conversationHistory) => {
  return callAPI("generateGDResponse", { topic, conversationHistory });
};

export const evaluateGD = async (topic, conversationHistory) => {
  return callAPI("evaluateGD", { topic, conversationHistory });
};

export const generateHRQuestions = async (selfIntroduction) => {
  return callAPI("generateHRQuestions", { selfIntroduction });
};

export const evaluateHRInterview = async (conversationHistory) => {
  return callAPI("evaluateHRInterview", { conversationHistory });
};
