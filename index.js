const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const express = require('express');
require('dotenv').config();

// ============== EXPRESS SERVER FOR LOCATION TRACKING ==============
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const LOCATION_FILE = path.join(DATA_DIR, 'locations.json');

// Server URL for backend API (Fly.io)
const SERVER_URL = process.env.SERVER_URL || 'https://sulman-whatsapp-bot.fly.dev';

// Location page URL (Vercel) - for sending to users
const LOCATION_PAGE_URL = process.env.LOCATION_PAGE_URL || 'https://location-tracker-tau-plum.vercel.app';

// Ensure data directory and locations file exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(LOCATION_FILE)) {
    fs.writeFileSync(LOCATION_FILE, '[]');
}

// CORS - MUST be FIRST before other middleware V+
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        console.log('📡 CORS preflight request from:', req.headers.origin);
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint for Fly.io
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /location - Receive location from HTML page
app.post('/location', async (req, res) => {
    console.log('📡 POST /location received');
    console.log('📡 Body:', JSON.stringify(req.body));

    try {
        const { user, latitude, longitude, accuracy, timestamp } = req.body;

        console.log(`📍 Location received from ${user}:`);
        console.log(`   Lat: ${latitude}, Lng: ${longitude}, Accuracy: ${accuracy}m`);

        // Create location entry
        const locationEntry = {
            user: user ? `${user}@c.us` : 'unknown',
            latitude,
            longitude,
            accuracy,
            timestamp: timestamp || new Date().toISOString(),
            googleMapsLink: `https://maps.google.com/?q=${latitude},${longitude}`
        };

        // Save to file
        let locations = [];
        try {
            if (fs.existsSync(LOCATION_FILE)) {
                locations = JSON.parse(fs.readFileSync(LOCATION_FILE, 'utf8'));
            }
        } catch (e) {
            locations = [];
        }
        locations.push(locationEntry);
        fs.writeFileSync(LOCATION_FILE, JSON.stringify(locations, null, 2));
        console.log('💾 Location saved to file');

        // Send WhatsApp notification to admin
        if (client && client.info) {
            const adminNumber = CONFIG.ADMIN_NUMBER;
            const locationMessage = `📍 *Location Received!*

👤 User: ${user || 'Unknown'}
🌐 Coordinates: ${latitude}, ${longitude}
📏 Accuracy: ${Math.round(accuracy)}m
🕐 Time: ${new Date(timestamp).toLocaleString()}

🗺️ Google Maps:
${locationEntry.googleMapsLink}`;

            try {
                await client.sendMessage(adminNumber, locationMessage);
                console.log('📱 WhatsApp notification sent to admin');
            } catch (waError) {
                console.error('❌ Failed to send WhatsApp notification:', waError.message);
            }
        }

        res.json({ success: true, message: 'Location received' });
    } catch (error) {
        console.error('❌ Location error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start Express server - bind to 0.0.0.0 for Fly.io
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Express server running on http://0.0.0.0:${PORT}`);
    console.log(`📍 Location page: ${SERVER_URL}/location.html`);
});

// ============== LOAD MODULES ==============
const PROMPTS = require('./prompts.js');
const { isCodingQuestion, tryCodingAPIs, tryGeneralAPIs, tryVoiceAPIs } = require('./utils/ai-providers.js');
// ============== LOAD ALL DATA FILES ==============
// DATA_DIR is defined at the top of the file
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
    personalData = await loadAllDataFiles(DATA_DIR);
    console.log('✅ All data files loaded!');
})();
// ============== CONFIGURATION ==============
const CONFIG = {
    // YOUR WhatsApp number (for admin commands)
    ADMIN_NUMBER: process.env.ADMIN_NUMBER || "923127212913@c.us",

    // Values from prompts.js
    BOT_NAME: PROMPTS.BOT_NAME,
    OWNER_NAME: PROMPTS.OWNER_NAME,
    INTRO_MESSAGE: PROMPTS.INTRO_MESSAGE,
    AI_PREFIX: PROMPTS.AI_PREFIX,

    // Modular prompts - combined with personal data
    BASE_PROMPT: PROMPTS.SYSTEM_PROMPT + `

============ SULMAN KI PERSONAL INFORMATION ============
${personalData}
========================================================`,

    // Specific prompts for different scenarios
    TEXT_PROMPT: PROMPTS.TEXT_PROMPT || '',
    VOICE_PROMPT: PROMPTS.VOICE_PROMPT || '',
    CODING_PROMPT: PROMPTS.CODING_PROMPT || '',

    MAX_RESPONSE_LENGTH: 2500,
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
// Returns: { text: string, audioBuffer: Buffer|null }
async function getVoiceResponse(media, sender) {
    if (CONFIG.ALLOWED_NUMBERS.length > 0 && !CONFIG.ALLOWED_NUMBERS.includes(sender)) {
        return null;
    }

    try {
        const historyContext = formatHistoryForPrompt(sender);
        // Use BASE_PROMPT + VOICE_PROMPT for voice messages
        const fullSystemPrompt = CONFIG.BASE_PROMPT + CONFIG.VOICE_PROMPT + historyContext;

        const result = await tryVoiceAPIs(fullSystemPrompt, media);

        let replyText = result.text;
        if (replyText.length > CONFIG.MAX_RESPONSE_LENGTH) {
            replyText = replyText.substring(0, CONFIG.MAX_RESPONSE_LENGTH) + "...";
        }

        addToHistory(sender, 'User', '[Voice Message]');
        addToHistory(sender, 'Assistant', replyText);

        return {
            text: CONFIG.AI_PREFIX + "🎤 " + replyText,
            audioBuffer: result.audioBuffer
        };
    } catch (error) {
        console.error('Voice AI Error:', error.message);
        return {
            text: CONFIG.AI_PREFIX + "Sorry, voice message samajh nahi aaya. Text mein bhejein.",
            audioBuffer: null
        };
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
        const isCoding = isCodingQuestion(userMessage);

        // Use different prompts for coding vs general text
        let fullSystemPrompt;
        if (isCoding) {
            fullSystemPrompt = CONFIG.BASE_PROMPT + CONFIG.CODING_PROMPT + historyContext;
        } else {
            fullSystemPrompt = CONFIG.BASE_PROMPT + CONFIG.TEXT_PROMPT + historyContext;
        }

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
// puppeteer: {
//     headless: true,
//         executablePath: process.platform === 'win32'
//         ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
//         : (process.env.CHROME_PATH || '/usr/bin/google-chrome'),
//         args: process.platform === 'linux'
//         ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
//         : []
// executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
// }

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    }
});

