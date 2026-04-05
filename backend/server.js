/**
 * server.js — Entry point for the LinkedIn Profile Enhancer backend
 */

require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const rateLimit   = require('express-rate-limit');
const profileRoutes = require('./src/routes/profile.routes');

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

// Rate limiting — Strict: 5 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs : 15 * 60 * 1000,
  max      : 5,
  message  : { success: false, error: 'Too many requests. Please try again later.' }
});
app.use('/api', limiter);

// Basic in-memory cache for POST requests to prevent repeated heavy LLM calls
const crypto = require('crypto');
const requestCache = new Map();

app.use('/api', (req, res, next) => {
  if (req.method === 'POST' && req.body) {
    const hash = crypto.createHash('md5').update(JSON.stringify(req.body)).digest('hex');
    const cached = requestCache.get(hash);
    
    // Cache identical requests for 1 hour
    if (cached && (Date.now() - cached.timestamp < 3600000)) {
       return res.json(cached.data);
    }
    
    const originalJson = res.json;
    res.json = function(data) {
      if (res.statusCode === 200 && data.success) {
        // limit cache size to 1000 items to prevent memory leaks
        if (requestCache.size > 1000) requestCache.clear();
        requestCache.set(hash, { timestamp: Date.now(), data });
      }
      return originalJson.call(this, data);
    };
  }
  next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/profile', profileRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404 handler
app.use((_req, res) => res.status(404).json({ success: false, error: 'Route not found.' }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  if (err.status === 429 && err.message.includes('AI service busy')) {
    return res.status(429).json({ error: err.message });
  }
  res.status(err.status || 500).json({ success: false, error: err.message || 'Internal server error.' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
