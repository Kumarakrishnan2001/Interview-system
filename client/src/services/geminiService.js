const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const generateContentWithRetry = async (model, contents, retries = 3, initialDelay = 1000) => {
  const URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: contents }]
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error?.message || response.statusText);
        error.status = response.status;
        throw error;
      }

      const data = await response.json();

      return {
        text: data.candidates?.[0]?.content?.parts?.[0]?.text || ""
      };
    } catch (error) {
      if (error.status === 429 || (error.message && error.message.includes("429"))) {
        console.warn(`Rate limit hit. Retrying in ${initialDelay}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, initialDelay));
        initialDelay *= 2; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
  throw new Error("Max retries exceeded for Gemini API");
};

export const generateInterviewQuestions = async (role, description, experience, skills) => {
  try {
    const prompt = `
      You are an expert technical interviewer.
      
      Job Role: ${role}
      Job Description: ${description}
      Years of Experience: ${experience}
      Skills: ${skills}

      Generate 5 technical interview questions relevant to this profile.
      For each question, provide a short ideal answer.
      
      Return ONLY a valid JSON array. Do not include markdown formatting (like \`\`\`json).
      Format:
      [
        { "question": "Question text here", "answer": "Ideal answer summary here" },
        ...
      ]
    `;

    const response = await generateContentWithRetry("gemini-2.5-flash", prompt);

    const text = response.text;
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanText.replace(/,\s*([\]}])/g, "$1"));
  } catch (error) {
    console.error("Error generating questions:", error);
    throw error;
  }
};

export const generateAptitudeQuestions = async () => {
  try {
    const prompt = `
      You are an expert aptitude trainer.

      Generate 5 English vocabulary multiple-choice questions (synonyms, antonyms, meaning in context, or analogies).
      Each question must have 4 options and one correct answer.
      
      Return ONLY a valid JSON array. Do not include markdown formatting.
      Format:
      [
        { 
          "question": "Question text here", 
          "options": ["Option A", "Option B", "Option C", "Option D"], 
          "answer": "Correct Option Text" 
        },
        ...
      ]
    `;

    const response = await generateContentWithRetry("gemini-2.5-flash", prompt);

    const text = response.text;
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanText.replace(/,\s*([\]}])/g, "$1"));
  } catch (error) {
    console.error("Error generating aptitude questions:", error);
    throw error;
  }
};

export const generateTechnicalQuestions = async (domain) => {
  try {
    const prompt = `
      You are an expert technical interviewer specialized in ${domain}.

      Generate 5 multiple-choice technical interview questions specifically for the domain: ${domain}.
      Each question must have 4 options and one correct answer.
      
      Return ONLY a valid JSON array. Do not include markdown formatting.
      Format:
      [
        { 
          "question": "Question text here", 
          "options": ["Option A", "Option B", "Option C", "Option D"], 
          "answer": "Correct Option Text" 
        },
        ...
      ]
    `;

    const response = await generateContentWithRetry("gemini-2.5-flash", prompt);

    const text = response.text;
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanText.replace(/,\s*([\]}])/g, "$1"));
  } catch (error) {
    console.error("Error generating technical questions:", error);
    throw error;
  }
};

export const evaluateAnswer = async (question, userAnswer, idealAnswer) => {
  try {
    const prompt = `
      You are an expert technical interviewer evaluating a candidate's answer.

      Question: ${question}
      Ideal Answer: ${idealAnswer}
      Candidate's Answer: ${userAnswer}

      Evaluate the candidate's answer on a scale of 1 to 10.
      Provide brief feedback on what was good and what could be improved.
      
      Return ONLY a valid JSON object. Do not include markdown formatting.
      Format:
      {
        "score": 8,
        "feedback": "Good explanation but missed..."
      }
    `;

    const response = await generateContentWithRetry("gemini-2.5-flash", prompt);

    const text = response.text;

    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();

    return JSON.parse(cleanText.replace(/,\s*([\]}])/g, "$1"));
  } catch (error) {
    console.error("Error evaluating answer:", error);
    // Return a fallback if AI fails, to not block the user flow
    return { score: 0, feedback: "Error evaluating answer. Please try again." };
  }
};

export const generateGDTopic = async (role) => {
  try {
    const prompt = `
      You are an expert HR and technical interviewer.
      The candidate is applying for the role: ${role}.
      
      Generate a single, compelling Group Discussion (GD) topic relevant to this job role.
      The topic should be debatable and encourage analytical thinking.
      
      Return ONLY a valid JSON object. Do not include markdown formatting.
      Format:
      {
        "topic": "The exact wording of the GD topic"
      }
    `;
    const response = await generateContentWithRetry("gemini-2.5-flash", prompt);
    const text = response.text;
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanText.replace(/,\s*([\]}])/g, "$1"));
  } catch (error) {
    console.error("Error generating GD topic:", error);
    throw error;
  }
};

