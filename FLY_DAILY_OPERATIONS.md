# Fly.io Daily Operations Guide

## Quick Reference Commands

```bash
fly status              # Check if bot is running
fly logs                # Live logs (Ctrl+C to exit)
fly logs --no-tail      # Recent logs snapshot
fly ssh console         # SSH into container
fly deploy              # Push new code
fly machines restart e827491c094268   # Restart bot
```

---

## 1. Checking Bot Status

### Is the bot running?
```bash
fly status
```

Output example:
```
App
  Name     = sulman-whatsapp-bot

Machines
PROCESS  ID              VERSION  REGION  STATE    LAST UPDATED
app      e827491c094268  6        sin     started  2025-12-07T16:56:15Z
```

- `STATE: started` = Bot is running
- `STATE: stopped` = Bot is stopped

### View logs (live streaming)
```bash
fly logs
```
Press `Ctrl+C` to stop watching.

### View recent logs (snapshot)
```bash
fly logs --no-tail
```

### View last 50 lines only
```bash
fly logs --no-tail | tail -50
```

---

## 2. SSH into Container (Terminal Access)

### Connect to container
```bash
fly ssh console
```

You'll see:
```
Connecting to fdaa:38:4b24:a7b:...
root@e827491c094268:/app#
```

### Common SSH commands inside container

```bash
# List files
ls -la

# Check if bot is running
ps aux | grep node

# View environment variables
env | grep API

# Check session folder
ls -la /app/.wwebjs_auth/

# Kill Chrome processes
pkill -9 chrome

# Remove stale lock file
rm -f /app/.wwebjs_auth/session/SingletonLock

# Clear session (for fresh QR)
rm -rf /app/.wwebjs_auth/session

# Run bot manually (to see QR code)
node index.js

# Exit SSH
exit
```

### Run single command via SSH (without entering shell)
```bash
fly ssh console -C "ls -la /app/.wwebjs_auth/"
fly ssh console -C "pkill -9 chrome"
fly ssh console -C "rm -rf /app/.wwebjs_auth/session"
```

---

## 3. Pushing New Code Changes

### Step 1: Make changes locally
Edit files in your project folder:
```
/home/sulman-ali/Pictures/claude/bot-git/AI-agent/
```

### Step 2: Deploy to Fly.io
```bash
cd /home/sulman-ali/Pictures/claude/bot-git/AI-agent
fly deploy
```

This will:
1. Build new Docker image
2. Push to Fly.io registry
3. Restart the machine with new code

### Step 3: Verify deployment
```bash
fly logs --no-tail | tail -20
```

Look for:
- `WhatsApp Bot starting...`
- `All data files loaded!`
- `Bot Ready!` (if already authenticated)

---

## 4. Restarting the Bot

### Method 1: Restart machine (recommended)
```bash
fly machines restart e827491c094268
```

### Method 2: Redeploy (if code changed)
```bash
fly deploy
```

### Method 3: Stop and Start
```bash
fly apps stop sulman-whatsapp-bot
fly apps start sulman-whatsapp-bot
```

---

## 5. Scanning QR Code (First Time / After Logout)

### When do you need to scan QR?
- First time deployment
- After `Disconnected: LOGOUT` error
- After clearing session

### Steps:

1. **Clear old session**
```bash
fly ssh console -C "rm -rf /app/.wwebjs_auth/session"
```

2. **SSH into container**
```bash
fly ssh console
```

3. **Kill any existing processes and run bot**
```bash
pkill -9 chrome; rm -f /app/.wwebjs_auth/session/SingletonLock; node index.js
```

4. **Wait for QR code to appear**
```
📱 WhatsApp Web se connect karne ke liye QR scan karein:

=== RAW QR CODE STRING (use online QR generator) ===
2@xyz123abc...
====================================================

▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
█ ▄▄▄▄▄ █...
```

5. **Scan with WhatsApp**
   - Open WhatsApp on phone
   - Go to Settings > Linked Devices
   - Tap "Link a Device"
   - Scan the QR code