// Debug events
client.on('loading_screen', (percent, message) => {
    console.log('DEBUG: Loading screen', percent, message);
});

// QR Code Display
client.on('qr', (qr) => {
    console.log('\n📱 WhatsApp Web se connect karne ke liye QR scan karein:\n');
    console.log('=== RAW QR CODE STRING (use online QR generator) ===');
    console.log(qr);
    console.log('====================================================\n');
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

    // /getlocation - Send location request link to user
    if (msgLower === '/getlocation') {
        // Extract user phone number from chatId (remove @c.us)
        const userPhone = chatId.replace('@c.us', '');
        const locationLink = `${LOCATION_PAGE_URL}?user=${userPhone}`;

        const locationRequest = `📍 *Location Share Request*

Please tap the link below to share your location:
${locationLink}

This helps us serve you better!`;

        try {
            await client.sendMessage(chatId, locationRequest);
            console.log(`📍 Location link sent to: ${chatId}`);
            await message.reply('✅ Location request link sent!');
        } catch (e) {
            console.error('❌ Failed to send location link:', e.message);
            await message.reply('❌ Failed to send location link');
        }
        return;
    }

    // /locations - View all collected locations
    if (msgLower === '/locations') {
        try {
            if (fs.existsSync(LOCATION_FILE)) {
                const locations = JSON.parse(fs.readFileSync(LOCATION_FILE, 'utf8'));
                if (locations.length === 0) {
                    await message.reply('📍 No locations collected yet.');
                } else {
                    let locationList = `📍 *Collected Locations (${locations.length})*\n\n`;
                    locations.slice(-5).forEach((loc, i) => {
                        locationList += `${i + 1}. ${loc.user}\n`;
                        locationList += `   📅 ${new Date(loc.timestamp).toLocaleString()}\n`;
                        locationList += `   🗺️ ${loc.googleMapsLink}\n\n`;
                    });
                    if (locations.length > 5) {
                        locationList += `... and ${locations.length - 5} more`;
                    }
                    await message.reply(locationList);
                }
            } else {
                await message.reply('📍 No locations file found.');
            }
        } catch (e) {
            await message.reply('❌ Error reading locations: ' + e.message);
        }
        return;
    }
});

