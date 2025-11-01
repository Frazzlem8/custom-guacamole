#!/usr/bin/env python3
"""
WebSocket server that bridges directly to guacd.
This allows direct connection to guacd without Guacamole web application authentication.
"""

import asyncio
import websockets
import socket
import json
import logging
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GuacdConnection:
    """Handles connection to guacd and protocol communication."""
    
    def __init__(self, host: str = 'localhost', port: int = 4822):
        self.host = host
        self.port = port
        self.socket: Optional[socket.socket] = None
        
    def connect(self):
        """Connect to guacd."""
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.socket.connect((self.host, self.port))
        logger.info(f"Connected to guacd at {self.host}:{self.port}")
        
    def send(self, data: str):
        """Send data to guacd."""
        if self.socket:
            self.socket.sendall(data.encode('utf-8'))
            logger.debug(f"Sent to guacd: {data}")
            
    def receive(self, buffer_size: int = 4096) -> str:
        """Receive data from guacd."""
        if self.socket:
            data = self.socket.recv(buffer_size).decode('utf-8')
            logger.debug(f"Received from guacd: {data}")
            return data
        return ""
        
    def close(self):
        """Close connection to guacd."""
        if self.socket:
            self.socket.close()
            logger.info("Closed guacd connection")


def encode_instruction(*args) -> str:
    """
    Encode a Guacamole protocol instruction.
    Format: LENGTH.VALUE,LENGTH.VALUE,...;
    """
    elements = []
    for arg in args:
        arg_str = str(arg) if arg is not None else ""
        elements.append(f"{len(arg_str)}.{arg_str}")
    return ",".join(elements) + ";"


def parse_instruction(data: str) -> list:
    """
    Parse a Guacamole protocol instruction.
    Returns list of instruction elements.
    """
    if not data or not data.endswith(';'):
        return []
    
    # Remove trailing semicolon
    data = data[:-1]
    
    elements = []
    parts = data.split(',')
    
    for part in parts:
        if '.' in part:
            length, value = part.split('.', 1)
            elements.append(value)
    
    return elements


async def handle_client(websocket):
    """Handle WebSocket client connection."""
    guacd = None
    client_id = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
    # Get path from websocket.request if available (websockets v13+)
    path = getattr(websocket, 'path', websocket.request.path if hasattr(websocket, 'request') else '/')
    logger.info(f"New client connection from {client_id} on path {path}")
    
    try:
        # Connect to guacd
        # Use localhost since port 4822 is exposed from Docker
        logger.info(f"Connecting to guacd at localhost:4822...")
        guacd = GuacdConnection(host='localhost', port=4822)
        guacd.connect()
        logger.info(f"Successfully connected to guacd for client {client_id}")
        
        # Create tasks for bidirectional communication
        async def ws_to_guacd():
            """Forward WebSocket messages to guacd."""
            try:
                async for message in websocket:
                    if isinstance(message, str):
                        logger.info(f"WS -> guacd: {message}")
                        guacd.send(message)
            except websockets.exceptions.ConnectionClosed:
                logger.info(f"WebSocket closed for {client_id}")
            except Exception as e:
                logger.error(f"Error in ws_to_guacd: {e}")
        
        async def guacd_to_ws():
            """Forward guacd messages to WebSocket."""
            loop = asyncio.get_event_loop()
            try:
                while True:
                    # Read from guacd in non-blocking way
                    data = await loop.run_in_executor(None, guacd.receive)
                    if data:
                        logger.info(f"guacd -> WS: {data}")
                        await websocket.send(data)
                    else:
                        # Connection closed
                        logger.info("guacd connection closed")
                        break
                    await asyncio.sleep(0.01)  # Small delay to prevent busy loop
            except Exception as e:
                logger.error(f"Error in guacd_to_ws: {e}")
        
        # Run both tasks concurrently
        await asyncio.gather(ws_to_guacd(), guacd_to_ws())
        
    except Exception as e:
        logger.error(f"Error handling client {client_id}: {e}")
    finally:
        if guacd:
            guacd.close()
        logger.info(f"Client {client_id} disconnected")


async def main():
    """Start the WebSocket server."""
    server = await websockets.serve(
        handle_client,
        "0.0.0.0",  # Listen on all interfaces
        9000,       # WebSocket port
        ping_interval=None,  # Disable ping/pong
        ping_timeout=None
    )
    
    logger.info("WebSocket server started on ws://0.0.0.0:9000")
    logger.info("Ready to accept connections to guacd")
    
    await server.wait_closed()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
