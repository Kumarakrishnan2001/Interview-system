import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
    console.error("No API KEY found");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

async function listModels() {
    try {
        // For listing models, we don't need a specific model instance usually, 
        // but the SDK structure commonly accesses it directly or via a manager.
        // Actually the SDK doesn't have a direct 'listModels' on the client in all versions.
        // Let's try to just check if we can initialize a simple model or if the error persists.
        // However, looking at standard usage, usually we just try a known model.
        // Let's print the API key (partially) to verify it's loaded.
        console.log("Using API Key:", API_KEY.substring(0, 5) + "...");

        // Let's try 'gemini-2.0-flash-exp' or 'gemini-1.5-flash' explicitly again
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello");
        console.log("Success with gemini-1.5-flash:", result.response.text());
    } catch (error) {
        console.error("Error with gemini-1.5-flash:", error.message);

        try {
            console.log("Trying gemini-pro...");
            const modelPro = genAI.getGenerativeModel({ model: "gemini-pro" });
            const resultPro = await modelPro.generateContent("Hello");
            console.log("Success with gemini-pro:", resultPro.response.text());
        } catch (err2) {
            console.error("Error with gemini-pro:", err2.message);
        }
    }
}

listModels();
