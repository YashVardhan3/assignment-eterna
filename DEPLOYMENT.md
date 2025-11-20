# Deployment Guide

## Free Hosting Options

### Option 1: Render (Recommended)

**Services Required:**
- Web Service (for Node.js app)
- PostgreSQL Database
- Redis Instance

**Steps:**

1. **Create Render Account** at [render.com](https://render.com)

2. **Create PostgreSQL Database:**
   - Go to "New" → "PostgreSQL"
   - Name: `dex-orders-db`
   - Plan: Free
   - Copy the Internal Database URL

3. **Create Redis Instance:**
   - Go to "New" → "Redis"
   - Name: `dex-orders-redis`
   - Plan: Free (500MB)
   - Copy the Internal Redis URL

4. **Create Web Service:**
   - Go to "New" → "Web Service"
   - Connect your GitHub repository
   - Settings:
     - Name: `dex-order-engine`
     - Environment: `Node`
     - Build Command: `npm install && npm run build`
     - Start Command: `npm run db:migrate && npm start`
     - Plan: Free

5. **Environment Variables:**
   ```
   NODE_ENV=production
   PORT=3000
   HOST=0.0.0.0
   DATABASE_URL=<Your PostgreSQL Internal URL>
   REDIS_HOST=<Your Redis hostname>
   REDIS_PORT=6379
   MAX_CONCURRENT_ORDERS=10
   ORDER_RATE_LIMIT=100
   MAX_RETRIES=3
   ```

6. **Deploy:**
   - Click "Create Web Service"
   - Wait for deployment (~5 minutes)
   - Access at: `https://dex-order-engine.onrender.com`

**Note:** Free tier has cold start (~30s) after inactivity.

---

### Option 2: Railway

**Steps:**

1. **Create Account** at [railway.app](https://railway.app)

2. **New Project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect repository

3. **Add Services:**
   - Add PostgreSQL: Click "New" → "Database" → "PostgreSQL"
   - Add Redis: Click "New" → "Database" → "Redis"

4. **Configure App:**
   - Settings → Environment Variables:
     ```
     NODE_ENV=production
     DATABASE_URL=${{Postgres.DATABASE_URL}}
     REDIS_HOST=${{Redis.REDIS_HOST}}
     REDIS_PORT=${{Redis.REDIS_PORT}}
     ```

5. **Deploy:**
   - Railway auto-deploys on push
   - Access at: `https://your-app.up.railway.app`

**Free Tier:** $5 credit/month, ~500 hours runtime

---

### Option 3: Fly.io

**Steps:**

1. **Install Fly CLI:**
   ```bash
   # Windows
   powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
   
   # macOS/Linux
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login:**
   ```bash
   flyctl auth login
   ```

3. **Launch App:**
   ```bash
   flyctl launch
   # Follow prompts, select region
   ```

4. **Create Databases:**
   ```bash
   # PostgreSQL
   flyctl postgres create --name dex-orders-db
   flyctl postgres attach dex-orders-db
   
   # Redis (via Upstash)
   flyctl redis create --name dex-orders-redis
   ```

5. **Set Environment Variables:**
   ```bash
   flyctl secrets set NODE_ENV=production
   flyctl secrets set MAX_CONCURRENT_ORDERS=10
   ```

6. **Deploy:**
   ```bash
   flyctl deploy
   ```

**Free Tier:** 3 shared-cpu VMs, 3GB storage

---

## Docker Deployment

### Build and Run Locally

```bash
# Build image
docker build -t dex-order-engine .

# Run with docker-compose (includes Redis + PostgreSQL)
docker-compose up -d

# Check logs
docker-compose logs -f app
```

### Deploy to Docker Hub

```bash
# Login
docker login

# Tag image
docker tag dex-order-engine yourusername/dex-order-engine:latest

# Push
docker push yourusername/dex-order-engine:latest
```

---

## Verifying Deployment

### Health Check

```bash
curl https://your-app-url.com/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-19T10:30:00.000Z"
}
```

### Test Order Creation

```bash
curl -X POST https://your-app-url.com/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "type": "market",
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amountIn": 100,
    "slippage": 0.01,
    "walletAddress": "TestWallet"
  }'
```

### WebSocket Connection

```javascript
const ws = new WebSocket('wss://your-app-url.com/api/orders/execute/ORDER_ID');
ws.onmessage = (event) => console.log(JSON.parse(event.data));
```

---

## Monitoring

### Render Dashboard
- View logs in real-time
- Monitor CPU/Memory usage
- Check deployment history

### Custom Logging
```bash
# View last 100 lines
curl https://your-app-url.com/api/logs

# Stream logs
flyctl logs # (for Fly.io)
railway logs # (for Railway)
```

---

## Troubleshooting

### Cold Start Issues (Render Free Tier)
- First request after inactivity takes ~30s
- Solution: Use cron job to ping every 14 minutes
  ```bash
  # Add to cron-job.org or similar
  curl https://your-app-url.com/health
  ```

### Database Connection Errors
- Check DATABASE_URL format: `postgresql://user:pass@host:port/dbname`
- Verify database is running and accessible
- Check firewall rules

### Redis Connection Issues
- Verify REDIS_HOST and REDIS_PORT
- Check if Redis is accepting connections
- Test with: `redis-cli -h HOST -p PORT ping`

### WebSocket Connection Refused
- Ensure WebSocket upgrade is supported by hosting provider
- Check if using `wss://` (not `ws://`) for production
- Verify firewall allows WebSocket connections

---

## Performance Tips

1. **Enable Connection Pooling:**
   - PostgreSQL: Already configured (max: 20)
   - Redis: Using ioredis with connection pooling

2. **Scale Workers:**
   ```env
   MAX_CONCURRENT_ORDERS=20  # Increase for more throughput
   ORDER_RATE_LIMIT=200      # Orders per minute
   ```

3. **Add CDN:**
   - Use Cloudflare for static assets
   - Enable WebSocket proxying

4. **Database Indexing:**
   - Already configured for `orders.status` and `orders.created_at`
   - Monitor slow queries with `EXPLAIN ANALYZE`

---

## Security Checklist

- [ ] Environment variables not committed to Git
- [ ] PostgreSQL user has minimal permissions
- [ ] Redis password set (if supported)
- [ ] CORS configured for production domains
- [ ] Rate limiting enabled (100/min default)
- [ ] HTTPS/WSS enforced in production
- [ ] Database backups scheduled
- [ ] Error messages don't leak sensitive info

---

## Cost Estimates

### Render (Free Tier)
- Web Service: Free (750 hours/month)
- PostgreSQL: Free (1GB storage)
- Redis: Free (25MB)
- **Total: $0/month** (with cold starts)

### Railway
- Free: $5 credit/month (~500 hours)
- Pro: $20/month (unlimited)

### Fly.io
- Free: 3 VMs + 3GB storage
- Paid: $1.94/VM/month

---

## Next Steps After Deployment

1. **Update README** with deployed URL
2. **Create YouTube demo video**
3. **Test Postman collection** against live API
4. **Run concurrent order test:**
   ```bash
   node test-client.js concurrent
   ```
5. **Monitor for 24 hours** to ensure stability
