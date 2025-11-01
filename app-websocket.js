// Check if Guacamole library is loaded
if (typeof Guacamole === 'undefined') {
    console.error('Guacamole library not loaded! Make sure guacamole-common.js is loaded before this script.');
    alert('ERROR: Guacamole library not loaded! Check console for details.');
} else {
    console.log('✅ Guacamole library loaded successfully');
    console.log('Guacamole object:', Guacamole);
    console.log('Guacamole.Tunnel:', Guacamole.Tunnel);
    console.log('Guacamole.Tunnel.State:', Guacamole.Tunnel ? Guacamole.Tunnel.State : 'undefined');
}

// Global variables
let client = null;
let tunnel = null;
let mouse = null;
let keyboard = null;
let ws = null;

/**
 * Custom WebSocket tunnel that connects directly to guacd
 * Using constructor function pattern to properly extend Guacamole.Tunnel
 */
function DirectGuacdTunnel(wsUrl) {
    // Call parent constructor
    Guacamole.Tunnel.call(this);
    
    // Delete instance methods set by parent constructor so prototype methods are used
    delete this.connect;
    delete this.sendMessage;
    delete this.disconnect;
    delete this.isConnected;
    
    this.wsUrl = wsUrl;
    this.ws = null;
    this.state = Guacamole.Tunnel.State.CONNECTING;
    this.receiveBuffer = '';
}

// Set up prototype chain
DirectGuacdTunnel.prototype = Object.create(Guacamole.Tunnel.prototype);
DirectGuacdTunnel.prototype.constructor = DirectGuacdTunnel;

// Override connect method
DirectGuacdTunnel.prototype.connect = function(data) {
        const self = this;
        
        try {
            // Create WebSocket connection
            this.ws = new WebSocket(this.wsUrl);
            ws = this.ws; // Store globally for debugging
        
            this.ws.onopen = function() {
                console.log('WebSocket connected to guacd');
                updateStatus('WebSocket connected to guacd');
                self.setState(Guacamole.Tunnel.State.OPEN);
            };
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            throw error;
        }
        
        this.ws.onmessage = function(event) {
            // Add to buffer
            self.receiveBuffer += event.data;
            
            // Process complete instructions (ending with semicolon)
            let semicolonIndex;
            while ((semicolonIndex = self.receiveBuffer.indexOf(';')) !== -1) {
                const instruction = self.receiveBuffer.substring(0, semicolonIndex + 1);
                self.receiveBuffer = self.receiveBuffer.substring(semicolonIndex + 1);
                
                // Parse and handle instruction
                const parsed = parseGuacamoleInstruction(instruction);
                if (parsed && parsed.length > 0) {
                    if (self.oninstruction) {
                        self.oninstruction(parsed[0], parsed.slice(1));
                    }
                }
            }
        };
        
        this.ws.onerror = function(error) {
            console.error('WebSocket error:', error.type);
            updateStatus('WebSocket error', true);
            if (self.onerror) {
                self.onerror(new Guacamole.Status(
                    Guacamole.Status.Code.UPSTREAM_ERROR,
                    "WebSocket error"
                ));
            }
        };
        
        this.ws.onclose = function(event) {
            console.log('WebSocket closed:', event.code);
            updateStatus('WebSocket closed');
            self.setState(Guacamole.Tunnel.State.CLOSED);
        };
};

// Override sendMessage method
DirectGuacdTunnel.prototype.sendMessage = function() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const elements = Array.prototype.slice.call(arguments);
        const instruction = encodeGuacamoleInstruction.apply(null, elements);
        this.ws.send(instruction);
        return true;
    }
    return false;
};

// Override disconnect method
DirectGuacdTunnel.prototype.disconnect = function() {
    if (this.ws) {
        this.ws.close();
    }
};

// Override isConnected method
DirectGuacdTunnel.prototype.isConnected = function() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
};

