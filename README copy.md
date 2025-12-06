# WhatsApp AI Bot

Sulman Bhai ka personal AI assistant jo WhatsApp pe automatically reply karta hai.

---

## Features

- Automatic AI replies (Gemini AI)
- Chat memory (pichli baatein yaad rakhta hai)
- Per-chat control (specific chat on/off)
- Global control (sab chats on/off)
- New user intro message

---

## Code Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    1. BOT START                             │
├─────────────────────────────────────────────────────────────┤
│  node index.js                                              │
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

## File Structure

```
whatsapp-bot/
├── index.js           # Main bot code (sab kuch yahan hai)
├── package.json       # Dependencies list
├── package-lock.json  # Dependencies lock
├── node_modules/      # Installed packages
└── .wwebjs_auth/      # WhatsApp session (login data)
```

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

### Step 5: API Key Update Karo (Optional)

`index.js` kholein aur apni Gemini API key daalein:
```javascript
GEMINI_API_KEY: "your-api-key-here"
```

Free API key: https://aistudio.google.com/apikey

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

## Configuration

`index.js` mein CONFIG section mein change kar sakte ho:

```javascript
const CONFIG = {
    GEMINI_API_KEY: "your-key",      // AI API key
    BOT_NAME: "Sulman's AI Assistant",
    OWNER_NAME: "Sulman Bhai",
    INTRO_MESSAGE: `...`,            // New user ko message
    AI_PREFIX: "_AI Assistant_\n\n", // Har reply ke start mein
    SYSTEM_PROMPT: `...`,            // AI ko instructions
    MAX_RESPONSE_LENGTH: 500,        // Max reply length
    ALLOWED_NUMBERS: []              // Empty = sab ko reply
};
```

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


how can i live my this project now??

● To keep your bot running 24/7, use PM2 (Process Manager):

Option 1: PM2 (Recommended)

# Install PM2 globally
npm install -g pm2

# Start your bot
pm2 start index.js --name "whatsapp-bot"

# Make it auto-start on system reboot
pm2 startup
pm2 save

# Useful commands:
pm2 logs whatsapp-bot    # View logs
pm2 restart whatsapp-bot # Restart bot
pm2 stop whatsapp-bot    # Stop bot
pm2 status               # Check status

Option 2: Screen (Simple)

# Install screen
sudo apt install screen

# Create new screen session
screen -S whatsapp-bot

# Run your bot
node index.js

# Detach: Press Ctrl+A then D
# Reattach later: screen -r whatsapp-bot

Option 3: Systemd Service (Linux)

Create /etc/systemd/system/whatsapp-bot.service:
[Unit]
Description=WhatsApp Bot
After=network.target

[Service]
Type=simple
User=sulman-ali
WorkingDirectory=/home/sulman-ali/Pictures/claude/bot-git/AI-agent
ExecStart=/usr/bin/node index.js
Restart=always

[Install]
WantedBy=multi-user.target

Then:
sudo systemctl enable whatsapp-bot
sudo systemctl start whatsapp-bot

  ---
Want me to set up PM2 for you?

