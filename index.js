const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

// ============== LOAD MODULES ==============
const PROMPTS = require('./prompts.js');
const { isCodingQuestion, tryCodingAPIs, tryGeneralAPIs, tryVoiceAPIs } = require('./utils/ai-providers.js');

// ============== LOAD ALL DATA FILES ==============
const DATA_FOLDER = path.join(__dirname, 'data');
const SUPPORTED_EXTENSIONS = ['.txt', '.pdf', '.doc', '.docx', '.md'];

async function readFileContent(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    try {
        if (ext === '.txt' || ext === '.md') {
            return fs.readFileSync(filePath, 'utf8');
        }
        if (ext === '.pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdf(dataBuffer);
            return pdfData.text;
        }
        if (ext === '.docx') {
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value;
        }
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
    // YOUR WhatsApp number (for admin commands)
    ADMIN_NUMBER: "923127212913@c.us",

    // Values from prompts.js
    BOT_NAME: PROMPTS.BOT_NAME,
    OWNER_NAME: PROMPTS.OWNER_NAME,
    INTRO_MESSAGE: PROMPTS.INTRO_MESSAGE,
    AI_PREFIX: PROMPTS.AI_PREFIX,
    SYSTEM_PROMPT: PROMPTS.SYSTEM_PROMPT + `

============ SULMAN KI PERSONAL INFORMATION ============
${personalData}
========================================================`,

    MAX_RESPONSE_LENGTH: 500,
    ALLOWED_NUMBERS: []
};

// ============== BOT CONTROL ==============
let botActive = true;
const pausedChats = new Set();

// ============== CHAT MEMORY ==============
const chatHistory = new Map();
const newUsers = new Set();
const MAX_HISTORY = 10;

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
    if (CONFIG.ALLOWED_NUMBERS.length > 0 && !CONFIG.ALLOWED_NUMBERS.includes(sender)) {
        return null;
    }

    try {
        const historyContext = formatHistoryForPrompt(sender);
        const fullSystemPrompt = CONFIG.SYSTEM_PROMPT + historyContext;

        let reply = await tryVoiceAPIs(fullSystemPrompt, media);

        if (reply.length > CONFIG.MAX_RESPONSE_LENGTH) {
            reply = reply.substring(0, CONFIG.MAX_RESPONSE_LENGTH) + "...";
        }

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

    if (CONFIG.ALLOWED_NUMBERS.length > 0 && !CONFIG.ALLOWED_NUMBERS.includes(sender)) {
        return null;
    }

    if (msgLower === 'clear' || msgLower === '/reset') {
        clearHistory(sender);
        return CONFIG.AI_PREFIX + "Chat history clear ho gayi! Fresh start.";
    }

    try {
        const historyContext = formatHistoryForPrompt(sender);
        const fullSystemPrompt = CONFIG.SYSTEM_PROMPT + historyContext;

        const isCoding = isCodingQuestion(userMessage);
        let reply;

        if (isCoding) {
            reply = await tryCodingAPIs(fullSystemPrompt, userMessage);
        } else {
            reply = await tryGeneralAPIs(fullSystemPrompt, userMessage);
        }

        if (reply.length > CONFIG.MAX_RESPONSE_LENGTH) {
            reply = reply.substring(0, CONFIG.MAX_RESPONSE_LENGTH) + "...";
        }

        addToHistory(sender, 'User', userMessage);
        addToHistory(sender, 'Assistant', reply);

        return CONFIG.AI_PREFIX + reply;
    } catch (error) {
        console.error('AI Error:', error.message);
        return CONFIG.AI_PREFIX + "Sorry, kuch error aa gaya. Thodi der baad try karein.";
    }
}

// ============== WHATSAPP CLIENT ==============
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

// Authentication Events
client.on('authenticated', () => {
    console.log('🔐 Authentication successful!');
});

client.on('auth_failure', (msg) => {
    console.error('❌ Authentication failed:', msg);
});

client.on('disconnected', (reason) => {
    console.log('🔌 Disconnected:', reason);
    console.log('🔄 Reconnecting...');
    client.initialize();
});

// ============== ADMIN COMMANDS ==============
client.on('message_create', async (message) => {
    if (!message.fromMe) return;

    const msgLower = message.body.toLowerCase().trim();
    const chatId = message.to;

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
    if (msgLower === '/stopall') {
        botActive = false;
        console.log('🛑 Bot GLOBALLY PAUSED');
        await message.reply('🛑 Bot GLOBALLY PAUSED - Sab chats mein band');
        return;
    }
    if (msgLower === '/startall') {
        botActive = true;
        pausedChats.clear();
        console.log('✅ Bot GLOBALLY ACTIVE');
        await message.reply('✅ Bot GLOBALLY ACTIVE - Sab chats mein shuru');
        return;
    }
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

// ============== MESSAGE HANDLER ==============
client.on('message', async (message) => {
    if (message.fromMe ||
        message.from.includes('@g.us') ||
        message.from.includes('@newsletter') ||
        message.from === 'status@broadcast' ||
        message.isStatus) {
        return;
    }

    const sender = message.from;

    if (!botActive) {
        console.log(`⏸️ Bot globally paused - ignoring: ${sender}`);
        return;
    }

    if (pausedChats.has(sender)) {
        console.log(`⏸️ Chat paused - ignoring: ${sender}`);
        return;
    }

    try {
        if (isNewUser(sender)) {
            markUserAsIntroduced(sender);
            await message.reply(CONFIG.INTRO_MESSAGE);
            console.log(`👋 Intro sent to new user: ${sender}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        let aiResponse;

        if (message.hasMedia && message.type === 'ptt') {
            console.log(`\n🎤 Voice message from ${sender}`);
            const media = await message.downloadMedia();

            if (media) {
                aiResponse = await getVoiceResponse(media, sender);
            } else {
                aiResponse = CONFIG.AI_PREFIX + "Voice message download nahi ho saka. Dobara bhejein.";
            }
        } else {
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
        await message.reply('Sorry, kuch error aa gaya. Thodi der baad try karein. ');
    }
});

// Start the client
console.log('🚀 WhatsApp Bot starting...');
console.log('⏳ Please wait...\n');
client.initialize();
