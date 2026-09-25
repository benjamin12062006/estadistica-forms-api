-- Equivalente histórico de migrations/002_create_statistical_spaces.sql.
CREATE TABLE statistical_spaces (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL
);
