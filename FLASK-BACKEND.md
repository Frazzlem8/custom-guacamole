# Direct guacd WebSocket Connection with Flask Backend

A simple Flask backend that provides connection configuration to the frontend, removing the need for users to manually enter connection details.

## Changes from Previous Version

### Backend
- **New**: `app.py` - Flask server that provides connection configuration via REST API
- Connection details (hostname, username, password, protocol) are now managed server-side
- API endpoint: `GET /api/config` returns connection configuration as JSON

### Frontend
- **Simplified UI**: Removed all input fields for connection settings
- Only "Connect" and "Disconnect" buttons remain
- Configuration is fetched automatically from the backend when connecting

### Configuration

Edit `app.py` to change connection settings:

```python
CONNECTION_CONFIG = {
    'wsUrl': 'ws://localhost:9000',
    'protocol': 'ssh',
    'hostname': '172.20.0.20',
    'port': '22',
    'username': 'kali',
    'password': 'kali'
}
```

## Quick Start

### Option 1: Use the start script (Recommended)
```bash
./start-services.sh
```

Then open: http://localhost:5000

### Option 2: Manual start

1. **Start Docker services:**
   ```bash
   docker compose up -d
   ```

2. **Start WebSocket bridge:**
   ```bash
   source venv/bin/activate
   python3 guacd_websocket_server.py
   ```

3. **Start Flask backend:**
   ```bash
   source venv/bin/activate
   python3 app.py
   ```

4. **Open browser:**
   ```
   http://localhost:5000
   ```

## Architecture

```
Browser
  ↓ (HTTP)
Flask Backend (port 5000)
  ↓ (serves HTML + provides config via /api/config)
Browser JavaScript
  ↓ (WebSocket)
WebSocket Bridge (port 9000)
  ↓ (TCP)
guacd (port 4822)
  ↓ (SSH/RDP/VNC)
Remote Server
```

## API Endpoints

### GET /
Returns the main HTML interface

### GET /api/config
Returns connection configuration:
```json
{
  "wsUrl": "ws://localhost:9000",
  "protocol": "ssh",
  "hostname": "172.20.0.20",
  "port": "22",
  "username": "kali",
  "password": "kali"
}
```

### GET /lib/<path>
Serves JavaScript library files

### GET /<path>
Serves static files (CSS, JS)

## Security Notes

⚠️ **Important**: This setup stores credentials in plain text in the backend code. For production:

1. **Use environment variables:**
   ```python
   import os
   CONNECTION_CONFIG = {
       'hostname': os.getenv('GUAC_HOSTNAME'),
       'username': os.getenv('GUAC_USERNAME'),
       'password': os.getenv('GUAC_PASSWORD'),
       # ...
   }
   ```

2. **Add authentication to the API:**
   ```python
   from flask import request
   
   @app.route('/api/config')
   def get_config():
       token = request.headers.get('Authorization')
       if not verify_token(token):
           return jsonify({'error': 'Unauthorized'}), 401
       return jsonify(CONNECTION_CONFIG)
   ```

3. **Use HTTPS in production:**
   ```python
   if __name__ == '__main__':
       app.run(ssl_context='adhoc')  # or provide cert files
   ```

4. **Store passwords securely:**
   - Use a secrets manager (AWS Secrets Manager, HashiCorp Vault)
   - Encrypt passwords in the database
   - Use SSH keys instead of passwords when possible

## Benefits of This Approach

1. **Simplified UX**: Users just click "Connect" - no configuration needed
2. **Centralized Config**: All connection details managed in one place
3. **Security**: Credentials not exposed in browser/frontend code
4. **Flexibility**: Easy to add authentication, logging, multiple configs
5. **Multi-tenancy**: Can serve different configs to different users

## Future Enhancements

- [ ] User authentication (login system)
- [ ] Multiple connection profiles
- [ ] Connection history/logging
- [ ] Admin panel to manage connections
- [ ] Database integration for dynamic configs
- [ ] Rate limiting and security controls

## Troubleshooting

### Can't fetch config
- Ensure Flask server is running on port 5000
- Check browser console for CORS errors
- Verify `/api/config` endpoint is accessible

### Connection still asks for credentials
- Clear browser cache
- Check that JavaScript is fetching from `/api/config`
- Verify the API response contains all required fields

### Flask won't start
- Check if port 5000 is already in use: `lsof -ti:5000`
- Ensure Flask and flask-cors are installed: `pip list | grep -i flask`
- Check `flask_server.log` for errors

---

Last Updated: November 1, 2025
