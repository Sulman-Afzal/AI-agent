// ============================================
// AI PROVIDERS - API Functions & Smart Routing
// ============================================

const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');
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

// GENERAL: Claude → Grok → Gemini (3-tier)
async function tryGeneralAPIs(systemPrompt, userMessage) {
    // 1. Try Claude
    try {
        const reply = await callClaudeAPI(systemPrompt, userMessage);
        console.log('🤖 [GENERAL] Claude ✓');
        return reply;
    } catch (e) {
        console.log('⚠️ [GENERAL] Claude failed, trying Grok...');
    }

    // 2. Try Grok
    try {
        const reply = await callGrokAPI(systemPrompt, userMessage);
        console.log('🤖 [GENERAL] Grok ✓');
        return reply;
    } catch (e) {
        console.log('⚠️ [GENERAL] Grok failed, trying Gemini...');
    }

    // 3. Try Gemini
    try {
        const prompt = `${systemPrompt}\n\nUser: ${userMessage}\n\nReply:`;
        const reply = await callGeminiAPI(prompt);
        console.log('🤖 [GENERAL] Gemini ✓');
        return reply;
    } catch (e) {
        console.error('❌ [GENERAL] All 3 APIs failed');
        return "Sab AI busy hain. Thodi der baad try karein.";
    }
}

// AssemblyAI Speech-to-Text helper function
async function transcribeWithAssemblyAI(audioBuffer) {
    const assemblyAIKey = API_KEYS.ASSEMBLYAI_API_KEY;

    // Step 1: Upload audio file to AssemblyAI
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
            'authorization': assemblyAIKey,
            'content-type': 'application/octet-stream'
        },
        body: audioBuffer
    });

    if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    const { upload_url } = await uploadResponse.json();
    console.log('🎤 [VOICE] AssemblyAI upload complete');

    // Step 2: Request transcription
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
            'authorization': assemblyAIKey,
            'content-type': 'application/json'
        },
        body: JSON.stringify({ audio_url: upload_url })
    });

    if (!transcriptResponse.ok) {
        throw new Error(`Transcript request failed: ${transcriptResponse.status}`);
    }

    const { id } = await transcriptResponse.json();

    // Step 3: Poll for result (max 60 seconds)
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

        const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
            headers: { 'authorization': assemblyAIKey }
        });

        const result = await pollResponse.json();

        if (result.status === 'completed') {
            return result.text;
        } else if (result.status === 'error') {
            throw new Error(`Transcription failed: ${result.error}`);
        }
        // status === 'processing' or 'queued' - continue polling
    }

    throw new Error('Transcription timeout');
}

// VOICE: Speech-to-Text (AssemblyAI) → Claude/Grok/Gemini
async function tryVoiceAPIs(systemPrompt, media) {
    // Step 1: Convert voice to text using AssemblyAI
    let transcription;
    try {
        // Convert base64 to buffer
        const audioBuffer = Buffer.from(media.data, 'base64');

        // Send to AssemblyAI
        transcription = await transcribeWithAssemblyAI(audioBuffer);
        console.log('🎤 [VOICE] AssemblyAI transcription:', transcription);
    } catch (e) {
        console.error('❌ [VOICE] AssemblyAI failed:', e.message);

        // Fallback to Gemini for direct audio processing
        try {
            const voicePrompt = `${systemPrompt}

User ne voice message bheja hai. Isko suno aur respond karo.
Pehle briefly batao user ne kya kaha (1 line), phir jawab do.

Format:
"User ne kaha: [summary]"
[Your response]`;

            const result = await geminiModel.generateContent([
                { text: voicePrompt },
                {
                    inlineData: {
                        mimeType: media.mimetype,
                        data: media.data
                    }
                }
            ]);
            console.log('🎤 [VOICE] Gemini (direct audio) ✓');
            return result.response.text().trim();
        } catch (geminiError) {
            console.error('❌ [VOICE] Gemini also failed:', geminiError.message);
            return "Voice message samajh nahi aaya. Text mein bhejein.";
        }
    }

    // Step 2: Send transcribed text to Claude/Grok/Gemini (use General routing)
    const voiceContext = `User ne voice message bheja: "${transcription}"

Is message ka jawab do. Reply format:
"User ne kaha: ${transcription}"
[Your response]`;

    // Use the general routing (Claude → Grok → Gemini)
    const reply = await tryGeneralAPIs(systemPrompt, voiceContext);
    console.log('🎤 [VOICE] Response via text API ✓');
    return reply;
}

// ============== EXPORTS ==============
module.exports = {
    isCodingQuestion,
    tryCodingAPIs,
    tryGeneralAPIs,
    tryVoiceAPIs
};
