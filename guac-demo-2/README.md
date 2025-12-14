# Guacamole-Lite Demo 2: Co-located Architecture

This demo shows the **recommended production architecture** where guacamole-lite and guacd run together as a single "session gateway unit".

## Architecture Comparison

### ❌ Demo 1 (Separate Tiers)
```
Browser → ALB → guacamole-lite ASG → NLB → guacd ASG → Instances
                     ↑                 ↑
                     └─ Extra hop ─────┘
```

### ✅ Demo 2 (Co-located - THIS DEMO)
```
Browser → ALB → Gateway ASG → Instances
                    │
                    └─ Each gateway = guacamole-lite + guacd (localhost)
```

## Benefits

| Aspect | Separate (Demo 1) | Co-located (Demo 2) |
|--------|-------------------|---------------------|
| Network hops | 2 (ALB → lite → NLB → guacd) | 1 (ALB → gateway) |
| Load balancers | 2 (ALB + NLB) | 1 (ALB only) |
| Scaling complexity | High (capacity mismatch risk) | Low (scale as unit) |
| Cost | Higher (extra NLB) | Lower |
| Latency | Higher | Lower |

## Quick Start

```bash
cd guac-demo-2
make up
```

## Access Points

| Service | URL | Description |
|---------|-----|-------------|
| Web Client | http://localhost:9090 | Connect to remote desktops |
| Session Dashboard | http://localhost:9092 | Monitor sessions per gateway |
| Gateway Health | http://localhost:9093 | Health status of all gateways |

## Test Credentials

- **Username:** `testuser`
- **Password:** `Passw0rd!`

## How It Works

Each gateway container runs **two processes** via supervisord:

1. **guacd** - Bound to `127.0.0.1:4822` (localhost only)
2. **guacamole-lite** - Connects to guacd on `localhost:4822`

```dockerfile
# Both in same container
[program:guacd]
command=/opt/guacamole/sbin/guacd -f -b 127.0.0.1 -l 4822

[program:guacamole-lite]
command=node /app/start.js
# Connects to localhost:4822 - no network hop!
```

## Scaling

In production (ECS/EKS), you would:

1. **Auto-scale gateways** based on:
   - Active sessions
   - CPU utilization
   - Network throughput

2. **Use ALB** with:
   - Sticky sessions (cookie-based)
   - WebSocket support
   - Idle timeout = 3600s (for long RDP sessions)

3. **No NLB needed** between lite and guacd!

## Cleanup

```bash
make down
```
