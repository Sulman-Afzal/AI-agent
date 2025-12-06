const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

// ============== LOAD PROMPTS (Easy to edit) ==============
const PROMPTS = require('./prompts.js');

// ============== LOAD ALL DATA FILES ==============
const DATA_FOLDER = path.join(__dirname, 'data');

// Supported file extensions
const SUPPORTED_EXTENSIONS = ['.txt', '.pdf', '.doc', '.docx', '.md'];

async function readFileContent(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    try {
        // TXT, MD files
        if (ext === '.txt' || ext === '.md') {
            return fs.readFileSync(filePath, 'utf8');
        }

        // PDF files
        if (ext === '.pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdf(dataBuffer);
            return pdfData.text;
        }

        // DOCX files
        if (ext === '.docx') {
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value;
        }

        // DOC files (old format - try as text)
        if (ext === '.doc') {
            try {
                return fs.readFileSync(filePath, 'utf8');
            } catch {
                return '[DOC file - convert to DOCX for better support]';
            }
        }

        return '';
    } catch (error) {
        console.log(`⚠️ Error reading ${filePath}:`, error.message);
        return '';
    }
}

async function loadAllDataFiles(dir) {
    let allData = '';
    try {
        if (!fs.existsSync(dir)) return '';

        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                // Recursively read subfolders
                allData += await loadAllDataFiles(fullPath);
            } else {
                const ext = path.extname(item).toLowerCase();
                if (SUPPORTED_EXTENSIONS.includes(ext)) {
                    const content = await readFileContent(fullPath);
                    if (content) {
                        allData += `\n\n=== ${item} ===\n${content}`;
                        console.log(`📁 Loaded: ${item}`);
                    }
                }
            }
        }
    } catch (error) {
        console.log('⚠️ Error loading data:', error.message);
    }
    return allData;
}

// Load data (async IIFE)
let personalData = '';
(async () => {
    personalData = await loadAllDataFiles(DATA_FOLDER);
    console.log('✅ All data files loaded!');
})();

// ============== CONFIGURATION ==============
const CONFIG = {
    GEMINI_API_KEY: "AIzaSyBlom38eLp0WmVibEfkcm_o9xjpM_lUalU",

    // YOUR WhatsApp number (for admin commands)
    // Format: "923001234567@c.us" (country code + number + @c.us)
    ADMIN_NUMBER: "923127212913@c.us",  // <-- Apna number yahan daalein

    // ===== THESE VALUES COME FROM prompts.js =====
    BOT_NAME: PROMPTS.BOT_NAME,
    OWNER_NAME: PROMPTS.OWNER_NAME,
    INTRO_MESSAGE: PROMPTS.INTRO_MESSAGE,
    AI_PREFIX: PROMPTS.AI_PREFIX,
    SYSTEM_PROMPT: PROMPTS.SYSTEM_PROMPT + `

============ SULMAN KI PERSONAL INFORMATION ============
${personalData}
========================================================`,

    MAX_RESPONSE_LENGTH: 500,
    ALLOWED_NUMBERS: [] // Empty = reply to everyone
};

