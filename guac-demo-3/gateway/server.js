/**
 * Minimal guacamole-lite server
 * 
 * KEY CONCEPTS:
 * 1. guacamole-lite creates a WebSocket server
 * 2. It connects to guacd (running locally on port 4822)
 * 3. Clients send an encrypted token containing connection details
 * 4. guacamole-lite decrypts the token and tells guacd what to connect to
 */

const GuacamoleLite = require('guacamole-lite');
const http = require('http');
const crypto = require('crypto');

// IMPORTANT: This secret must match what your backend uses to generate tokens
// In production, use a proper secret management system
// Must be exactly 32 bytes for AES-256
const CRYPTO_SECRET = 'MySuperSecretKeyForEncryption!!!'; // Exactly 32 ASCII chars

// Create guacamole-lite server
const guacServer = new GuacamoleLite(
    // WebSocket server options
    { port: 8080 },
    
    // guacd connection - localhost because they're in the same container
    {
        host: '127.0.0.1',
        port: 4822
    },
    
    // Crypto settings for token decryption
    {
        crypt: {
            cypher: 'AES-256-CBC',
            key: CRYPTO_SECRET
        }
    }
);

console.log('guacamole-lite listening on ws://0.0.0.0:8080');

// Simple HTTP API to generate tokens (for demo - in production, do this in your app backend)
const tokenServer = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    if (req.method === 'POST' && req.url === '/token') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const params = JSON.parse(body);
                
                // Build token data
                const tokenData = {
                    connection: {
                        type: params.type || 'rdp',
                        settings: {
                            hostname: params.hostname || 'desktop',
                            port: params.port || 3389,
                            username: params.username || 'testuser',
                            password: params.password || 'testpass',
                            security: 'any',
                            'ignore-cert': true
                        }
                    }
                };
                
                // Encrypt
                const iv = crypto.randomBytes(16);
                const keyBuffer = Buffer.from(CRYPTO_SECRET, 'utf8');
                const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
                let encrypted = cipher.update(JSON.stringify(tokenData), 'utf8', 'base64');
                encrypted += cipher.final('base64');
                
                // Format token
                const token = Buffer.from(JSON.stringify({
                    iv: iv.toString('base64'),
                    value: encrypted
                })).toString('base64');
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ token }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

tokenServer.listen(8081, () => {
    console.log('Token API listening on http://0.0.0.0:8081');
});
