SELECT id, name, created_at
FROM statistical_spaces
WHERE owner_id = ?
ORDER BY created_at DESC, id DESC;

INSERT INTO statistical_spaces (id, name, owner_id, created_at)
SELECT ?, ?, id, ?
FROM app_users
WHERE id = ?
RETURNING id, name, created_at;
