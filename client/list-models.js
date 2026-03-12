const API_KEY = "AIzaSyCtIIMhL4dN6bRFYhr6yTk_eo0PxTRj9I8";
const URL = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

async function getModels() {
    try {
        const response = await fetch(URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Available Models:");
        if (data.models) {
            data.models.forEach(m => console.log(`- ${m.name} (${m.supportedGenerationMethods})`));
        } else {
            console.log(data);
        }
    } catch (error) {
        console.error("Error fetching models:", error);
    }
}

getModels();
