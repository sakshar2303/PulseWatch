# ==============================================================================
# PulseWatch — Development Commands
# ==============================================================================

.PHONY: help infra-up infra-down migrate-up migrate-down \
        run-collector run-ingestion run-api run-detector run-dashboard \
        build test lint clean

# Default target
help: ## Show this help message
	@echo "PulseWatch — Development Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ==============================================================================
# Infrastructure
# ==============================================================================

infra-up: ## Start TimescaleDB and NATS containers
	docker compose up -d

infra-down: ## Stop infrastructure containers
	docker compose down

infra-reset: ## Stop containers and remove volumes (destroys data)
	docker compose down -v

# ==============================================================================
# Database Migrations
# ==============================================================================

migrate-up: ## Run all pending migrations
	@echo "Running migrations..."
	@for f in migrations/*.up.sql; do \
		echo "  Applying $$f"; \
		if command -v psql >/dev/null 2>&1; then \
			PGPASSWORD=$${TSDB_PASSWORD:-changeme} psql \
				-h $${TSDB_HOST:-localhost} \
				-p $${TSDB_PORT:-5432} \
				-U $${TSDB_USER:-pulsewatch} \
				-d $${TSDB_DATABASE:-pulsewatch} \
				-f $$f; \
		else \
			docker exec -i pulsewatch-tsdb psql -U $${TSDB_USER:-pulsewatch} -d $${TSDB_DATABASE:-pulsewatch} < $$f; \
		fi \
	done
	@echo "Migrations complete."

migrate-down: ## Rollback all migrations (reverse order)
	@echo "Rolling back migrations..."
	@for f in $$(ls -r migrations/*.down.sql); do \
		echo "  Reverting $$f"; \
		if command -v psql >/dev/null 2>&1; then \
			PGPASSWORD=$${TSDB_PASSWORD:-changeme} psql \
				-h $${TSDB_HOST:-localhost} \
				-p $${TSDB_PORT:-5432} \
				-U $${TSDB_USER:-pulsewatch} \
				-d $${TSDB_DATABASE:-pulsewatch} \
				-f $$f; \
		else \
			docker exec -i pulsewatch-tsdb psql -U $${TSDB_USER:-pulsewatch} -d $${TSDB_DATABASE:-pulsewatch} < $$f; \
		fi \
	done
	@echo "Rollback complete."

# ==============================================================================
# Run Services (local development)
# ==============================================================================

run-collector: ## Run the collector agent
	cd collector && go run ./cmd/collector/

run-ingestion: ## Run the ingestion service
	cd ingestion && go run ./cmd/ingestion/

run-api: ## Run the query/API service
	cd api && go run ./cmd/api/

run-detector: ## Run the anomaly detection service
	cd detector && ([ -d .venv ] && .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload || python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload)

run-dashboard: ## Run the frontend dashboard (dev server)
	cd dashboard && npm run dev

# ==============================================================================
# Build
# ==============================================================================

build-collector: ## Build the collector binary
	cd collector && go build -o ../bin/collector ./cmd/collector/

build-ingestion: ## Build the ingestion binary
	cd ingestion && go build -o ../bin/ingestion ./cmd/ingestion/

build-api: ## Build the API binary
	cd api && go build -o ../bin/api ./cmd/api/

build-dashboard: ## Build the dashboard for production
	cd dashboard && npm run build

build-all: build-collector build-ingestion build-api build-dashboard ## Build all services

# ==============================================================================
# Test
# ==============================================================================

test-collector: ## Run collector tests
	cd collector && go test ./... -v

test-ingestion: ## Run ingestion tests
	cd ingestion && go test ./... -v

test-api: ## Run API tests
	cd api && go test ./... -v

test-detector: ## Run anomaly detector tests
	cd detector && ([ -d .venv ] && .venv/bin/pytest tests/ -v || python -m pytest tests/ -v)

test-all: test-collector test-ingestion test-api test-detector ## Run all tests

# ==============================================================================
# Lint
# ==============================================================================

lint-go: ## Lint all Go code
	cd collector && golangci-lint run ./...
	cd ingestion && golangci-lint run ./...
	cd api && golangci-lint run ./...

lint-python: ## Lint Python code
	cd detector && ruff check app/ tests/

lint-dashboard: ## Lint frontend code
	cd dashboard && npm run lint

lint-all: lint-go lint-python lint-dashboard ## Lint everything

# ==============================================================================
# Docker & Production Compose
# ==============================================================================

docker-build: ## Build all 5 application service Docker images
	docker compose -f docker-compose.prod.yml build

docker-prod-up: ## Start entire full-stack platform in Docker
	docker compose -f docker-compose.prod.yml up -d

docker-prod-down: ## Stop entire full-stack Docker platform
	docker compose -f docker-compose.prod.yml down

docker-prod-logs: ## View production container logs
	docker compose -f docker-compose.prod.yml logs -f

# ==============================================================================
# Kubernetes
# ==============================================================================

k8s-validate: ## Validate all Kubernetes manifests
	@echo "Validating Kubernetes manifests..."
	@python3 scripts/validate_k8s.py

k8s-apply: ## Apply all Kubernetes manifests to current cluster
	kubectl apply -f deployments/k8s/

k8s-delete: ## Delete all PulseWatch Kubernetes resources
	kubectl delete -f deployments/k8s/

# ==============================================================================
# Utilities & Observability
# ==============================================================================

loadgen: ## Run the synthetic load generator
	cd scripts && go run loadgen.go

seed: ## Seed the database with sample data
	PGPASSWORD=$${TSDB_PASSWORD:-changeme} psql \
		-h $${TSDB_HOST:-localhost} \
		-p $${TSDB_PORT:-5432} \
		-U $${TSDB_USER:-pulsewatch} \
		-d $${TSDB_DATABASE:-pulsewatch} \
		-f scripts/seed.sql

chaos-test: ## Run the automated chaos engineering resilience test suite
	./scripts/chaos/chaos_test.sh

jaeger-ui: ## Open Jaeger distributed tracing UI
	@echo "Jaeger UI available at: http://localhost:16686"
	@command -v open >/dev/null 2>&1 && open http://localhost:16686 || true

slo-check: ## Query real-time SLO compliance and error budget
	@curl -s http://localhost:8080/api/v1/slo | jq . || curl -s http://localhost:8080/api/v1/slo

clean: ## Remove build artifacts
	rm -rf bin/
	rm -rf dashboard/dist/
	rm -rf dashboard/node_modules/
