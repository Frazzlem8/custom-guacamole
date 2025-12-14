/**
 * Guacamole-lite Gateway Server
 * 
 * This runs guacamole-lite configured to connect to guacd on localhost.
 * Both processes run in the same container as a "session gateway unit".
 * 
 * Benefits:
 * - No network hop to guacd (localhost:4822)
 * - Scale as a unit (no capacity mismatch)
 * - No NLB needed between lite and guacd
 */

const GuacamoleLite = require('./index.js');
const http = require('http');
const url = require('url');

const GATEWAY_ID = process.env.GATEWAY_ID || 'gateway-unknown';

const websocketOptions = {
    port: 8080
};

// Connect to guacd on LOCALHOST - this is the key difference!
// guacd runs in the same container, bound to 127.0.0.1:4822
const guacdOptions = {
    host: '127.0.0.1',  // localhost - same container!
    port: 4822
};

const clientOptions = {
    crypt: {
        cypher: 'AES-256-CBC',
        key: process.env.ENCRYPTION_KEY,
    },
    connectionDefaultSettings: {
        rdp: {
            'audio': ['audio/L16']
        }
    },
    log: {
        level: 'DEBUG',
    },
};

// Session registry for this gateway
const sessionRegistry = new Map();

const callbacks = {
    processConnectionSettings: (settings, callback) => {
        console.log(`[${GATEWAY_ID}] Processing connection to: ${settings.connection?.hostname || 'unknown'}`);
        callback(undefined, settings);
    },
    sessionRegistry: sessionRegistry
};

console.log(`[${GATEWAY_ID}] Starting guacamole-lite gateway...`);
console.log(`[${GATEWAY_ID}] guacd connection: localhost:4822 (same container)`);

const guacServer = new GuacamoleLite(websocketOptions, guacdOptions, clientOptions, callbacks);

// Health/status API endpoint
const apiServer = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (parsedUrl.pathname === '/health') {
        res.writeHead(200);
        res.end(JSON.stringify({
            status: 'healthy',
            gateway: GATEWAY_ID,
            guacdConnection: 'localhost:4822',
            activeSessions: sessionRegistry.size,
            timestamp: new Date().toISOString()
        }));
    } else if (parsedUrl.pathname === '/sessions') {
        const sessions = {};
        for (const [id, data] of sessionRegistry.entries()) {
            sessions[id] = data;
        }
        res.writeHead(200);
        res.end(JSON.stringify({
            gateway: GATEWAY_ID,
            sessions: sessions,
            totalSessions: sessionRegistry.size,
            timestamp: new Date().toISOString()
        }));
    } else if (parsedUrl.pathname === '/info') {
        res.writeHead(200);
        res.end(JSON.stringify({
            gateway: GATEWAY_ID,
            architecture: 'co-located',
            description: 'guacamole-lite + guacd running in same container',
            guacdHost: 'localhost',
            guacdPort: 4822,
            websocketPort: 8080,
            benefits: [
                'No network hop to guacd',
                'Scale as a unit',
                'No NLB between lite and guacd',
                'No capacity mismatch'
            ]
        }));
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

apiServer.listen(3001, () => {
    console.log(`[${GATEWAY_ID}] API server listening on port 3001`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log(`[${GATEWAY_ID}] Received SIGTERM, shutting down...`);
    apiServer.close();
    process.exit(0);
});
