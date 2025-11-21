import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import leaderboardHandler from './api/leaderboard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the current directory
app.use(express.static(__dirname));

// API Route for Leaderboard
// Wrap the Vercel handler to work with Express
app.all('/api/leaderboard', async (req, res) => {
    try {
        await leaderboardHandler(req, res);
    } catch (error) {
        console.error('API Handler Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

// Start server with dynamic port finding
const startServer = (port) => {
    const server = app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
        console.log(`Leaderboard API available at http://localhost:${port}/api/leaderboard`);
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port} is busy, trying ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('Server error:', err);
        }
    });
};

startServer(PORT);
