// ============================================
// API KEYS CONFIGURATION
// Keys are loaded from .env file (not committed to git)
// ============================================

require('dotenv').config();

module.exports = {

    // Claude API Keys (Anthropic)
    CLAUDE_API_KEYS: [process.env.CLAUDE_API_KEY],

    // OpenAI API Keys (ChatGPT)
    OPENAI_API_KEYS: [process.env.OPENAI_API_KEY],

    // Gemini API Keys (Google)
    GEMINI_API_KEYS: [process.env.GEMINI_API_KEY],

    // Grok API Keys (xAI)
    GROK_API_KEYS: [process.env.GROK_API_KEY],

    // AssemblyAI API Key (Speech-to-Text)
    ASSEMBLYAI_API_KEY: process.env.ASSEMBLYAI_API_KEY

};
