/**
 * Main client for guacamole-lite demo 2
 * 
 * This demo uses the co-located architecture where guacamole-lite + guacd
 * run in the same container. No need to specify which guacd to use - 
 * each gateway has its own!
 */

// DOM elements
const connectionScreen = document.getElementById('connection-screen');
const displayScreen = document.getElementById('display-screen');
const connectButton = document.getElementById('connect-button');
const disconnectButton = document.getElementById('disconnect-button');
const displayDiv = document.getElementById('display');
const displayGateway = document.getElementById('display-gateway');
const customHostFields = document.getElementById('custom-host-fields');

// State
let currentClient = null;
let currentKeyboard = null;

// Show/hide custom host fields
document.querySelectorAll('input[name="target"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        customHostFields.style.display = e.target.value === 'custom' ? 'block' : 'none';
    });
});

// Connect button handler
connectButton.addEventListener('click', async () => {
    const protocol = document.querySelector('input[name="protocol"]:checked').value;
    const target = document.querySelector('input[name="target"]:checked').value;

    let connectionSettings;

    if (target === 'test') {
        // Use test desktop
        connectionSettings = {
            hostname: 'desktop-linux',
            username: 'testuser',
            password: 'Passw0rd!'
        };
    } else {
        // Use custom host
        connectionSettings = {
            hostname: document.getElementById('hostname').value,
            username: document.getElementById('username').value,
            password: document.getElementById('password').value
        };
    }

    // Add protocol-specific settings
    if (protocol === 'rdp') {
        Object.assign(connectionSettings, {
            port: 3389,
            "ignore-cert": true,
            "security": "any",
            "enable-drive": true,
            "create-drive-path": true
        });
    } else if (protocol === 'vnc') {
        Object.assign(connectionSettings, {
            port: 5900,
            "color-depth": 24
        });
    }

    // Note: No guacdHost/guacdPort needed!
    // Each gateway connects to its own local guacd on localhost:4822
    const tokenObj = {
        connection: {
            type: protocol,
            settings: connectionSettings
        }
    };

    try {
        console.log('Generating token for:', tokenObj);
        const token = await generateGuacamoleToken(tokenObj);
        
        // Connect via the load balancer
        initializeGuacamoleClient(token, protocol);
    } catch (error) {
        console.error('Connection failed:', error);
        alert('Connection failed: ' + error.message);
    }
});

// Disconnect button handler
disconnectButton.addEventListener('click', () => {
    cleanup();
    displayScreen.style.display = 'none';
    connectionScreen.style.display = 'flex';
});

function initializeGuacamoleClient(token, protocol) {
    // Switch to display screen
    connectionScreen.style.display = 'none';
    displayScreen.style.display = 'flex';
    displayGateway.textContent = 'Connecting via load balancer...';

    try {
        // Connect to the load balancer (which routes to a gateway)
        const tunnel = new Guacamole.WebSocketTunnel(`ws://${location.hostname}:9091/`);
        
        tunnel.onerror = (status) => {
            console.error('Tunnel error:', status);
        };

        tunnel.onuuid = (uuid) => {
            console.log('Connection UUID:', uuid);
            displayGateway.textContent = `Session: ${uuid.substring(0, 8)}...`;
        };

        const client = new Guacamole.Client(tunnel);
        currentClient = client;

        // Add display element
        const element = client.getDisplay().getElement();
        displayDiv.innerHTML = '';
        displayDiv.appendChild(element);

        // Hide local cursor - the remote desktop shows its own cursor
        element.style.cursor = 'none';
        
        // Also hide cursor on any canvas elements inside
        const hideCanvasCursor = () => {
            const canvases = element.querySelectorAll('canvas');
            canvases.forEach(canvas => {
                canvas.style.cursor = 'none';
            });
        };
        hideCanvasCursor();
        
        // Watch for new canvas elements being added
        const observer = new MutationObserver(hideCanvasCursor);
        observer.observe(element, { childList: true, subtree: true });

        // Auto-fit display
        const resizeDisplay = () => {
            const display = client.getDisplay();
            const scale = Math.min(
                displayDiv.clientWidth / display.getWidth(),
                displayDiv.clientHeight / display.getHeight()
            );
            display.scale(scale);
        };

        client.getDisplay().onresize = resizeDisplay;
        window.addEventListener('resize', resizeDisplay);

        // Error handler
        client.onerror = (error) => {
            console.error('Guacamole error:', error);
            alert('Connection error: ' + (error.message || 'Unknown error'));
            cleanup();
            displayScreen.style.display = 'none';
            connectionScreen.style.display = 'flex';
        };

        // Setup mouse
        const mouse = new Guacamole.Mouse(element);
        mouse.onEach(['mousedown', 'mouseup', 'mousemove'],
            e => client.sendMouseState(e.state));

        // Setup keyboard
        const keyboard = new Guacamole.Keyboard(document);
        keyboard.onkeydown = keysym => client.sendKeyEvent(1, keysym);
        keyboard.onkeyup = keysym => client.sendKeyEvent(0, keysym);
        currentKeyboard = keyboard;

        // Connect!
        client.connect(`token=${encodeURIComponent(token)}`);
        console.log('Guacamole client connected');

    } catch (error) {
        console.error('Error initializing client:', error);
        cleanup();
        displayScreen.style.display = 'none';
        connectionScreen.style.display = 'flex';
        alert('Failed to initialize: ' + error.message);
    }
}

function cleanup() {
    if (currentClient) {
        try {
            currentClient.disconnect();
        } catch (e) {
            console.error('Error disconnecting:', e);
        }
        currentClient = null;
    }

    if (currentKeyboard) {
        currentKeyboard.onkeydown = null;
        currentKeyboard.onkeyup = null;
        currentKeyboard = null;
    }

    displayDiv.innerHTML = '';
}