// Override setState method
DirectGuacdTunnel.prototype.setState = function(state) {
    if (this.state !== state) {
        this.state = state;
        if (this.onstatechange) {
            this.onstatechange(state);
        }
    }
};

/**
 * Encode a Guacamole protocol instruction
 */
function encodeGuacamoleInstruction(...args) {
    const elements = args.map(arg => {
        const str = arg !== null && arg !== undefined ? String(arg) : "";
        return `${str.length}.${str}`;
    });
    return elements.join(',') + ';';
}

/**
 * Parse a Guacamole protocol instruction
 */
function parseGuacamoleInstruction(data) {
    if (!data || !data.endsWith(';')) {
        return null;
    }
    
    data = data.slice(0, -1); // Remove trailing semicolon
    const elements = [];
    const parts = data.split(',');
    
    for (const part of parts) {
        const dotIndex = part.indexOf('.');
        if (dotIndex !== -1) {
            const value = part.substring(dotIndex + 1);
            elements.push(value);
        }
    }
    
    return elements;
}

/**
 * Update the status display
 */
function updateStatus(message, isError = false) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = isError ? 'error' : 'success';
    console.log(message);
}

/**
 * Connect directly to guacd via WebSocket
 */
async function connect() {
    updateStatus('Fetching connection configuration...');
    
    try {
        // Fetch connection configuration from backend
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error('Failed to fetch configuration');
        }
        
        const config = await response.json();
        console.log('Received configuration from backend');
        
        const { wsUrl, protocol, hostname, port, username, password } = config;
        
        if (!wsUrl || !protocol || !hostname || !port) {
            updateStatus('Invalid configuration received from backend', true);
            return;
        }

        updateStatus('Connecting to guacd via WebSocket...');

        // Create custom WebSocket tunnel
        tunnel = new DirectGuacdTunnel(wsUrl);
        
        // Set up tunnel event handlers
        tunnel.onstatechange = function(state) {
            switch (state) {
                case Guacamole.Tunnel.State.CONNECTING:
                    updateStatus('Tunnel connecting...');
                    break;
                case Guacamole.Tunnel.State.OPEN:
                    updateStatus('Tunnel open, starting handshake...');
                    performHandshake();
                    break;
                case Guacamole.Tunnel.State.CLOSED:
                    updateStatus('Tunnel closed');
                    cleanup();
                    break;
            }
        };

        tunnel.onerror = function(status) {
            updateStatus('Tunnel error: ' + status.message, true);
            cleanup();
        };

        // Store the original instruction handler
        let originalOnInstruction = null;
        
        // Handle incoming instructions during handshake
        tunnel.oninstruction = function(opcode, args) {
            switch (opcode) {
                case 'args':
                    // Server sent list of expected parameters
                    handleArgsInstruction(args);
                    break;
                case 'ready':
                    // Connection established successfully - now create client
                    handleReadyInstruction(args);
                    break;
                case 'error':
                    updateStatus('Server error: ' + args[0], true);
                    break;
                default:
                    // After client is created, forward to client's handler
                    if (client && originalOnInstruction) {
                        originalOnInstruction(opcode, args);
                    }
            }
        };

        // Connect the tunnel
        tunnel.connect();

        /**
         * Perform Guacamole protocol handshake
         */
        function performHandshake() {
            // Send 'select' instruction with protocol
            tunnel.sendMessage('select', protocol);
        }

        /**
         * Handle 'args' instruction from server
         */
        function handleArgsInstruction(args) {
            updateStatus('Received connection parameters, sending configuration...');
            
            // Send size instruction
            tunnel.sendMessage('size', '1920', '1080', '96');
            
            // Send audio formats
            tunnel.sendMessage('audio');
            
            // Send video formats
            tunnel.sendMessage('video');
            
            // Send image formats
            tunnel.sendMessage('image', 'image/png', 'image/jpeg', 'image/webp');
            
            // Send timezone
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            tunnel.sendMessage('timezone', timezone);
            
            // Build connection parameters array matching the args instruction
            // The first arg is always the protocol version, then we need to provide
            // values for each parameter listed in the args instruction
            const connectionParams = [];
            
            // Map of parameter names to our values
            const paramMap = {
                'hostname': hostname,
                'port': port,
                'username': username,
                'password': password
            };
            
            // Fill in all parameters (args[0] is VERSION, skip it)
            for (let i = 1; i < args.length; i++) {
                const paramName = args[i];
                // Use our value if we have it, otherwise empty string
                connectionParams.push(paramMap[paramName] || '');
            }
            
            // Send connect instruction with version + all parameters
            tunnel.sendMessage('connect', args[0], ...connectionParams);
        }

        /**
         * Handle 'ready' instruction - connection established
         */
        function handleReadyInstruction(args) {
            const connectionId = args[0];
            updateStatus('Connected! ID: ' + connectionId);
            
            // Save our current instruction handler before client replaces it
            const handshakeHandler = tunnel.oninstruction;
            
            // Create Guacamole client with the tunnel
            client = new Guacamole.Client(tunnel);
            
            // The client just replaced tunnel.oninstruction with its own handler
            // Save the client's handler
            originalOnInstruction = tunnel.oninstruction;
            
            // Restore our handshake handler that forwards to client
            tunnel.oninstruction = handshakeHandler;
            
            // Get display and add to container
            const display = client.getDisplay().getElement();
            const displayContainer = document.getElementById('display-container');
            displayContainer.innerHTML = '';
            displayContainer.appendChild(display);
            
            // Set up client event handlers
            client.onerror = function(error) {
                updateStatus('Client error: ' + error.message, true);
            };
            
            // Enable buttons
            document.getElementById('connect-btn').disabled = true;
            document.getElementById('disconnect-btn').disabled = false;
            
            // Set up input handlers
            setupInputHandlers();
        }

    } catch (e) {
        updateStatus('Error: ' + e.message, true);
        console.error(e);
    }
}

