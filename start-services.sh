#!/bin/bash

# Quick Start Script for Guacamole WebSocket Demo
# This script starts all necessary services

set -e

echo "=== Guacamole WebSocket Demo - Quick Start ==="
echo ""

# Check if Docker containers are running
echo "1. Checking Docker containers..."
if docker ps | grep -q guacd; then
    echo "   ✅ guacd is running"
else
    echo "   ❌ guacd is NOT running"
    echo "   Starting guacd..."
    docker run -d --name guacd -p 4822:4822 guacamole/guacd
fi

if docker ps | grep -q kali-ssh; then
    echo "   ✅ kali-ssh is running"
else
    echo "   ⚠️  kali-ssh is NOT running (optional for SSH testing)"
fi

echo ""

# Check if WebSocket server is running
echo "2. Checking WebSocket bridge server..."
if ps aux | grep -v grep | grep -q guacd_websocket_server.py; then
    echo "   ✅ WebSocket server is running"
    PID=$(ps aux | grep -v grep | grep guacd_websocket_server.py | awk '{print $2}')
    echo "   Process ID: $PID"
else
    echo "   ❌ WebSocket server is NOT running"
    echo "   Starting WebSocket server..."
    
    # Activate virtual environment if it exists
    if [ -d "venv" ]; then
        source venv/bin/activate
    fi
    
    nohup python3 guacd_websocket_server.py > websocket_server.log 2>&1 &
    sleep 2
    
    if ps aux | grep -v grep | grep -q guacd_websocket_server.py; then
        echo "   ✅ WebSocket server started successfully"
    else
        echo "   ❌ Failed to start WebSocket server"
        echo "   Check websocket_server.log for errors"
        exit 1
    fi
fi

echo ""

# Check if Flask backend is running
echo "3. Checking Flask backend server..."
if lsof -ti:5001 > /dev/null 2>&1; then
    echo "   ✅ Flask server is running on port 5001"
else
    echo "   ❌ Flask server is NOT running"
    echo "   Starting Flask server..."
    
    # Activate virtual environment if it exists
    if [ -d "venv" ]; then
        source venv/bin/activate
    fi
    
    nohup python3 app.py > flask_server.log 2>&1 &
    sleep 2
    
    if lsof -ti:5001 > /dev/null 2>&1; then
        echo "   ✅ Flask server started successfully"
    else
        echo "   ❌ Failed to start Flask server"
        echo "   Check flask_server.log for errors"
        exit 1
    fi
fi

echo ""
echo "=== All Services Running ==="
echo ""
echo "🌐 Open in browser:"
echo "   http://localhost:5001"
echo ""
echo "🔧 Connection configured via backend:"
echo "   Protocol: ssh"
echo "   Hostname: 172.20.0.20"
echo "   Port: 22"
echo "   Username: kali"
echo ""
echo "📊 Monitor logs:"
echo "   WebSocket: tail -f websocket_server.log"
echo "   Flask: tail -f flask_server.log"
echo "   guacd: docker logs -f guacd"
echo ""
echo "🛑 To stop all services:"
echo "   ./stop-services.sh"
echo ""
