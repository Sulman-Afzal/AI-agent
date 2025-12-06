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

    // Gemini API Keys (Google) - supports multiple comma-separated keys
    GEMINI_API_KEYS: (process.env.GEMINI_API_KEYS || '').split(',').map(k => k.trim()).filter(k => k),

    // Grok API Keys (xAI)
    GROK_API_KEYS: [process.env.GROK_API_KEY],

    // AssemblyAI API Key (Speech-to-Text)
    ASSEMBLYAI_API_KEY: process.env.ASSEMBLYAI_API_KEY,

    // AWS Credentials (for Polly TTS)
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION || 'us-east-1'

};