6. **Wait for "Bot Ready!" message**
```
🔐 Authentication successful!
✅ Bot Ready! WhatsApp se connected hai.
📨 Ab messages ka wait kar raha hoon...
```

7. **Exit SSH (bot keeps running)**
   - Press `Ctrl+C` to stop the manual process
   - Type `exit` to leave SSH
   - Restart machine:
```bash
fly machines restart e827491c094268
```

---

## 6. Common Issues & Fixes

### Issue: "SingletonLock: File exists" Error
```bash
fly ssh console -C "pkill -9 chrome; rm -f /app/.wwebjs_auth/session/SingletonLock"
fly machines restart e827491c094268
```

### Issue: "Disconnected: LOGOUT"
Session expired. Re-scan QR:
```bash
fly ssh console -C "rm -rf /app/.wwebjs_auth/session"
fly ssh console
# Then run: pkill -9 chrome; node index.js
# Scan QR, then exit and restart
```

### Issue: Bot not responding
Check logs:
```bash
fly logs --no-tail | tail -50
```

Restart:
```bash
fly machines restart e827491c094268
```

### Issue: "All APIs failed"
API quota exhausted. Options:
1. Wait for quota reset (daily)
2. Add new API keys:
```bash
fly secrets set GEMINI_API_KEYS=newkey1,newkey2
fly machines restart e827491c094268
```

### Issue: Changes not reflecting
Make sure you deployed:
```bash
fly deploy
```

---

## 7. Managing Secrets (API Keys)

### View current secrets (names only)
```bash
fly secrets list
```

### Set a new secret
```bash
fly secrets set GEMINI_API_KEYS=key1,key2,key3
```

### Set multiple secrets
```bash
fly secrets set CLAUDE_API_KEY=xxx OPENAI_API_KEY=yyy
```

### After changing secrets, restart:
```bash
fly machines restart e827491c094268
```

---

## 8. Monitoring & Debugging

### Check machine info
```bash
fly machines list
```

### Check app info
```bash
fly apps list
```

### Check volumes (persistent storage)
```bash
fly volumes list
```

### Watch logs with filter
```bash
fly logs | grep "ERROR"
fly logs | grep "GEMINI"
fly logs | grep "Message from"
```

---

## 9. Stopping the Bot

### Temporarily stop
```bash
fly apps stop sulman-whatsapp-bot
```

### Start again
```bash
fly apps start sulman-whatsapp-bot
```

### Permanently delete (WARNING: removes everything)
```bash
fly apps destroy sulman-whatsapp-bot
```

---

## 10. Quick Troubleshooting Checklist

1. **Bot not starting?**
   - `fly status` - Check if machine is started
   - `fly logs --no-tail` - Check for errors

2. **WhatsApp disconnected?**
   - Clear session and re-scan QR

3. **AI not responding?**
   - Check API quota in logs
   - Add new API keys

4. **Code changes not working?**
   - Run `fly deploy`
   - Check logs for errors

5. **SSH not connecting?**
   - Machine might be stopped
   - Run `fly apps start sulman-whatsapp-bot`

---

## Important Notes

- **Machine ID**: `e827491c094268` (use this for restart commands)
- **App Name**: `sulman-whatsapp-bot`
- **Region**: `sin` (Singapore)
- **Session stored at**: `/app/.wwebjs_auth/session`

---

## Daily Workflow Example

```bash
# Morning check
fly status
fly logs --no-tail | tail -20

# If bot is working, nothing to do!

# If bot stopped, restart:
fly machines restart e827491c094268

# If WhatsApp logged out, re-scan QR:
fly ssh console -C "rm -rf /app/.wwebjs_auth/session"
fly ssh console
# Run: pkill -9 chrome; node index.js
# Scan QR, exit, restart
```



● Deployed! Ab QR scan karna padega (session logout thi). SSH karo:

fly ssh console

Phir:
pkill -9 chrome; rm -f /app/.wwebjs_auth/session/SingletonLock; node index.js

QR scan karo, phir Ctrl+C aur exit karke machine restart:
fly machines restart e827491c094268