# Guacamole-Lite Architecture Documentation

## Overview

This document explains the architecture of the guacamole-lite demo environment, showing how a web browser connects to remote desktops via RDP/VNC through a lightweight Node.js proxy.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  1. Browser                     2. guacamole-lite         3. guacd             │
│  ┌──────────────┐              ┌─────────────────┐       ┌──────────────┐      │
│  │ Generate     │   WebSocket  │ Decrypt token   │  TCP  │ Translate    │      │
│  │ encrypted    │──────────────▶│ Extract host/   │───────▶│ Guacamole    │      │
│  │ token with   │              │ user/pass       │       │ → RDP/VNC    │      │
│  │ RDP settings │◀──────────────│ Proxy Guacamole │◀───────│              │      │
│  │              │   (canvas    │ instructions    │       │              │      │
│  │              │    updates)  │                 │       │              │      │
│  └──────────────┘              └─────────────────┘       └──────────────┘      │
│                                                                  │              │
│                                                                  ▼              │
│                                                          4. Desktop Container   │
│                                                          ┌──────────────┐      │
│                                                          │ xrdp/x11vnc  │      │
│                                                          │ XFCE Desktop │      │
│                                                          └──────────────┘      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. Token Generation (Browser-Side)

The browser encrypts connection parameters with AES-256-CBC before sending:

```javascript
// Browser encrypts connection params with AES-256-CBC
const tokenObj = {
    connection: {
        type: "rdp",              // or "vnc", "ssh"
        guacdHost: "guacd-1",     // which guacd instance
        guacdPort: 4822,
        settings: {
            hostname: "desktop-linux",
            username: "testuser",
            password: "Passw0rd!"
        }
    }
};
const token = encryptWithAES256CBC(tokenObj);
```

**Note:** In production, token generation should happen server-side to protect credentials.

### 2. WebSocket Connection (Browser-Side)

The browser uses `guacamole-common-js` to establish a WebSocket tunnel:

```javascript
// Browser creates WebSocket tunnel to guacamole-lite
const tunnel = new Guacamole.WebSocketTunnel(`ws://localhost:9091/`);
const client = new Guacamole.Client(tunnel);

// Append the remote desktop canvas to the page
document.body.appendChild(client.getDisplay().getElement());

// Connect with encrypted token
client.connect(`token=${encryptedToken}`);
```

### 3. guacamole-lite Server (Node.js)

The lightweight Node.js proxy that bridges WebSocket ↔ TCP:

```javascript
const GuacamoleLite = require('guacamole-lite');

// This creates a WebSocket server that:
// 1. Accepts browser connections on port 8080
// 2. Decrypts the token to get connection settings
// 3. Opens TCP connection to guacd (port 4822)
// 4. Proxies Guacamole protocol between browser ↔ guacd
const guacServer = new GuacamoleLite(
    { port: 8080 },                              // WebSocket options
    { host: 'guacd-1', port: 4822 },             // guacd options
    { crypt: { cypher: 'AES-256-CBC', key: '...' } }  // encryption
);
```

### 4. guacd (Apache Guacamole Daemon)

- Official Docker image: `guacamole/guacd:1.5.5`
- Translates **Guacamole protocol** → **Native RDP/VNC/SSH**
- Listens on port 4822 (TCP)

### 5. Desktop Container

Ubuntu with XFCE desktop running RDP and VNC servers:

```dockerfile
# Ubuntu with XFCE desktop
RUN apt-get install -y xrdp xorgxrdp xfce4 x11vnc xvfb

# User credentials
ENV USERNAME=testuser PASSWORD=Passw0rd!

# Exposes RDP (3389) and VNC (5900)
EXPOSE 3389 5900
```

## Data Flow

1. **User clicks Connect** → Browser generates encrypted token with connection details
2. **WebSocket opened** → Browser connects to guacamole-lite via WebSocket
3. **Token decrypted** → guacamole-lite extracts hostname, username, password, protocol
4. **TCP to guacd** → guacamole-lite opens TCP connection to guacd daemon
5. **Protocol translation** → guacd converts Guacamole protocol to native RDP/VNC
6. **Desktop connection** → guacd connects to the target machine
7. **Bidirectional streaming** → Screen updates flow back; keyboard/mouse events flow forward

## Docker Services

| Container | Purpose | Port |
|-----------|---------|------|
| `guac-lite-client` | HTML5 Web Client (nginx) | 9090 |
| `guacamole-lite-server` | Node.js WebSocket proxy | 9091 (WS), 3001 (API) |
| `guacd-1/2/3` | Guacamole protocol daemon (x3) | 4822 (internal) |
| `desktop-linux` | Ubuntu with XFCE, RDP & VNC | 3389, 5900 (internal) |
| `admin-dashboard` | Session monitoring dashboard | 9092 |

## Key Innovation

The key innovation of **guacamole-lite** vs the full Java-based Guacamole is that it's a lightweight Node.js proxy - you don't need a database or complex authentication. The token contains everything needed to establish the connection!