export const generateGDResponse = async (topic, conversationHistory) => {
  try {
    // conversationHistory should be an array of objects: { speaker: "AI"|"User", text: "..." }
    const formattedHistory = conversationHistory.map(msg => `${msg.speaker}: ${msg.text}`).join("\n");

    const prompt = `
      You are an AI participant in a Group Discussion.
      The topic of the discussion is: "${topic}".
      
      Here is the conversation history so far:
      ${formattedHistory}
      
      Your task: Provide the next logical response as the AI participant.
      - If this is the start of the discussion, provide a strong opening statement.
      - If replying to the user, acknowledge their point briefly and offer a counter-viewpoint, an expansion, or bring in a new perspective.
      - Keep your response conversational, concise (3-4 sentences), and natural.
      
      Return ONLY a valid JSON object. Do not include markdown formatting.
      Format:
      {
        "response": "Your text response here"
      }
    `;
    const response = await generateContentWithRetry("gemini-2.5-flash", prompt);
    const text = response.text;
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanText.replace(/,\s*([\]}])/g, "$1"));
  } catch (error) {
    console.error("Error generating GD response:", error);
    throw error;
  }
};

export const evaluateGD = async (topic, conversationHistory) => {
  try {
    const formattedHistory = conversationHistory.map(msg => `${msg.speaker}: ${msg.text}`).join("\n");
    const prompt = `
      You are an expert communication and technical skills evaluator.
      Review the following 10-minute Group Discussion transcript between a User and an AI.
      
      Topic: "${topic}"
      
      Transcript:
      ${formattedHistory}
      
      Analyze the User's overall performance. Evaluate based on:
      1. Relevance to the topic
      2. Communication skills and clarity
      3. Ability to construct arguments and counter-arguments
      
      Provide:
      - A score out of 100
      - A brief communication analysis summary
      - 2-3 Strengths
      - 2-3 Areas for improvement
      - A concise final feedback report
      
      Return ONLY a valid JSON object. Do not include markdown formatting.
      Format:
      {
        "score": 85,
        "communicationAnalysis": "...",
        "strengths": ["...", "..."],
        "areasForImprovement": ["...", "..."],
        "finalFeedback": "..."
      }
    `;
    const response = await generateContentWithRetry("gemini-2.5-flash", prompt);
    const text = response.text;
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanText.replace(/,\s*([\]}])/g, "$1"));
  } catch (error) {
    console.error("Error evaluating GD:", error);
    throw error;
  }
};

export const generateHRQuestions = async (selfIntroduction) => {
  try {
    const prompt = `
      You are an expert HR Interviewer.
      The candidate has provided the following self-introduction: "${selfIntroduction}"

      Based on this introduction, generate 4 HR interview questions for the candidate.
      The questions must cover the following 4 categories in order:
      1. A follow-up question based on their Self Introduction.
      2. A question about their Strengths & Weaknesses.
      3. A Behavioral Question (e.g., handling conflict, teamwork, or leadership).
      4. A question about their Career Goals and Company Fit.
      
      Return ONLY a valid JSON array of strings containing just the 4 questions.
      Do not include markdown formatting.
      Format:
      [
        "Question 1 here",
        "Question 2 here",
        "Question 3 here",
        "Question 4 here"
      ]
    `;

    const response = await generateContentWithRetry("gemini-2.5-flash", prompt);

    const text = response.text;
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanText.replace(/,\s*([\]}])/g, "$1"));
  } catch (error) {
    console.error("Error generating HR questions:", error);
    throw error;
  }
};

export const evaluateHRInterview = async (conversationHistory) => {
  try {
    const formattedHistory = conversationHistory.map(msg => `${msg.speaker}: ${msg.text}`).join("\n");
    const prompt = `
      You are an expert HR Manager reviewing a candidate's HR interview.
      
      Here is the interview transcript:
      ${formattedHistory}
      
      Evaluate the candidate's performance and provide the following:
      1. A Communication score out of 10.
      2. A Confidence score out of 10.
      3. A Content Quality score out of 10.
      4. 2-3 Strengths.
      5. 2-3 Areas for improvement.
      6. A concise final HR interview feedback report.
      
      Return ONLY a valid JSON object. Do not include markdown formatting.
      Format:
      {
        "communicationScore": 8,
        "confidenceScore": 7,
        "contentQualityScore": 8,
        "strengths": ["...", "..."],
        "areasForImprovement": ["...", "..."],
        "finalFeedback": "..."
      }
    `;
    const response = await generateContentWithRetry("gemini-2.5-flash", prompt);
    const text = response.text;
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanText.replace(/,\s*([\]}])/g, "$1"));
  } catch (error) {
    console.error("Error evaluating HR interview:", error);
    throw error;
  }
};
