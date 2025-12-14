# Guacamole-Lite Documentation

This folder contains documentation for the guacamole-lite demo environment.

## Documents

| Document | Description |
|----------|-------------|
| [architecture.md](./architecture.md) | Technical architecture and data flow explanation |
| [load-balancing.md](./load-balancing.md) | ALB vs NLB guidance for production deployments |
| [architecture-comparison.md](./architecture-comparison.md) | **Co-located vs Separate tiers (recommended reading!)** |

## Demo Environments

| Demo | Architecture | Description |
|------|--------------|-------------|
| `guac-demo/test-guac` | Separate | guacamole-lite → NLB → guacd (original demo) |
| `guac-demo-2` | **Co-located** | guacamole-lite + guacd in same container (recommended!) |

## Quick Start

```bash
cd test-guac
docker compose up -d
```

Then open:
- **Web Client**: http://localhost:9090
- **Admin Dashboard**: http://localhost:9092

## Test Credentials

- **Username**: `testuser`
- **Password**: `Passw0rd!`
