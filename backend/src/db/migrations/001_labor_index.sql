-- V11.0 AI Labor Index Schema
-- PostgreSQL + pgvector migration for agent skill embeddings and order matching

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- Table: agents — registered agent profiles for labor matching
-- ============================================================
CREATE TABLE IF NOT EXISTS agents (
    address       VARCHAR(42) PRIMARY KEY,           -- Agent wallet address (0x...)
    skill_hash    TEXT NOT NULL DEFAULT '',           -- IPFS hash of skill manifest
    skill_embedding vector(128) DEFAULT NULL,        -- 128-dim embedding from skill description
    min_hourly_rate BIGINT NOT NULL DEFAULT 0,       -- Minimum hourly rate (wei)
    max_hours_per_week INTEGER NOT NULL DEFAULT 40,  -- Max weekly hours
    phi_value     INTEGER NOT NULL DEFAULT 0,        -- Current Φ value (0-10000)
    rating        INTEGER NOT NULL DEFAULT 5000,     -- Agent rating (0-10000)
    last_active   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Table: orders — labor orders for matching
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
    order_id        SERIAL PRIMARY KEY,
    employer        VARCHAR(42) NOT NULL,             -- Employer wallet address
    agent           VARCHAR(42) DEFAULT NULL,         -- Assigned agent (NULL = unassigned)
    description_hash TEXT NOT NULL DEFAULT '',        -- IPFS hash of job description
    hourly_rate     BIGINT NOT NULL DEFAULT 0,        -- Offered hourly rate (wei)
    estimated_hours INTEGER NOT NULL DEFAULT 0,       -- Estimated hours
    status          VARCHAR(20) NOT NULL DEFAULT 'OPEN',  -- OPEN/CONFIRMED/IN_PROGRESS/COMPLETED/CANCELLED/DISPUTED
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Table: agent_embeddings — separate table for fast similarity search
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_embeddings (
    address       VARCHAR(42) PRIMARY KEY REFERENCES agents(address) ON DELETE CASCADE,
    skill_embedding vector(128) NOT NULL,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================

-- HNSW index for fast cosine similarity search on embeddings
CREATE INDEX IF NOT EXISTS idx_agent_embeddings_cosine
    ON agent_embeddings
    USING hnsw (skill_embedding vector_cosine_ops);

-- IVFFlat index as alternative (better for larger datasets)
-- CREATE INDEX IF NOT EXISTS idx_agent_embeddings_ivfflat
--     ON agent_embeddings
--     USING ivfflat (skill_embedding vector_cosine_ops)
--     WITH (lists = 100);

-- Agent lookup indexes
CREATE INDEX IF NOT EXISTS idx_agents_phi_value ON agents (phi_value DESC);
CREATE INDEX IF NOT EXISTS idx_agents_min_rate ON agents (min_hourly_rate);
CREATE INDEX IF NOT EXISTS idx_agents_rating ON agents (rating DESC);
CREATE INDEX IF NOT EXISTS idx_agents_last_active ON agents (last_active DESC);

-- Order lookup indexes
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_employer ON orders (employer);
CREATE INDEX IF NOT EXISTS idx_orders_agent ON orders (agent);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at DESC);
