-- =============================================================================
-- PostgreSQL Initialization Script
-- =============================================================================
-- Enable PostGIS extension for spatial operations
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- For fuzzy text search
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- For UUID generation
