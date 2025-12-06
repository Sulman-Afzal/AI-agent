# WhatsApp AI Bot

Sulman Bhai ka personal AI assistant jo WhatsApp pe automatically reply karta hai.

---

## Features

- Automatic AI replies (Gemini AI)
- Chat memory (pichli baatein yaad rakhta hai)
- Voice message support
- Multi-language support (Urdu, Punjabi, Sindhi, Pashto, Hindi, Arabic, etc.)
- Personal data integration (PDF, DOCX, TXT files)
- Per-chat control (specific chat on/off)
- Global control (sab chats on/off)
- New user intro message
- Easy customization (prompts.js file)

---

## File Structure

```
whatsapp-bot/
├── prompts.js         # ✏️ EDIT THIS - Bot name, intro, system prompt
├── index.js           # Main bot code (mat touch karo)
├── package.json       # Dependencies list
├── data/              # Personal data folder
│   ├── about_me.txt   # Apni info yahan likho
│   ├── politics/      # Politics related info
│   ├── pakistan/      # Pakistan info
│   └── other/         # Other information
├── node_modules/      # Installed packages
└── .wwebjs_auth/      # WhatsApp session (login data)
```

---

## Customization (prompts.js)

Bot ko customize karne ke liye sirf `prompts.js` file edit karo:

```javascript
module.exports = {
    BOT_NAME: "Sulman's AI Assistant",  // Bot ka naam
    OWNER_NAME: "Sulman Bhai",          // Owner ka naam
    INTRO_MESSAGE: `...`,               // New user ko message
    AI_PREFIX: "_AI Assistant_\n\n",    // Har reply ke start mein
    SYSTEM_PROMPT: `...`                // AI ko instructions
};
```

**Note:** Main `index.js` file mein sirf technical settings hain (API key, admin number). Content changes sirf `prompts.js` mein karo.

---

## Personal Data (data/ folder)

Bot apne baare mein information `data/` folder se leta hai:

- **TXT files** - Simple text
- **PDF files** - PDF documents
- **DOCX files** - Word documents
- **MD files** - Markdown files

Koi bhi file add karo `data/` folder mein, bot automatically read kar lega!

---

## Code Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    1. BOT START                             │
├─────────────────────────────────────────────────────────────┤
│  node index.js                                              │
│       ↓                                                     │
│  Load prompts.js + data/ files                              │
│       ↓                                                     │
│  WhatsApp Web se connect (QR scan - sirf pehli baar)        │
│       ↓                                                     │
│  "Bot Ready!" - Messages sunna shuru                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                 2. MESSAGE RECEIVE                          │
├─────────────────────────────────────────────────────────────┤
│  Koi WhatsApp pe message bhejta hai                         │
│       ↓                                                     │
│  Bot check karta hai:                                       │
│    - Kya bot globally active hai?                           │
│    - Kya ye chat paused hai?                                │
│    - Kya ye new user hai? (intro bhejo)                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  3. AI PROCESSING                           │
├─────────────────────────────────────────────────────────────┤
│  Message + Chat History → Gemini AI                         │
│       ↓                                                     │
│  AI response generate                                       │
│       ↓                                                     │
│  Response history mein save                                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   4. SEND REPLY                             │
├─────────────────────────────────────────────────────────────┤
│  AI response WhatsApp pe bhejo                              │
│       ↓                                                     │
│  User ko reply milta hai                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Admin Commands

Apne WhatsApp se ye commands bhej sakte ho:

| Command | Kya karega |
|---------|-----------|
| `/stop` | Sirf is chat mein AI band |
| `/start` | Sirf is chat mein AI shuru |
| `/stopall` | Sab chats mein AI band |
| `/startall` | Sab chats mein AI shuru |
| `/status` | Status dekho |
| `clear` | Chat history reset |

---

## How to Run (Dosre Laptop Pe)

### Step 1: Node.js Install Karo

1. https://nodejs.org pe jao
2. **LTS version** download karo
3. Install karo (Next Next Next)

Check karo install hua:
```bash
node --version
```

### Step 2: Google Chrome Install Karo

Agar Chrome nahi hai to install karo:
- https://google.com/chrome

### Step 3: Project Folder Copy Karo

Poora `whatsapp-bot` folder copy karo USB ya cloud se.

### Step 4: Dependencies Install Karo

Terminal/CMD kholein, folder mein jao:
```bash
cd path/to/whatsapp-bot
npm install
```

### Step 5: Configuration

**API Key (index.js mein):**
```javascript
GEMINI_API_KEY: "your-api-key-here"
```
Free API key: https://aistudio.google.com/apikey

**Admin Number (index.js mein):**
```javascript
ADMIN_NUMBER: "923001234567@c.us"  // Apna number
```

**Bot Content (prompts.js mein):**
- Bot name, intro message, system prompt edit karo

### Step 6: Bot Start Karo

```bash
node index.js
```

### Step 7: QR Code Scan Karo

1. Terminal mein QR code aayega
2. WhatsApp app kholein
3. Settings > Linked Devices > Link a Device
4. QR scan karo
5. Bot ready!

---

## Supported Languages

Bot in languages mein reply de sakta hai:

| Language | Example |
|----------|---------|
| English | Hello, how are you? |
| Roman Urdu | Kya haal hai? |
| Urdu | کیا حال ہے؟ |
| Punjabi | کی حال اے؟ |
| Sindhi | ڪيئن آهيو؟ |
| Pashto | څنګه یې؟ |
| Hindi | कैसे हो? |
| Arabic | كيف حالك؟ |
| Persian | چطوری؟ |
| Bengali | কেমন আছো? |

---

## Troubleshooting

### "Chrome not found" error
- Google Chrome install karo
- Ya `index.js` mein Chrome path update karo:
```javascript
executablePath: '/path/to/chrome'
```

### QR code nahi aa raha
- `.wwebjs_auth` folder delete karo
- Bot dobara start karo

### Bot reply nahi de raha
- Check karo bot paused to nahi (`/status`)
- Check karo API key sahi hai
- Terminal mein errors dekho

---

## Bot Band Karna

Terminal mein `Ctrl + C` dabao.

---

## Notes

- Bot sirf tab chalega jab laptop on ho aur terminal open ho
- Pehli baar QR scan karna padega, baad mein automatically connect hoga
- `.wwebjs_auth` folder mein login data hai - delete karoge to dobara QR scan

---

*Made with Gemini AI + whatsapp-web.js*