// ============== GEMINI AI SETUP ==============
const genAI = new GoogleGenerativeAI(CONFIG.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// ============== BOT CONTROL ==============
let botActive = true; // Global bot on/off status
const pausedChats = new Set(); // Specific chats that are paused

// ============== CHAT MEMORY ==============
const chatHistory = new Map(); // sender -> [{role, content}]
const newUsers = new Set(); // Track users who have received intro
const MAX_HISTORY = 10; // Last 10 messages per user

function getChatHistory(sender) {
    if (!chatHistory.has(sender)) {
        chatHistory.set(sender, []);
    }
    return chatHistory.get(sender);
}

function isNewUser(sender) {
    return !newUsers.has(sender);
}

function markUserAsIntroduced(sender) {
    newUsers.add(sender);
}

function addToHistory(sender, role, content) {
    const history = getChatHistory(sender);
    history.push({ role, content });

    // Keep only last MAX_HISTORY messages
    if (history.length > MAX_HISTORY) {
        history.shift();
    }
}

function clearHistory(sender) {
    chatHistory.set(sender, []);
}

function formatHistoryForPrompt(sender) {
    const history = getChatHistory(sender);
    if (history.length === 0) return "";

    let formatted = "\n\nPrevious conversation:\n";
    history.forEach(msg => {
        formatted += `${msg.role}: ${msg.content}\n`;
    });
    return formatted;
}

// ============== VOICE MESSAGE HANDLER ==============
async function getVoiceResponse(media, sender) {
    // Check if sender is allowed
    if (CONFIG.ALLOWED_NUMBERS.length > 0 && !CONFIG.ALLOWED_NUMBERS.includes(sender)) {
        return null;
    }

    try {
        // Build prompt with history
        const historyContext = formatHistoryForPrompt(sender);

        // Send audio to Gemini with context
        const result = await model.generateContent([
            {
                text: `${CONFIG.SYSTEM_PROMPT}${historyContext}

User ne voice message bheja hai. Isko suno aur respond karo.
Pehle briefly batao user ne kya kaha (1 line), phir jawab do.

Format:
"G ap [brief summary]"
[Your response]`
            },
            {
                inlineData: {
                    mimeType: media.mimetype,
                    data: media.data
                }
            }
        ]);

        let reply = result.response.text().trim();

        // Limit response length
        if (reply.length > CONFIG.MAX_RESPONSE_LENGTH) {
            reply = reply.substring(0, CONFIG.MAX_RESPONSE_LENGTH) + "...";
        }

        // Save to history
        addToHistory(sender, 'User', '[Voice Message]');
        addToHistory(sender, 'Assistant', reply);

        return CONFIG.AI_PREFIX + "🎤 " + reply;
    } catch (error) {
        console.error('Voice AI Error:', error.message);
        return CONFIG.AI_PREFIX + "Sorry, voice message samajh nahi aaya. Text mein bhejein.";
    }
}

// ============== TEXT MESSAGE HANDLER ==============
async function getAIResponse(userMessage, sender) {
    const msgLower = userMessage.toLowerCase().trim();

    // Check if sender is allowed
    if (CONFIG.ALLOWED_NUMBERS.length > 0 && !CONFIG.ALLOWED_NUMBERS.includes(sender)) {
        return null;
    }

    // Check for clear command
    if (msgLower === 'clear' || msgLower === '/reset') {
        clearHistory(sender);
        return CONFIG.AI_PREFIX + "Chat history clear ho gayi! Fresh start.";
    }

    try {
        // Build prompt with history
        const historyContext = formatHistoryForPrompt(sender);
        const prompt = `${CONFIG.SYSTEM_PROMPT}${historyContext}\n\nUser: ${userMessage}\n\nReply:`;

        const result = await model.generateContent(prompt);
        let reply = result.response.text().trim();

        // Limit response length
        if (reply.length > CONFIG.MAX_RESPONSE_LENGTH) {
            reply = reply.substring(0, CONFIG.MAX_RESPONSE_LENGTH) + "...";
        }

        // Save to history
        addToHistory(sender, 'User', userMessage);
        addToHistory(sender, 'Assistant', reply);

        // Add AI prefix to response
        return CONFIG.AI_PREFIX + reply;
    } catch (error) {
        console.error('AI Error:', error.message);

        if (error.message.includes('API_KEY') || error.message.includes('401')) {
            return CONFIG.AI_PREFIX + "API key mein masla hai. Config check karein.";
        } else if (error.message.includes('quota') || error.message.includes('429')) {
            return CONFIG.AI_PREFIX + "API limit ho gayi. Thodi der baad try karein.";
        } else {
            return CONFIG.AI_PREFIX + "Sorry, kuch error aa gaya. Thodi der baad try karein.";
        }
    }
}

// ============== WHATSAPP CLIENT SETUP ==============
const client = new Client({
    authStrategy: new LocalAuth(),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/AriGlenn/wa-version/main/html/2.2412.54.html'
    },
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    }
});

// QR Code Display
client.on('qr', (qr) => {
    console.log('\n📱 WhatsApp Web se connect karne ke liye QR scan karein:\n');
    qrcode.generate(qr, { small: true });
});

// Ready Event
client.on('ready', () => {
    console.log('\n✅ Bot Ready! WhatsApp se connected hai.\n');
    console.log('📨 Ab messages ka wait kar raha hoon...\n');
});

// Authentication Success
client.on('authenticated', () => {
    console.log('🔐 Authentication successful!');
});

