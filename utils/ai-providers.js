// ============================================
// AI PROVIDERS - API Functions & Smart Routing
// ============================================

const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');
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

// AWS Polly Client (for Text-to-Speech)
let pollyClient = null;
function getPollyClient() {
    if (!pollyClient && API_KEYS.AWS_ACCESS_KEY_ID && API_KEYS.AWS_SECRET_ACCESS_KEY) {
        pollyClient = new PollyClient({
            region: API_KEYS.AWS_REGION,
            credentials: {
                accessKeyId: API_KEYS.AWS_ACCESS_KEY_ID,
                secretAccessKey: API_KEYS.AWS_SECRET_ACCESS_KEY
            }
        });
    }
    return pollyClient;
}

// Gemini - Multiple keys with rotation
let currentGeminiKeyIndex = 0;

function getGeminiModel() {
    const keys = API_KEYS.GEMINI_API_KEYS;
    if (keys.length === 0) throw new Error('No Gemini API keys configured');
    const genAI = new GoogleGenerativeAI(keys[currentGeminiKeyIndex]);
    return genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
}

function rotateGeminiKey() {
    const keys = API_KEYS.GEMINI_API_KEYS;
    currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % keys.length;
    console.log(`🔄 [GEMINI] Rotated to key ${currentGeminiKeyIndex + 1}/${keys.length}`);
}

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

// Gemini API - tries all keys on failure
async function callGeminiAPI(prompt) {
    const keys = API_KEYS.GEMINI_API_KEYS;
    const startIndex = currentGeminiKeyIndex;

    for (let i = 0; i < keys.length; i++) {
        try {
            const model = getGeminiModel();
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
        } catch (e) {
            console.log(`⚠️ [GEMINI] Key ${currentGeminiKeyIndex + 1} failed: ${e.message}`);
            rotateGeminiKey();

            // If we've tried all keys, throw
            if ((currentGeminiKeyIndex === startIndex && i > 0) || i === keys.length - 1) {
                throw new Error('All Gemini keys exhausted');
            }
        }
    }
}

// Gemini API for multimodal (audio/images) - tries all keys
async function callGeminiMultimodal(content) {
    const keys = API_KEYS.GEMINI_API_KEYS;
    const startIndex = currentGeminiKeyIndex;

    for (let i = 0; i < keys.length; i++) {
        try {
            const model = getGeminiModel();
            const result = await model.generateContent(content);
            return result.response.text().trim();
        } catch (e) {
            console.log(`⚠️ [GEMINI] Key ${currentGeminiKeyIndex + 1} failed: ${e.message}`);
            rotateGeminiKey();

            if ((currentGeminiKeyIndex === startIndex && i > 0) || i === keys.length - 1) {
                throw new Error('All Gemini keys exhausted');
            }
        }
    }
}

// ============== TEXT-TO-SPEECH (AWS Polly) ==============
async function textToSpeech(text) {
    const client = getPollyClient();
    if (!client) {
        console.log('⚠️ [TTS] AWS Polly not configured');
        return null;
    }

    try {
        // Limit text length for Polly (max 3000 chars for standard voices)
        const truncatedText = text.length > 2500 ? text.substring(0, 2500) + '...' : text;

        const command = new SynthesizeSpeechCommand({
            Text: truncatedText,
            OutputFormat: 'mp3',         // MP3 format for WhatsApp compatibility
            VoiceId: 'Kajal',           // Hindi/Urdu female voice
            Engine: 'neural',           // Neural engine for better quality
            LanguageCode: 'hi-IN'       // Hindi language
        });

        const response = await client.send(command);

        // Convert stream to buffer
        const chunks = [];
        for await (const chunk of response.AudioStream) {
            chunks.push(chunk);
        }
        const audioBuffer = Buffer.concat(chunks);

        console.log('🔊 [TTS] AWS Polly audio generated:', audioBuffer.length, 'bytes');
        return audioBuffer;
    } catch (e) {
        console.error('❌ [TTS] AWS Polly failed:', e.message);
        return null;
    }
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

    // Step 2: Request transcription with language detection
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
            'authorization': assemblyAIKey,
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            audio_url: upload_url,
            language_detection: true  // Auto-detect language (English, Urdu, Hindi, etc.)
        })
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

// VOICE: Speech-to-Text (AssemblyAI) → AI Response → Text-to-Speech (AWS Polly)
// Returns: { text: string, audioBuffer: Buffer|null }
async function tryVoiceAPIs(systemPrompt, media) {
    // Step 1: Convert voice to text using AssemblyAI
    let transcription;
    let replyText;

    try {
        // Convert base64 to buffer
        const audioBuffer = Buffer.from(media.data, 'base64');

        // Send to AssemblyAI
        transcription = await transcribeWithAssemblyAI(audioBuffer);
        console.log('🎤 [VOICE] AssemblyAI transcription:', transcription);
    } catch (e) {
        console.error('❌ [VOICE] AssemblyAI failed:', e.message);

        // Fallback to Gemini for direct audio processing (tries all keys)
        try {
            const voicePrompt = `${systemPrompt}
   
**The user has sent a voice message. Please listen to the transcription and respond directly.**

Your goal is to provide a friendly, helpful, and concise response to the user's voice message content.

**CRITICAL LANGUAGE & EMOJI RULES:**
1.  **Language Auto-Detection:** If the detected language of the transcription is **Urdu**, reply **only** in **Urdu Script (ا ب پ...)**. If the language is **English** or any other language, reply **only** in **English**.
2.  **No Emojis:** Do not use any emojis in your reply.
`;

            // Format:
            //     "User ne kaha: [summary]"
            //         [Your response]

            replyText = await callGeminiMultimodal([
                { text: voicePrompt },
                {
                    inlineData: {
                        mimeType: media.mimetype,
                        data: media.data
                    }
                }
            ]);
            console.log('🎤 [VOICE] Gemini (direct audio) ✓');

            // Convert reply to audio
            const replyAudio = await textToSpeech(replyText);
            return { text: replyText, audioBuffer: replyAudio };
        } catch (geminiError) {
            console.error('❌ [VOICE] Gemini also failed:', geminiError.message);
            return { text: "Voice message samajh nahi aaya. Text mein bhejein.", audioBuffer: null };
        }
    }

    // Step 2: Send transcribed text to Claude/Grok/Gemini (use General routing)
    const voiceContext = `
    **The user has sent a voice message.   "${transcription}"
    Please listen to the transcription and respond directly.**

Your goal is to provide a friendly, helpful, and concise response to the user's voice message content.

**CRITICAL LANGUAGE & EMOJI RULES:**
1.  **Language Auto-Detection:** If the detected language of the transcription is **Urdu**, reply **only** in **Urdu Language.**. If the language is **English**, reply **only** in **English**.
2.  **No Emojis:** Do not use any emojis in your reply.
`;

    // Use the general routing (Claude → Grok → Gemini)
    replyText = await tryGeneralAPIs(systemPrompt, voiceContext);
    console.log('🎤 [VOICE] Response via text API ✓');

    // Step 3: Convert reply to audio using AWS Polly
    const replyAudio = await textToSpeech(replyText);

    return { text: replyText, audioBuffer: replyAudio };
}

// ============== EXPORTS ==============
module.exports = {
    isCodingQuestion,
    tryCodingAPIs,
    tryGeneralAPIs,
    tryVoiceAPIs
};
