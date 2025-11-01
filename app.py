"""
Flask Backend for Guacamole Connection Configuration
Provides connection details to the frontend via API
"""

from flask import Flask, jsonify, render_template, send_from_directory
from flask_cors import CORS
import os

app = Flask(__name__, 
            static_folder='.',
            template_folder='.')
CORS(app)

# Connection configuration
# In production, this would come from a database or config file
CONNECTION_CONFIG = {
    'wsUrl': 'ws://localhost:9000',
    'protocol': 'ssh',
    'hostname': '172.20.0.20',
    'port': '22',
    'username': 'kali',
    'password': 'kali'
}

@app.route('/')
def index():
    """Serve the main HTML page"""
    return render_template('index-websocket.html')

@app.route('/api/config', methods=['GET'])
def get_config():
    """API endpoint to get connection configuration"""
    return jsonify(CONNECTION_CONFIG)

@app.route('/lib/<path:path>')
def serve_lib(path):
    """Serve library files"""
    return send_from_directory('lib', path)

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files"""
    return send_from_directory('.', path)

if __name__ == '__main__':
    print("=" * 60)
    print("Flask Backend Server Starting")
    print("=" * 60)
    print(f"Connection Configuration:")
    print(f"  Protocol: {CONNECTION_CONFIG['protocol']}")
    print(f"  Hostname: {CONNECTION_CONFIG['hostname']}")
    print(f"  Port: {CONNECTION_CONFIG['port']}")
    print(f"  Username: {CONNECTION_CONFIG['username']}")
    print("=" * 60)
    print("Server running at: http://localhost:5000")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5000, debug=True)
