# WhatsApp Bot Deployment Guide for Fly.io

## Prerequisites

1. **Fly.io CLI installed**: Install from https://fly.io/docs/hands-on/install-flyctl/
2. **Fly.io account**: Sign up at https://fly.io
3. **Login to Fly.io**:
   ```bash
   fly auth login
   ```

---

## Step 1: Project Files Setup

### Required Files

#### 1. `Dockerfile`
```dockerfile
# Use an official Node.js runtime as a parent image
FROM node:20-slim

# Set the working directory in the container
WORKDIR /app

# Install dependencies for Puppeteer (Headless Chrome)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    # Install Google Chrome
    && wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get install -y ./google-chrome-stable_current_amd64.deb \
    && rm google-chrome-stable_current_amd64.deb \
    # Clean up
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install --only=production

# Copy the rest of the application code
COPY . .

# Create directory for session (will be mounted as volume on Fly.io)
RUN mkdir -p /app/.wwebjs_auth

# Define the command to run the bot
CMD ["node", "index.js"]
```

#### 2. `fly.toml`
```toml
app = 'sulman-whatsapp-bot'
primary_region = 'sin'

[build]
  dockerfile = 'Dockerfile'

[env]
  CHROME_PATH = '/usr/bin/google-chrome'
  NODE_ENV = 'production'

[[mounts]]
  source = 'wwebjs_session'
  destination = '/app/.wwebjs_auth'

[[vm]]
  memory = '1024mb'
  cpu_kind = 'shared'
  cpus = 1
```

#### 3. `.dockerignore`
```
node_modules
.wwebjs_auth
.env
*.log
.git
```

#### 4. Update `index.js` - Puppeteer config must use environment variable for Chrome path:
```javascript
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    }
});
```

---

## Step 2: Initial Deployment

### 2.1 Launch the App (First Time Only)
```bash
cd /home/sulman-ali/Pictures/claude/bot-git/AI-agent
fly launch --no-deploy
```
- This creates the app on Fly.io
- Choose a unique app name or accept the generated one
- Select region (sin = Singapore is good for Pakistan)
- Say NO to deploy now

### 2.2 Create Persistent Volume (First Time Only)
```bash
fly volumes create wwebjs_session --size 1 --region sin
```
- This creates a 1GB persistent volume for WhatsApp session data
- Session data survives container restarts

### 2.3 Set Environment Secrets
```bash
fly secrets set CLAUDE_API_KEY=your-claude-api-key
fly secrets set OPENAI_API_KEY=your-openai-api-key
fly secrets set GEMINI_API_KEYS=key1,key2
fly secrets set GROK_API_KEY=your-grok-key
fly secrets set ASSEMBLYAI_API_KEY=your-assemblyai-key
fly secrets set AWS_ACCESS_KEY_ID=your-aws-key
fly secrets set AWS_SECRET_ACCESS_KEY=your-aws-secret
fly secrets set AWS_REGION=us-east-1
fly secrets set ADMIN_NUMBER=923127212913@c.us
```

### 2.4 Deploy
```bash
fly deploy
```

---

## Step 3: Scan QR Code

### Option A: Watch Logs
```bash
fly logs
```
Wait for the QR code to appear in the terminal.

### Option B: SSH into Container
```bash
fly ssh console
```
Then run manually:
```bash
node index.js
```
This shows better QR output.

### Option C: Use Raw QR String
If QR doesn't render properly, copy the raw QR string from logs and paste it into:
- https://www.qr-code-generator.com/
- Or any online QR generator

Then scan with WhatsApp.

---

## Common Commands

### Check App Status
```bash
fly status
```

### View Logs
```bash
fly logs              # Live streaming logs
fly logs --no-tail    # Recent logs snapshot
```

### Restart Machine
```bash
fly machines list                    # Get machine ID
fly machines restart <machine-id>    # Restart it
```

### SSH into Container
```bash
fly ssh console                      # Interactive shell
fly ssh console -C "command"         # Run single command
```

### Stop/Start App
```bash
fly apps stop sulman-whatsapp-bot
fly apps start sulman-whatsapp-bot
```

### Redeploy After Code Changes
```bash
fly deploy
```

---

## Troubleshooting

### Issue: "SingletonLock: File exists" Error
Chrome crashed and left a lock file. Fix:
```bash
fly ssh console -C "rm -f /app/.wwebjs_auth/session/SingletonLock"
fly machines restart <machine-id>
```

### Issue: QR Code Not Appearing
1. Clear session data:
```bash
fly ssh console -C "rm -rf /app/.wwebjs_auth/session"
fly machines restart <machine-id>
```

2. Check if Chrome is installed:
```bash
fly ssh console -C "google-chrome --version"
```

### Issue: App Keeps Crashing
1. Check memory - increase if needed in fly.toml:
```toml
[[vm]]
  memory = '2048mb'  # Increase to 2GB
```

2. Check logs for errors:
```bash
fly logs --no-tail | tail -100
```

### Issue: Session Lost After Restart
Ensure volume is properly mounted:
```bash
fly volumes list
fly ssh console -C "ls -la /app/.wwebjs_auth/"
```

### Issue: Old Session Not Working
Delete old session and re-scan QR:
```bash
fly ssh console -C "rm -rf /app/.wwebjs_auth/*"
fly machines restart <machine-id>
# Then scan QR again
```

---

## Costs (Free Tier)

Fly.io Free Tier includes:
- 3 shared-cpu-1x VMs with 256MB RAM
- 3GB persistent storage

Our setup uses:
- 1 VM with 1GB RAM (exceeds free tier slightly)
- 1GB persistent storage

**Monthly cost**: ~$5-7 USD for the extra RAM

To reduce costs, try 512MB RAM (may be unstable):
```toml
[[vm]]
  memory = '512mb'
```

---

## File Structure
```
AI-agent/
├── Dockerfile           # Container configuration
├── fly.toml             # Fly.io configuration
├── index.js             # Main bot code
├── prompts.js           # AI prompts
├── package.json         # Dependencies
├── .env                 # Local secrets (NOT deployed)
├── .dockerignore        # Files to exclude from Docker
├── data/                # Knowledge base files
│   ├── about_me.txt
│   ├── general_info.txt
│   └── ...
└── utils/
    └── ai-providers.js  # AI API handlers
```

---

## Quick Redeploy Checklist

1. Make code changes locally
2. Test locally if possible: `node index.js`
3. Deploy: `fly deploy`
4. Check logs: `fly logs`
5. If issues, SSH and debug: `fly ssh console`

---

## Useful Links

- Fly.io Dashboard: https://fly.io/dashboard
- Fly.io Docs: https://fly.io/docs/
- WhatsApp-web.js Docs: https://wwebjs.dev/
- Puppeteer Troubleshooting: https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md


after agin run need kill
pkill -9 chrome; rm -rf /app/.wwebjs_auth/session/SingletonLock; node index.js