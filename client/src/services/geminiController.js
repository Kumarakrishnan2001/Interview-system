const axios = require("axios");

exports.generateInterviewQA = async (req, res) => {
  try {
    const { role, description, experience, skills } = req.body;

    const prompt = `
You are an AI interviewer.

Job Role: ${role}
Description: ${description}
Experience: ${experience}
Skills: ${skills}

Generate 5 interview questions with short ideal answers.
Return ONLY valid JSON like:

[
  { "question": "...", "answer": "..." }
]
`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }
    );

    const text = response.data.candidates[0].content.parts[0].text;
    const qa = JSON.parse(text);

    res.json({ qa });
  } catch (err) {
    console.error("Gemini error:", err.response?.data || err.message);
    res.status(500).json({ error: "Gemini failed" });
  }
};
