.PHONY: help up down build logs clean

help: ## Show this help
	@echo "Guacamole-Lite Demo 2 - Co-located Architecture"
	@echo ""
	@echo "This demo runs guacamole-lite + guacd together in each gateway container."
	@echo "No NLB between them - they communicate over localhost!"
	@echo ""
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

up: ## Start all services
	@echo "Starting co-located gateway demo..."
	docker compose up -d --build
	@echo ""
	@echo "Services started:"
	@echo "  - Web Client:           http://localhost:9090"
	@echo "  - Session Dashboard:    http://localhost:9092"
	@echo "  - Gateway Health:       http://localhost:9093"
	@echo "  - Load Balancer (WS):   ws://localhost:9091"
	@echo ""
	@echo "Architecture: ALB → [gateway-1, gateway-2, gateway-3]"
	@echo "Each gateway runs: guacamole-lite + guacd (localhost:4822)"

down: ## Stop all services
	docker compose down

build: ## Build all containers
	docker compose build

logs: ## Show logs
	docker compose logs -f

clean: ## Remove everything
	docker compose down -v --remove-orphans
	docker system prune -f
