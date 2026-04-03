const API_KEY = Netlify.env.get("GEMINI_API_KEY") || Netlify.env.get("VITE_GEMINI_API_KEY");
const MODEL = "gemini-2.5-flash";

async function callGemini(prompt, retries = 3, initialDelay = 1000) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return text.replace(/```json/g, "").replace(/```/g, "").trim();
    }

    if (response.status === 429 && i < retries - 1) {
      await new Promise((r) => setTimeout(r, initialDelay));
      initialDelay *= 2;
      continue;
    }

    const errorData = await response.json().catch(() => ({}));
    return Response.json(
      { error: errorData.error?.message || response.statusText },
      { status: response.status }
    );
  }

  return Response.json({ error: "Max retries exceeded" }, { status: 429 });
}

function parseJSON(text) {
  return JSON.parse(text.replace(/,\s*([\]}])/g, "$1"));
}

const ACTIONS = {
  async generateInterviewQuestions({ role, description, experience, skills }) {
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
]`;
    const text = await callGemini(prompt);
    if (text instanceof Response) return text;
    return Response.json(parseJSON(text));
  },

  async generateAptitudeQuestions() {
    const prompt = `
You are an expert aptitude trainer.

Generate 5 English vocabulary multiple-choice questions (synonyms, antonyms, meaning in context, or analogies).
Each question must have 4 options and one correct answer.

Return ONLY a valid JSON array. Do not include markdown formatting.
Format:
[
  { "question": "Question text here", "options": ["Option A", "Option B", "Option C", "Option D"], "answer": "Correct Option Text" },
  ...
]`;
    const text = await callGemini(prompt);
    if (text instanceof Response) return text;
    return Response.json(parseJSON(text));
  },

  async generateTechnicalQuestions({ domain }) {
    const prompt = `
You are an expert technical interviewer specialized in ${domain}.

Generate 5 multiple-choice technical interview questions specifically for the domain: ${domain}.
Each question must have 4 options and one correct answer.

Return ONLY a valid JSON array. Do not include markdown formatting.
Format:
[
  { "question": "Question text here", "options": ["Option A", "Option B", "Option C", "Option D"], "answer": "Correct Option Text" },
  ...
]`;
    const text = await callGemini(prompt);
    if (text instanceof Response) return text;
    return Response.json(parseJSON(text));
  },

  async evaluateAnswer({ question, userAnswer, idealAnswer }) {
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
}`;
    const text = await callGemini(prompt);
    if (text instanceof Response) return text;
    return Response.json(parseJSON(text));
  },

  async generateGDTopic({ role }) {
    const prompt = `
You are an expert HR and technical interviewer.
The candidate is applying for the role: ${role}.

Generate a single, compelling Group Discussion (GD) topic relevant to this job role.
The topic should be debatable and encourage analytical thinking.

Return ONLY a valid JSON object. Do not include markdown formatting.
Format:
{
  "topic": "The exact wording of the GD topic"
}`;
    const text = await callGemini(prompt);
    if (text instanceof Response) return text;
    return Response.json(parseJSON(text));
  },

  async generateGDResponse({ topic, conversationHistory }) {
    const formattedHistory = conversationHistory
      .map((msg) => `${msg.speaker}: ${msg.text}`)
      .join("\n");
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
}`;
    const text = await callGemini(prompt);
    if (text instanceof Response) return text;
    return Response.json(parseJSON(text));
  },

  async evaluateGD({ topic, conversationHistory }) {
    const formattedHistory = conversationHistory
      .map((msg) => `${msg.speaker}: ${msg.text}`)
      .join("\n");
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
}`;
    const text = await callGemini(prompt);
    if (text instanceof Response) return text;
    return Response.json(parseJSON(text));
  },

  async generateHRQuestions({ selfIntroduction }) {
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
]`;
    const text = await callGemini(prompt);
    if (text instanceof Response) return text;
    return Response.json(parseJSON(text));
  },

  async evaluateHRInterview({ conversationHistory }) {
    const formattedHistory = conversationHistory
      .map((msg) => `${msg.speaker}: ${msg.text}`)
      .join("\n");
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
}`;
    const text = await callGemini(prompt);
    if (text instanceof Response) return text;
    return Response.json(parseJSON(text));
  },
};

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  if (!API_KEY) {
    return Response.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const body = await req.json();
  const { action, ...params } = body;

  const handler = ACTIONS[action];
  if (!handler) {
    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  try {
    return await handler(params);
  } catch (error) {
    console.error(`Error in action ${action}:`, error);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
};

export const config = {
  path: "/api/gemini",
  method: "POST",
};
