FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create upload directories
RUN mkdir -p uploads/incidents uploads/notices uploads/profiles uploads/reports

# Expose port
EXPOSE 8000

# Start with schema init + seed + server
# The seed script is idempotent — it checks if data already exists.
# We only suppress the specific "already seeded" case; real errors
# (connection failures, schema issues) will crash the container on purpose.
CMD ["sh", "-c", "python -c 'from app.seed import seed_database; import asyncio; asyncio.run(seed_database())' && echo 'Seed: OK' || { echo 'ERROR: Seed script failed — container will NOT start with a broken database.'; exit 1; }; exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]