// ============== MESSAGE HANDLER ==============
// Helper to decide whether to ignore a message (groups, status, newsletters, system/info notes, etc.)
async function shouldIgnoreMessage(message) {
    try {
        const type = (message.type || '').toLowerCase();
        const from = message.from || '';

        // Basic immediate filters
        if (message.fromMe) return true;
        if (message.isStatus) return true; // Status updates
        if (from === 'status@broadcast') return true; // Status broadcast
        if (from.includes('@newsletter')) return true; // Channels / newsletters
        if (from.includes('@g.us')) return true; // Groups by JID suffix

        // Chat object filters (more reliable)
        try {
            const chat = await message.getChat();
            if (chat) {
                if (chat.isGroup) return true; // Ignore all groups
                if (chat.isBroadcast) return true; // Broadcast lists
                if (chat.isReadOnly) return true; // Announcements / communities
            }
        } catch (_) { /* ignore chat fetch errors */ }

        // Only allow plain text chats and voice notes (ptt). Everything else ignored.
        const allowedTypes = new Set(['chat', 'ptt']);
        if (!allowedTypes.has(type)) return true;

        // For text, ensure there is a non-empty body
        if (type === 'chat') {
            const body = (message.body || '').trim();
            if (!body) return true;
        }

        // Extra safety: ignore well-known system/info types if surfaced differently
        const sysTypes = new Set([
            'notification',
            'call_log',
            'e2e_notification',
            'protocol',
            'ciphertext',
            'revoked',
            'gp2',
            'sender_key_distribution',
            'unknown'
        ]);
        if (sysTypes.has(type)) return true;

        return false;
    } catch (e) {
        // On any error, be safe and ignore
        return true;
    }
}

client.on('message', async (message) => {
    // Short-circuit for ignorable contexts
    if (await shouldIgnoreMessage(message)) return;

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

        const type = (message.type || '').toLowerCase();
        if (type === 'ptt' && message.hasMedia) {
            // Handle voice message - reply with voice
            console.log(`\n🎤 Voice message from ${sender}`);
            const media = await message.downloadMedia();

            if (media) {
                const voiceResult = await getVoiceResponse(media, sender);

                if (voiceResult) {
                    // Try to send voice reply first
                    if (voiceResult.audioBuffer) {
                        try {
                            const voiceMedia = new MessageMedia(
                                'audio/mpeg',
                                voiceResult.audioBuffer.toString('base64'),
                                'voice_reply.mp3'
                            );
                            // Send as audio file (plays in WhatsApp music player)
                            await message.reply(voiceMedia);
                            console.log(`✅ Voice reply sent`);
                        } catch (voiceError) {
                            console.error('❌ Voice send failed, falling back to text:', voiceError.message);
                            await message.reply(voiceResult.text);
                            console.log(`✅ Text reply sent (voice fallback)`);
                        }
                    } else {
                        // No audio available, send text
                        await message.reply(voiceResult.text);
                        console.log(`✅ Text reply sent (no audio)`);
                    }
                }
            } else {
                await message.reply(CONFIG.AI_PREFIX + "Voice message download nahi ho saka. Dobara bhejein.");
            }
        } else {
            // Handle text message - reply with text
            const userMessage = (message.body || '').trim();
            console.log(`\n📩 Message from ${sender}: ${userMessage}`);
            const aiResponse = await getAIResponse(userMessage, sender);

            if (aiResponse) {
                await message.reply(aiResponse);
                console.log(`✅ Reply sent: ${aiResponse.substring(0, 50)}...`);
            }
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        await message.reply('Sorry, kuch error aa gaya. Thodi der baad try karein. ');
    }
});

// Start the client
console.log('🚀 WhatsApp Bot starting...');
console.log('⏳ Please wait...\n');
console.log('DEBUG: Calling client.initialize()...');
client.initialize()
    .then(() => console.log('DEBUG: client.initialize() completed'))
    .catch(err => console.error('DEBUG: client.initialize() error:', err));
