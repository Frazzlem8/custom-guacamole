# Load Balancing guacamole-lite

## TL;DR: Use an Application Load Balancer (ALB)

**You need an ALB (Layer 7)**, not an NLB (Layer 4), because guacamole-lite uses **WebSocket connections**.

## Why ALB?

### WebSocket Requirements

guacamole-lite communicates with browsers via **WebSocket**, which requires:

1. **HTTP Upgrade handshake** - The connection starts as HTTP, then upgrades to WebSocket
2. **Sticky sessions** - Once upgraded, the connection must stay on the same backend
3. **Protocol awareness** - The load balancer must understand HTTP headers

```
Browser → ALB (HTTP/WebSocket aware) → guacamole-lite
         ↑
         └── Understands "Upgrade: websocket" header
             Routes to correct backend
             Maintains sticky session
```

### ALB vs NLB Comparison

| Feature | ALB (Layer 7) | NLB (Layer 4) |
|---------|---------------|---------------|
| WebSocket support | ✅ Native | ⚠️ Works but no protocol awareness |
| HTTP/2 support | ✅ Yes | ❌ No |
| Path-based routing | ✅ Yes | ❌ No |
| Host-based routing | ✅ Yes | ❌ No |
| SSL termination | ✅ Yes | ✅ Yes (TLS) |
| Sticky sessions | ✅ Cookie-based | ⚠️ IP-based only |
| Health checks | HTTP/HTTPS | TCP/HTTP |
| Cost | Higher | Lower |
| Latency | Slightly higher | Lower |

## AWS ALB Configuration

### Target Group Settings

```yaml
TargetGroup:
  Type: AWS::ElasticLoadBalancingV2::TargetGroup
  Properties:
    Protocol: HTTP
    Port: 8080
    TargetType: ip  # or instance
    HealthCheckPath: /api/health
    HealthCheckProtocol: HTTP
    
    # Important for WebSocket!
    TargetGroupAttributes:
      - Key: stickiness.enabled
        Value: "true"
      - Key: stickiness.type
        Value: lb_cookie
      - Key: stickiness.lb_cookie.duration_seconds
        Value: "86400"  # 24 hours
```

### Listener Configuration

```yaml
Listener:
  Type: AWS::ElasticLoadBalancingV2::Listener
  Properties:
    LoadBalancerArn: !Ref ALB
    Port: 443
    Protocol: HTTPS
    Certificates:
      - CertificateArn: !Ref Certificate
    DefaultActions:
      - Type: forward
        TargetGroupArn: !Ref TargetGroup
```

### Idle Timeout

**Critical:** Increase the idle timeout for long-running remote desktop sessions:

```yaml
LoadBalancer:
  Type: AWS::ElasticLoadBalancingV2::LoadBalancer
  Properties:
    LoadBalancerAttributes:
      - Key: idle_timeout.timeout_seconds
        Value: "3600"  # 1 hour (default is 60 seconds!)
```

## Architecture with ALB

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────────┐     ┌─────────┐
│   Browser   │────▶│    ALB      │────▶│  guacamole-lite (x3) │────▶│  guacd  │
│  (HTTPS/WSS)│     │  (Layer 7)  │     │   (ECS/EKS/EC2)      │     │         │
└─────────────┘     └─────────────┘     └──────────────────────┘     └─────────┘
                          │
                          ├── SSL termination
                          ├── WebSocket upgrade handling  
                          ├── Sticky sessions (cookie)
                          └── Health checks (/api/health)
```

## When Would You Use NLB?

Use NLB **only** for the connection between `guacamole-lite` and `guacd`:

```
guacamole-lite → NLB (Layer 4) → guacd cluster
                   │
                   └── Pure TCP on port 4822
                       No HTTP involved
                       Lower latency preferred
```

## Complete Production Architecture

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                        AWS                              │
                    │                                                         │
┌─────────┐        │  ┌─────────┐      ┌─────────────────┐     ┌─────────┐  │
│ Browser │───────────▶│   ALB   │─────▶│ guacamole-lite  │────▶│  NLB    │──┼───▶ guacd
│         │  HTTPS/WSS │ (L7)    │      │ (ECS Fargate)   │ TCP │ (L4)    │  │     cluster
└─────────┘        │  └─────────┘      └─────────────────┘     └─────────┘  │
                    │       │                   │                            │
                    │       │                   ▼                            │
                    │       │           ┌─────────────┐                      │
                    │       └──────────▶│ Static site │                      │
                    │         /static   │ (S3+CF)     │                      │
                    │                   └─────────────┘                      │
                    └─────────────────────────────────────────────────────────┘
```

## Key Considerations

1. **SSL/TLS**: Always use HTTPS/WSS in production
2. **Idle timeout**: Set to match your maximum expected session duration
3. **Sticky sessions**: Required for WebSocket connections
4. **Health checks**: Use the `/api/health` endpoint
5. **Scaling**: guacamole-lite is stateless (with external session registry), scales horizontally
6. **Connection draining**: Set appropriate deregistration delay for graceful shutdown
