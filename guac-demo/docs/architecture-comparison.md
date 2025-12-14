# Production Architecture: Co-located vs Separate Tiers

## TL;DR

**Run guacamole-lite + guacd together in the same container/pod.** Scale them as a unit.

## Architecture Comparison

### ❌ Separate Tiers (Not Recommended)

```
┌─────────┐     ┌─────────┐     ┌─────────────────┐     ┌─────────┐     ┌─────────────┐
│ Browser │────▶│   ALB   │────▶│ guacamole-lite  │────▶│   NLB   │────▶│    guacd    │
│         │     │ (L7)    │     │     ASG         │     │  (L4)   │     │     ASG     │
└─────────┘     └─────────┘     └─────────────────┘     └─────────┘     └─────────────┘
                                                              │
                                                              └── Extra hop!
                                                              └── Extra cost!
                                                              └── Capacity mismatch risk!
```

**Problems:**
- Extra network hop adds latency
- NLB costs money
- Risk of capacity mismatch (too many lite, not enough guacd, or vice versa)
- More complex to manage

### ✅ Co-located (Recommended)

```
┌─────────┐     ┌─────────┐     ┌─────────────────────────────────────────────┐
│ Browser │────▶│   ALB   │────▶│            Session Gateway Unit             │
│         │     │ (L7)    │     │  ┌─────────────────┐   ┌─────────────────┐  │
└─────────┘     └─────────┘     │  │ guacamole-lite  │──▶│     guacd       │  │
                                │  │    (Node.js)    │   │  (localhost)    │  │
                                │  │     :8080       │   │     :4822       │  │
                                │  └─────────────────┘   └─────────────────┘  │
                                │         Same Container / Pod / ENI          │
                                └─────────────────────────────────────────────┘
                                                    │
                                                    ▼
                                        Scale this as a unit!
```

**Benefits:**
- No network hop (localhost communication)
- No NLB needed
- No capacity mismatch (they scale together)
- Lower latency
- Lower cost
- Simpler architecture

## Comparison Table

| Aspect | Separate Tiers | Co-located |
|--------|----------------|------------|
| **Network hops** | 2 (ALB→lite→NLB→guacd) | 1 (ALB→gateway) |
| **Load balancers** | 2 (ALB + NLB) | 1 (ALB only) |
| **Scaling** | Complex (2 ASGs) | Simple (1 ASG) |
| **Capacity mismatch** | Risk | Impossible |
| **Latency** | Higher | Lower |
| **Cost** | Higher | Lower |
| **Complexity** | Higher | Lower |

## Implementation

### Dockerfile (Multi-process)

```dockerfile
FROM guacamole/guacd:1.5.5 AS guacd-base

FROM node:18-alpine

# Install supervisor to manage both processes
RUN apk add --no-cache supervisor

# Copy guacd binaries
COPY --from=guacd-base /opt/guacamole /opt/guacamole

# Copy guacamole-lite app
COPY . /app
WORKDIR /app
RUN npm install

# Supervisor config
COPY supervisord.conf /etc/supervisord.conf

EXPOSE 8080
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
```

### Supervisor Config

```ini
[supervisord]
nodaemon=true

[program:guacd]
command=/opt/guacamole/sbin/guacd -f -b 127.0.0.1 -l 4822
priority=1

[program:guacamole-lite]
command=node /app/server.js
priority=2
startsecs=2  # Wait for guacd
```

### guacamole-lite Config

```javascript
const guacdOptions = {
    host: '127.0.0.1',  // localhost - same container!
    port: 4822
};
```

## AWS ECS Task Definition

```json
{
  "containerDefinitions": [
    {
      "name": "session-gateway",
      "image": "your-registry/session-gateway:latest",
      "portMappings": [
        { "containerPort": 8080, "protocol": "tcp" }
      ],
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3001/health || exit 1"]
      }
    }
  ],
  "cpu": "1024",
  "memory": "2048"
}
```

## Kubernetes Pod

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: session-gateway
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: gateway
        image: your-registry/session-gateway:latest
        ports:
        - containerPort: 8080
        resources:
          requests:
            cpu: "500m"
            memory: "1Gi"
          limits:
            cpu: "1000m"
            memory: "2Gi"
```

## Auto-Scaling Metrics

Scale the gateway ASG/deployment based on:

1. **Active sessions per instance** (custom CloudWatch metric)
2. **CPU utilization** (target 60-70%)
3. **Network throughput** (important for video-heavy RDP)

```yaml
# ECS Service Auto Scaling
ScalingPolicy:
  TargetTrackingScaling:
    - Metric: CPUUtilization
      TargetValue: 70
    - Metric: ActiveSessions  # Custom metric
      TargetValue: 50
```

## When Would You Separate Them?

Very rarely. Possible reasons:

1. **Regulatory requirements** - guacd must run on specific hardware
2. **GPU workloads** - guacd needs GPU for encoding, lite doesn't
3. **Massive scale** - 10,000+ concurrent sessions with complex routing

For 99% of use cases, co-locate them.
