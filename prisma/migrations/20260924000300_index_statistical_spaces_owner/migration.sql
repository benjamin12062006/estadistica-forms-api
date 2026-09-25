-- Equivalente histórico de migrations/003_index_statistical_spaces_owner.sql.
CREATE INDEX idx_statistical_spaces_owner_created
ON statistical_spaces(owner_id, created_at DESC, id DESC);
