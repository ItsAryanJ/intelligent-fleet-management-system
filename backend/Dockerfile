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
CMD ["sh", "-c", "set -e; python -c 'from app.seed import seed_database; import asyncio; asyncio.run(seed_database())' || echo 'WARN: seed skipped (may already exist)'; exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]