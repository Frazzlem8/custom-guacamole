# Direct guacd WebSocket Connection

A demonstration of connecting **directly to guacd** using WebSocket, bypassing Apache Guacamole's web application authentication layer.

## Overview

This project implements a browser-based client that connects directly to Apache Guacamole's daemon (guacd) through a WebSocket bridge, allowing remote desktop access (SSH, RDP, VNC) without the traditional Guacamole web authentication.

## Architecture

```
Browser → WebSocket (port 9000) → Python Bridge → guacd (port 4822) → Remote Host
```

### Components

1. **Frontend** (`index-websocket.html`, `app-websocket.js`, `style.css`)
   - Browser-based UI for connection management
   - Direct Guacamole protocol implementation
   - Real-time terminal/desktop display

2. **WebSocket Bridge** (`guacd_websocket_server.py`)
   - Python server bridging browser WebSocket to guacd TCP socket
   - Bidirectional message forwarding
   - Protocol-agnostic relay

3. **Docker Environment** (`docker-compose.yml`)
   - guacd daemon container
   - Target SSH server (Kali Linux)
   - Isolated network for testing

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Python 3.7+ with virtualenv
- Modern web browser (Firefox, Chrome, Safari)

### Setup

1. **Start the services:**
   ```bash
   ./start-services.sh
   ```
   This will:
   - Create Python virtual environment
   - Install required packages
   - Start Docker containers (guacd, SSH target)
   - Launch WebSocket bridge server
   - Start HTTP server for the web interface

2. **Access the interface:**
   Open your browser to: http://localhost:8000/index-websocket.html

3. **Connect to the demo SSH server:**
   - Protocol: SSH
   - Hostname: 172.20.0.20
   - Port: 22
   - Username: kali
   - Password: kali

4. **Stop services:**
   ```bash
   ./stop-services.sh
   ```

## Project Structure

```
guacamole-research/
├── index-websocket.html       # Main web interface
├── app-websocket.js            # Client-side Guacamole protocol implementation
├── style.css                   # UI styling
├── guacd_websocket_server.py   # WebSocket to TCP bridge
├── docker-compose.yml          # Container orchestration
├── lib/
│   └── guacamole-common.js     # Apache Guacamole JavaScript library
├── start-services.sh           # Service startup script
├── stop-services.sh            # Service shutdown script
├── requirements.txt            # Python dependencies
└── venv/                       # Python virtual environment
```

## How It Works

### 1. WebSocket Connection
The browser establishes a WebSocket connection to the Python bridge server:
```javascript
const tunnel = new DirectGuacdTunnel('ws://localhost:9000');
```

### 2. Guacamole Protocol Handshake
The client performs the protocol handshake:
1. Send `select` instruction with protocol type (ssh, rdp, vnc)
2. Receive `args` instruction with required connection parameters
3. Send configuration (size, audio, video, image formats, timezone)
4. Send `connect` instruction with host details and credentials
5. Receive `ready` instruction with connection ID

### 3. Display Rendering
The Guacamole.Client handles incoming drawing instructions:
- Creates canvas display
- Renders terminal/desktop output
- Handles mouse and keyboard input
- Forwards input to remote host via tunnel

## Configuration

### Connecting to Different Hosts

Edit the form fields in the web interface:
- **WebSocket URL**: Bridge server address (default: ws://localhost:9000)
- **Protocol**: ssh, rdp, vnc, or telnet
- **Hostname**: Target server IP or hostname
- **Port**: Service port (SSH: 22, RDP: 3389, VNC: 5900)
- **Credentials**: Username and password for authentication

### Docker Network

The demo uses a custom bridge network (172.20.0.0/16):
- guacd: 172.20.0.10:4822
- kali-ssh: 172.20.0.20:22

Modify `docker-compose.yml` to add more targets or change network configuration.

## Technical Details

### Custom Tunnel Implementation

The `DirectGuacdTunnel` class extends `Guacamole.Tunnel` using prototype-based inheritance:
- Compatible with old-style constructor functions
- Overrides `connect()`, `sendMessage()`, `disconnect()` methods
- Handles WebSocket lifecycle events
- Parses and forwards Guacamole protocol instructions

### Protocol Format

Guacamole instructions use a length-prefixed format:
```
length.data,length.data,length.data;
```

Example:
```
6.select,3.ssh;
7.connect,13.VERSION_1_5_0,11.172.20.0.20,2.22,4.kali,4.kali;
```

## Troubleshooting

### WebSocket Connection Fails
- Check that `guacd_websocket_server.py` is running
- Verify port 9000 is not in use
- Check browser console for errors

### No Display After Connection
- Ensure all required parameters are sent in `connect` instruction
- Check guacd logs: `docker logs guacd`
- Verify target host is reachable from guacd container

### Authentication Errors
- Verify credentials are correct
- Check SSH/RDP/VNC service is running on target
- Review guacd logs for connection details

## Dependencies

### Python
- `websockets` - WebSocket server implementation
- `asyncio` - Asynchronous I/O

### JavaScript
- `guacamole-common.js` - Apache Guacamole client library

### Docker
- `guacamole/guacd:latest` - Guacamole proxy daemon
- `kali-ssh` - Custom Kali Linux SSH server image

## License

This is a research/demonstration project. Refer to Apache Guacamole license for library usage.

## References

- [Apache Guacamole](https://guacamole.apache.org/)
- [Guacamole Protocol Reference](https://guacamole.apache.org/doc/gug/protocol-reference.html)
- [guacd Documentation](https://guacamole.apache.org/doc/gug/guacamole-architecture.html)
