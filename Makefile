# =============================================================================
# NCRTC Intelligent Fleet Management Platform — Makefile
# =============================================================================

.PHONY: help up down build logs seed test lint clean

# Default target
help: ## Show this help message
	@echo "NCRTC Fleet Management Platform"
	@echo "================================"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------------------
# Docker
# ---------------------------------------------------------------------------
up: ## Start all services
	docker compose up -d

up-build: ## Build and start all services
	docker compose up -d --build

down: ## Stop all services
	docker compose down

build: ## Build all containers
	docker compose build

logs: ## View logs (all services)
	docker compose logs -f

logs-backend: ## View backend logs
	docker compose logs -f backend

logs-frontend: ## View frontend logs
	docker compose logs -f frontend

restart: ## Restart all services
	docker compose restart

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
db-migrate: ## Run database migrations
	docker compose exec backend alembic upgrade head

db-rollback: ## Rollback last migration
	docker compose exec backend alembic downgrade -1

db-seed: ## Seed database with demo data
	docker compose exec backend python -m app.seed.run

db-reset: ## Reset database (drop + recreate + migrate + seed)
	docker compose exec backend python -m app.seed.reset

# ---------------------------------------------------------------------------
# Development
# ---------------------------------------------------------------------------
backend-shell: ## Open shell in backend container
	docker compose exec backend bash

frontend-shell: ## Open shell in frontend container
	docker compose exec frontend sh

psql: ## Open PostgreSQL shell
	docker compose exec postgres psql -U ncrtc_admin -d ncrtc_fleet

# ---------------------------------------------------------------------------
# Testing
# ---------------------------------------------------------------------------
test: ## Run all tests
	docker compose exec backend pytest tests/ -v
	docker compose exec frontend npm run test

test-backend: ## Run backend tests
	docker compose exec backend pytest tests/ -v --cov=app

test-frontend: ## Run frontend tests
	docker compose exec frontend npm run test

# ---------------------------------------------------------------------------
# Code Quality
# ---------------------------------------------------------------------------
lint: ## Run linters
	docker compose exec backend ruff check app/
	docker compose exec frontend npm run lint

format: ## Format code
	docker compose exec backend ruff format app/
	docker compose exec frontend npm run format

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
clean: ## Remove all containers, volumes, and images
	docker compose down -v --rmi all
	docker system prune -f
