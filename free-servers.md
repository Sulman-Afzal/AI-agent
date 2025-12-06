# Deploy WhatsApp Bot to Free Cloud Server

## Requirements
Your bot needs:
- Node.js + Puppeteer (headless Chrome)
- Persistent storage (WhatsApp session)
- Always-on (24/7, no sleeping)

---

## FREE Hosting Options

### Option 1: Oracle Cloud Free Tier (BEST - Forever Free VPS)
- **Free forever**: 2 VMs with 1GB RAM each
- **Pros**: Full control, persistent storage, no sleeping
- **Steps**:
  1. Sign up: https://www.oracle.com/cloud/free/
  2. Create Ubuntu VM (Always Free)
  3. SSH into server
  4. Install Node.js, Chrome, clone repo, run with PM2

### Option 2: Railway.app (Easy but limited)
- **Free**: 500 hours/month (~21 days)
- **Pros**: Easy deploy from GitHub
- **Cons**: May sleep, limited hours
- **Steps**:
  1. Sign up: https://railway.app
  2. Connect GitHub repo
  3. Add environment variables
  4. Deploy

### Option 3: Render.com (Free but sleeps)
- **Free**: 750 hours/month
- **Cons**: Sleeps after 15 min inactivity (bot dies)
- **Not recommended** for WhatsApp bots

### Option 4: Fly.io (Good free tier)
- **Free**: 3 shared VMs
- **Pros**: Persistent volumes available
- **Steps**:
  1. Sign up: https://fly.io
  2. Install flyctl CLI
  3. Create Dockerfile
  4. Deploy

---

## Recommended: Oracle Cloud Free Tier

### Step 1: Create Oracle Account
1. Go to https://www.oracle.com/cloud/free/
2. Sign up (needs credit card for verification, won't charge)
3. Select home region

### Step 2: Create Free VM
1. Dashboard → Compute → Instances → Create Instance
2. Select "Always Free" shape (VM.Standard.E2.1.Micro)
3. Choose Ubuntu 22.04
4. Download SSH key

### Step 3: Connect & Setup
```bash
# SSH into your server
ssh -i <your-key.pem> ubuntu@<your-server-ip>

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Chrome dependencies
sudo apt install -y chromium-browser

# Install PM2
sudo npm install -g pm2

# Clone your repo
git clone https://github.com/YOUR_USERNAME/AI-agent.git
cd AI-agent

# Install dependencies
npm install

# Create .env file with your API keys
nano .env

# Start with PM2
pm2 start index.js --name whatsapp-bot
pm2 save
pm2 startup
```

### Step 4: Open Firewall (Oracle specific)
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo netfilter-persistent save
```

---

## Files to Prepare Before Deployment

1. **Ensure .gitignore includes**:
   - `.env`
   - `.wwebjs_auth/`
   - `node_modules/`

2. **Push code to GitHub**:
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

---

## Notes
- First QR scan must be done via SSH terminal
- Session persists in `.wwebjs_auth/` folder
- Use `pm2 logs` to monitor bot




● I'll provide the comparison between Railway.app and Fly.io focusing on quality and security as you requested.

Railway.app vs Fly.io - Quality & Security Comparison

🔐 SECURITY

| Feature               | Railway.app                             | Fly.io                                        |
  |-----------------------|-----------------------------------------|-----------------------------------------------|
| Environment Variables | Encrypted at rest, visible in dashboard | Encrypted secrets, stored in vault            |
| Network Isolation     | Basic isolation                         | Private networking between apps               |
| DDoS Protection       | Basic                                   | Anycast network with built-in DDoS protection |
| SSL/TLS               | Auto HTTPS (Let's Encrypt)              | Auto HTTPS + mTLS option                      |
| SOC2 Compliance       | No                                      | Yes (SOC2 Type II)                            |
| IP Allowlisting       | No                                      | Yes (dedicated IPs available)                 |
| Secret Management     | Environment variables only              | Dedicated secrets manager                     |

⚡ RELIABILITY & PERFORMANCE

| Feature               | Railway.app         | Fly.io                             |
  |-----------------------|---------------------|------------------------------------|
| Global Regions        | 1 region (US)       | 30+ regions worldwide              |
| Edge Deployment       | No                  | Yes (deploy closer to users)       |
| Auto-scaling          | Basic               | Advanced (scale to zero, scale up) |
| Uptime SLA            | No SLA on free tier | 99.99% SLA (paid)                  |
| Health Checks         | Basic               | Advanced with custom endpoints     |
| Zero-downtime Deploys | Yes                 | Yes (rolling deployments)          |

💾 PERSISTENT STORAGE

| Feature             | Railway.app                  | Fly.io                      |
  |---------------------|------------------------------|-----------------------------|
| Volume Storage      | No persistent volumes (free) | Yes (3GB free)              |
| Session Persistence | Lost on redeploy             | Survives redeployments      |
| Database Options    | PostgreSQL, MySQL, Redis     | PostgreSQL, Redis + volumes |

📊 MONITORING & LOGGING

| Feature           | Railway.app      | Fly.io                       |
  |-------------------|------------------|------------------------------|
| Log Retention     | 7 days           | 7 days (free), longer (paid) |
| Metrics Dashboard | Basic CPU/Memory | Detailed Prometheus metrics  |
| Alerting          | No               | Yes (Grafana integration)    |
| Log Streaming     | Dashboard only   | CLI + Dashboard + external   |

💰 FREE TIER LIMITS

| Feature              | Railway.app                | Fly.io                           |
  |----------------------|----------------------------|----------------------------------|
| Compute              | 500 hours/month (~21 days) | 3 shared-cpu VMs (24/7 possible) |
| Memory               | 512MB                      | 256MB per VM                     |
| Storage              | No volumes                 | 3GB volumes                      |
| Bandwidth            | 100GB                      | 160GB                            |
| Credit Card Required | No                         | Yes (for verification)           |

  ---
🏆 VERDICT: Fly.io WINS for Quality & Security

Why Fly.io is better:

1. Security: SOC2 compliant, private networking, dedicated secrets manager, mTLS support
2. Reliability: 30+ global regions, better uptime, advanced health checks
3. Persistence: Volumes survive redeployments - your WhatsApp session won't be lost!
4. 24/7 Uptime: Free tier allows continuous running (Railway limits to ~21 days/month)

The CRITICAL advantage for your WhatsApp bot:
- Fly.io has persistent volumes = WhatsApp session (.wwebjs_auth/) survives redeployments
- Railway loses session on every redeploy = must re-scan QR code each time

  ---
Recommendation

Use Fly.io - Despite needing Docker and credit card verification, it's significantly better for:
- Keeping WhatsApp logged in (persistent storage)
- 24/7 uptime (no 500-hour limit)
- Better security standards
- Global edge locations

Do you want me to update the plan with Fly.io deployment instructions instead?