/**
 * Set up mouse and keyboard input handlers
 */
function setupInputHandlers() {
    if (!client || !tunnel) return;

    const display = client.getDisplay().getElement();

    // Set up mouse input
    mouse = new Guacamole.Mouse(display);

    mouse.onmousedown = 
    mouse.onmouseup = 
    mouse.onmousemove = function(mouseState) {
        if (tunnel && tunnel.isConnected()) {
            // Send mouse instruction directly through tunnel
            tunnel.sendMessage(
                'mouse',
                Math.floor(mouseState.x),
                Math.floor(mouseState.y),
                mouseState.buttonStates
            );
        }
    };

    // Set up keyboard input
    keyboard = new Guacamole.Keyboard(document);

    keyboard.onkeydown = function(keysym) {
        if (tunnel && tunnel.isConnected()) {
            tunnel.sendMessage('key', keysym, '1');
        }
    };

    keyboard.onkeyup = function(keysym) {
        if (tunnel && tunnel.isConnected()) {
            tunnel.sendMessage('key', keysym, '0');
        }
    };

    updateStatus('Input handlers configured - you can now interact!');
}

/**
 * Disconnect from guacd
 */
function disconnect() {
    if (tunnel) {
        tunnel.disconnect();
    }
    cleanup();
}

/**
 * Clean up resources
 */
function cleanup() {
    // Disable input handlers
    if (mouse) {
        mouse.onmousedown = null;
        mouse.onmouseup = null;
        mouse.onmousemove = null;
        mouse = null;
    }

    if (keyboard) {
        keyboard.onkeydown = null;
        keyboard.onkeyup = null;
        keyboard = null;
    }

    // Reset UI
    document.getElementById('connect-btn').disabled = false;
    document.getElementById('disconnect-btn').disabled = true;
}

// Log when loaded
console.log('Direct guacd WebSocket client loaded');
console.log('This client connects directly to guacd without Guacamole authentication');
