// ============================================
// AI PROVIDERS - API Functions & Smart Routing
// ============================================

const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const API_KEYS = require('./api-keys.js');

// ============== AI CLIENTS ==============
const anthropic = new Anthropic({
    apiKey: API_KEYS.CLAUDE_API_KEYS[0]
});

const openai = new OpenAI({
    apiKey: API_KEYS.OPENAI_API_KEYS[0]
});

const grok = new OpenAI({
    apiKey: API_KEYS.GROK_API_KEYS[0],
    baseURL: "https://api.x.ai/v1"
});

const genAI = new GoogleGenerativeAI(API_KEYS.GEMINI_API_KEYS[0]);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// ============== CODING DETECTION ==============
function isCodingQuestion(message) {
    const codingKeywords = [
        'code', 'coding', 'program', 'function', 'bug', 'error',
        'javascript', 'python', 'html', 'css', 'api', 'debug',
        'syntax', 'compile', 'developer', 'programming', 'script',
        'variable', 'loop', 'array', 'object', 'class', 'method',
        'git', 'npm', 'node', 'react', 'database', 'sql', 'algorithm',
        'frontend', 'backend', 'server', 'client', 'framework', 'library'
    ];
    const msgLower = message.toLowerCase();
    return codingKeywords.some(keyword => msgLower.includes(keyword));
}

// ============== API WRAPPER FUNCTIONS ==============

// Claude API
async function callClaudeAPI(systemPrompt, userMessage) {
    const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }]
    });
    return response.content[0].text.trim();
}

// OpenAI/ChatGPT API
async function callOpenAI(systemPrompt, userMessage) {
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
        ],
        max_tokens: 1024
    });
    return response.choices[0].message.content.trim();
}

// Grok API (xAI)
async function callGrokAPI(systemPrompt, userMessage) {
    const response = await grok.chat.completions.create({
        model: "grok-2-latest",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
        ],
        max_tokens: 1024
    });
    return response.choices[0].message.content.trim();
}

// Gemini API
async function callGeminiAPI(prompt) {
    const result = await geminiModel.generateContent(prompt);
    return result.response.text().trim();
}

// ============== SMART ROUTING FUNCTIONS ==============

// CODING: Claude → ChatGPT → Grok → Gemini (4-tier)
async function tryCodingAPIs(systemPrompt, userMessage) {
    // 1. Try Claude
    try {
        const reply = await callClaudeAPI(systemPrompt, userMessage);
        console.log('🤖 [CODING] Claude ✓');
        return reply;
    } catch (e) {
        console.log('⚠️ [CODING] Claude failed, trying ChatGPT...');
    }

    // 2. Try ChatGPT
    try {
        const reply = await callOpenAI(systemPrompt, userMessage);
        console.log('🤖 [CODING] ChatGPT ✓');
        return reply;
    } catch (e) {
        console.log('⚠️ [CODING] ChatGPT failed, trying Grok...');
    }

    // 3. Try Grok
    try {
        const reply = await callGrokAPI(systemPrompt, userMessage);
        console.log('🤖 [CODING] Grok ✓');
        return reply;
    } catch (e) {
        console.log('⚠️ [CODING] Grok failed, trying Gemini...');
    }

    // 4. Try Gemini
    try {
        const prompt = `${systemPrompt}\n\nUser: ${userMessage}\n\nReply:`;
        const reply = await callGeminiAPI(prompt);
        console.log('🤖 [CODING] Gemini ✓');
        return reply;
    } catch (e) {
        console.error('❌ [CODING] All 4 APIs failed');
        return "Sab AI busy hain. Thodi der baad try karein.";
    }
}

// GENERAL: Claude → Gemini (2-tier)
async function tryGeneralAPIs(systemPrompt, userMessage) {
    // 1. Try Claude
    try {
        const reply = await callClaudeAPI(systemPrompt, userMessage);
        console.log('🤖 [GENERAL] Claude ✓');
        return reply;
    } catch (e) {
        console.log('⚠️ [GENERAL] Claude failed, trying Gemini...');
    }

    // 2. Try Gemini
    try {
        const prompt = `${systemPrompt}\n\nUser: ${userMessage}\n\nReply:`;
        const reply = await callGeminiAPI(prompt);
        console.log('🤖 [GENERAL] Gemini ✓');
        return reply;
    } catch (e) {
        console.error('❌ [GENERAL] Both APIs failed');
        return "Dono AI busy hain. Thodi der baad try karein.";
    }
}

// VOICE: Claude → Gemini (2-tier)
async function tryVoiceAPIs(systemPrompt, media) {
    const voicePrompt = `${systemPrompt}

User ne voice message bheja hai. Isko suno aur respond karo.
Pehle briefly batao user ne kya kaha (1 line), phir jawab do.

Format:
"G ap [brief summary]"
[Your response]`;

    // 1. Try Claude with audio
    try {
        const response = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{
                role: "user",
                content: [
                    { type: "text", text: voicePrompt },
                    {
                        type: "input_audio",
                        source: {
                            type: "base64",
                            media_type: media.mimetype,
                            data: media.data
                        }
                    }
                ]
            }]
        });
        console.log('🎤 [VOICE] Claude ✓');
        return response.content[0].text.trim();
    } catch (e) {
        console.log('⚠️ [VOICE] Claude failed, trying Gemini...');
    }

    // 2. Try Gemini with audio
    try {
        const result = await geminiModel.generateContent([
            { text: voicePrompt },
            {
                inlineData: {
                    mimeType: media.mimetype,
                    data: media.data
                }
            }
        ]);
        console.log('🎤 [VOICE] Gemini ✓');
        return result.response.text().trim();
    } catch (e) {
        console.error('❌ [VOICE] Both APIs failed');
        return "Voice message samajh nahi aaya. Text mein bhejein.";
    }
}

// ============== EXPORTS ==============
module.exports = {
    isCodingQuestion,
    tryCodingAPIs,
    tryGeneralAPIs,
    tryVoiceAPIs
};