// Authentication Failure
client.on('auth_failure', (msg) => {
    console.error('❌ Authentication failed:', msg);
});

// Disconnected
client.on('disconnected', (reason) => {
    console.log('🔌 Disconnected:', reason);
    console.log('🔄 Reconnecting...');
    client.initialize();
});

// ============== ADMIN COMMANDS (your own sent messages) ==============
client.on('message_create', async (message) => {
    // Only process messages sent by you (admin)
    if (!message.fromMe) return;

    const msgLower = message.body.toLowerCase().trim();
    const chatId = message.to; // The chat you're sending to

    // ===== PER-CHAT COMMANDS =====
    if (msgLower === '/stop' || msgLower === '/pause') {
        pausedChats.add(chatId);
        console.log(`🛑 Chat PAUSED: ${chatId}`);
        await message.reply('🛑 Is chat mein AI reply band - /start se shuru karo');
        return;
    }
    if (msgLower === '/start' || msgLower === '/resume') {
        pausedChats.delete(chatId);
        console.log(`✅ Chat RESUMED: ${chatId}`);
        await message.reply('✅ Is chat mein AI reply shuru');
        return;
    }

    // ===== GLOBAL COMMANDS =====
    if (msgLower === '/stopall') {
        botActive = false;
        console.log('🛑 Bot GLOBALLY PAUSED');
        await message.reply('🛑 Bot GLOBALLY PAUSED - Sab chats mein band');
        return;
    }
    if (msgLower === '/startall') {
        botActive = true;
        pausedChats.clear(); // Clear all per-chat pauses too
        console.log('✅ Bot GLOBALLY ACTIVE');
        await message.reply('✅ Bot GLOBALLY ACTIVE - Sab chats mein shuru');
        return;
    }

    // ===== STATUS =====
    if (msgLower === '/status') {
        const chatPaused = pausedChats.has(chatId);
        const status = `📊 Status:
• Global: ${botActive ? '✅ ACTIVE' : '🛑 PAUSED'}
• Is chat: ${chatPaused ? '🛑 PAUSED' : '✅ ACTIVE'}
• Paused chats: ${pausedChats.size}`;
        console.log(status);
        await message.reply(status);
        return;
    }
});

// ============== MESSAGE HANDLER (incoming messages) ==============
client.on('message', async (message) => {
    // Ignore own messages, group messages, channels, and status updates
    if (message.fromMe ||
        message.from.includes('@g.us') ||
        message.from.includes('@newsletter') ||
        message.from === 'status@broadcast' ||
        message.isStatus) {
        return;
    }

    const sender = message.from;

    // If bot is globally paused, don't reply
    if (!botActive) {
        console.log(`⏸️ Bot globally paused - ignoring: ${sender}`);
        return;
    }

    // If this specific chat is paused, don't reply
    if (pausedChats.has(sender)) {
        console.log(`⏸️ Chat paused - ignoring: ${sender}`);
        return;
    }

    try {
        // ===== NEW USER - Send intro first =====
        if (isNewUser(sender)) {
            markUserAsIntroduced(sender);
            await message.reply(CONFIG.INTRO_MESSAGE);
            console.log(`👋 Intro sent to new user: ${sender}`);
            // Small delay before sending actual reply
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        let aiResponse;

        // ===== VOICE MESSAGE =====
        if (message.hasMedia && message.type === 'ptt') {
            console.log(`\n🎤 Voice message from ${sender}`);

            // Download voice message
            const media = await message.downloadMedia();

            if (media) {
                aiResponse = await getVoiceResponse(media, sender);
            } else {
                aiResponse = CONFIG.AI_PREFIX + "Voice message download nahi ho saka. Dobara bhejein.";
            }
        }
        // ===== TEXT MESSAGE =====
        else {
            const userMessage = message.body;
            console.log(`\n📩 Message from ${sender}: ${userMessage}`);
            aiResponse = await getAIResponse(userMessage, sender);
        }

        if (aiResponse) {
            await message.reply(aiResponse);
            console.log(`✅ Reply sent: ${aiResponse.substring(0, 50)}...`);
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        await message.reply('Sorry, kuch error aa gaya. Thodi der baad try karein.');
    }
});

// Start the client
console.log('🚀 WhatsApp Bot starting...');
console.log('⏳ Please wait...\n');
client.initialize();
