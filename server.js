const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios');

// load environment variables from .env file (make sure to install dotenv)
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 7000;

// external API configuration from environment
const WB_API_URL = process.env.WB_API_URL;
const WB_API_KEY = process.env.WB_API_KEY;
// allow overriding CORS and CSP origins via environment as comma‑separated lists
const FRAME_ORIGINS = (process.env.FRAME_ORIGINS || "").split(',');
const CONNECT_ORIGINS = (process.env.CONNECT_ORIGINS || "").split(',');

console.log('Configuration:');
console.log(`  WB_API_URL: ${WB_API_URL}`);
console.log(`  WB_API_KEY: ${WB_API_KEY ? '***' : '(not set)'}`);
console.log(`  FRAME_ORIGINS: ${FRAME_ORIGINS.join(', ')}`);
console.log(`  CONNECT_ORIGINS: ${CONNECT_ORIGINS.join(', ')}`);

// Middleware
app.use(cors({
    origin: '*',
    credentials: true
}));
// (optionally more restrictive origins could be configured in .env and parsed above)


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from current directory
app.use(express.static(path.join(__dirname)));

// Security headers for iframe embedding
app.use((req, res, next) => {
    // Allow iframe embedding from same origin
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    // Content Security Policy
    // build CSP directives using environment-configured origins
    const frameSrc = FRAME_ORIGINS.join(' ');
    const connectSrc = ['\'self\'', ...CONNECT_ORIGINS].join(' ');
    res.setHeader('Content-Security-Policy',
        `default-src 'self'; ` +
        `script-src 'self' 'unsafe-inline'; ` +
        `style-src 'self' 'unsafe-inline'; ` +
        `frame-src ${frameSrc}; ` +
        `connect-src ${connectSrc}; ` +
        `img-src 'self' data: https:;`
    );

    // Other security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    next();
});

// Routes
app.get('/embed', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Redirect root to /embed
app.get('/', (req, res) => {
    res.redirect('/embed');
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// endpoint to get WA token; URL and key come from environment variables
app.post('/get-wa-token', async (req, res) => {
    try {
        const tokenEndpoint = `${WB_API_URL}/auth/generate-auth-token`;
        const response = await axios.post(tokenEndpoint, {
            email: req.body.email,
            name: req.body.name,
            role: req.body.role
        }, {
            headers: { 'x-api-key': WB_API_KEY }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching WA token:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch WA token',
            error: error.message
        });
    }
});

// Handle 404
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
🚀 WhatsBox Embed Server running!
📍 Local: http://localhost:${PORT}/embed
🌐 Network: http://0.0.0.0:${PORT}/embed
🕐 Started at: ${new Date().toLocaleString()}
    `);

    // Log available endpoints
    console.log('\n📋 Available endpoints:');
    console.log('   GET  /                  - Redirects to /embed');
    console.log('   GET  /embed             - Main application');
    console.log('   GET  /health        - Health check');
    console.log('   POST /get-wa-token      - Get WA token');
    console.log('\n💡 Press Ctrl+C to stop the server\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n👋 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n👋 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});