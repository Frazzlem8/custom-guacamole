const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse gateway list from environment
const GATEWAYS = (process.env.GATEWAYS || 'gateway-1:3001,gateway-2:3001,gateway-3:3001')
    .split(',')
    .map(g => {
        const [host, port] = g.trim().split(':');
        return { host, port: port || '3001', url: `http://${g.trim()}` };
    });

app.use(express.static(path.join(__dirname, 'public')));

// Aggregate sessions from all gateways
app.get('/api/sessions', async (req, res) => {
    const results = await Promise.all(
        GATEWAYS.map(async (gw) => {
            try {
                const response = await axios.get(`${gw.url}/sessions`, { timeout: 2000 });
                return {
                    gateway: gw.host,
                    status: 'healthy',
                    data: response.data
                };
            } catch (error) {
                return {
                    gateway: gw.host,
                    status: 'unhealthy',
                    error: error.message
                };
            }
        })
    );

    const totalSessions = results
        .filter(r => r.status === 'healthy')
        .reduce((sum, r) => sum + (r.data?.totalSessions || 0), 0);

    res.json({
        gateways: results,
        totalSessions,
        timestamp: new Date().toISOString()
    });
});

// Health check
app.get('/api/health', async (req, res) => {
    const healthChecks = await Promise.all(
        GATEWAYS.map(async (gw) => {
            try {
                const response = await axios.get(`${gw.url}/health`, { timeout: 2000 });
                return { gateway: gw.host, ...response.data };
            } catch (error) {
                return { gateway: gw.host, status: 'unhealthy', error: error.message };
            }
        })
    );

    const healthyCount = healthChecks.filter(h => h.status === 'healthy').length;

    res.json({
        status: healthyCount > 0 ? 'healthy' : 'unhealthy',
        healthyGateways: healthyCount,
        totalGateways: GATEWAYS.length,
        gateways: healthChecks,
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`Admin Dashboard running on port ${PORT}`);
    console.log(`Monitoring gateways: ${GATEWAYS.map(g => g.host).join(', ')}`);
});
