# Minimal Guacamole-Lite Demo (guac-demo-3)

A stripped-down example showing the minimum code needed to integrate guacamole-lite into your app.

## Architecture

```
┌─────────────┐      WebSocket       ┌─────────────────────────────┐
│   Browser   │ ───────────────────► │         Gateway             │
│  (your app) │      :8080           │  ┌─────────────────────┐    │
└─────────────┘                      │  │  guacamole-lite     │    │
                                     │  │  (Node.js :8080)    │    │
                                     │  └──────────┬──────────┘    │
                                     │             │ localhost     │
                                     │  ┌──────────▼──────────┐    │
                                     │  │  guacd (:4822)      │    │
                                     │  └──────────┬──────────┘    │
                                     └─────────────┼───────────────┘
                                                   │ RDP/VNC/SSH
                                     ┌─────────────▼───────────────┐
                                     │     Target Desktop          │
                                     └─────────────────────────────┘
```

## Files Overview

```
guac-demo-3/
├── docker-compose.yml    # 3 services: gateway, web, desktop
├── gateway/
│   ├── Dockerfile        # guacd + Node.js + supervisor
│   ├── server.js         # guacamole-lite config (20 lines!)
│   ├── package.json      # Just one dependency
│   └── supervisord.conf  # Runs both processes
└── web/
    └── index.html        # Complete client in one file
```

## Run It

```bash
cd guac-demo-3
docker compose up --build
```

Then open http://localhost:3000 and click "Connect".

## What You Need to Integrate

### Backend (Node.js)

1. Install: `npm install guacamole-lite`
2. Add ~20 lines of code (see `gateway/server.js`)
3. Share a secret key between your token generator and guacamole-lite

### Frontend

1. Include `guacamole-common-js` library
2. Generate encrypted token with connection details
3. Create WebSocket tunnel and Guacamole.Client
4. Attach display, mouse, and keyboard handlers

### Token Generation (IMPORTANT!)

The token contains encrypted connection details. In production:
- Generate tokens **server-side** (not in browser like this demo)
- Use your auth system to validate users before generating tokens
- Never expose the encryption secret to the frontend

Example token structure:
```javascript
{
  connection: {
    type: 'rdp',  // or 'vnc', 'ssh'
    settings: {
      hostname: '192.168.1.100',
      port: 3389,
      username: 'admin',
      password: 'secret',
      // ... protocol-specific options
    }
  }
}
```

## Production Considerations

1. **Load Balancer**: Add nginx/ALB in front with sticky sessions
2. **Multiple Gateways**: Scale horizontally by adding more gateway containers
3. **Secrets**: Use proper secret management (Vault, AWS Secrets Manager, etc.)
4. **HTTPS/WSS**: Terminate TLS at your load balancer
5. **Auth**: Validate users in your app before generating tokens
