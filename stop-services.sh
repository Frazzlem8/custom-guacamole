#!/bin/bash

# Stop all Guacamole WebSocket Demo services

echo "=== Stopping Guacamole WebSocket Demo Services ==="
echo ""

# Stop WebSocket server
echo "1. Stopping WebSocket bridge server..."
if ps aux | grep -v grep | grep -q guacd_websocket_server.py; then
    pkill -f guacd_websocket_server.py
    echo "   ✅ WebSocket server stopped"
else
    echo "   ℹ️  WebSocket server was not running"
fi

# Stop Flask server
echo "2. Stopping Flask backend server..."
if ps aux | grep -v grep | grep -q "app.py"; then
    pkill -f "app.py"
    echo "   ✅ Flask server stopped"
else
    echo "   ℹ️  Flask server was not running"
fi

# Optionally stop Docker containers
read -p "Stop Docker containers (guacd, kali-ssh)? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "3. Stopping Docker containers..."
    docker stop guacd kali-ssh 2>/dev/null || true
    echo "   ✅ Docker containers stopped"
else
    echo "3. Keeping Docker containers running"
fi

echo ""
echo "=== All Services Stopped ==="
echo ""
