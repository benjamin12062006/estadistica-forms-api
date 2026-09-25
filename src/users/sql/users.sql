
-- Inserta un nuevo usuario local si no existe, o actualiza si ya existe.
INSERT INTO app_users
  (id, identity_issuer, identity_subject, email, display_name, created_at, updated_at)
VALUES (?, ?, ?, ?, NULL, ?, ?)
ON CONFLICT(identity_issuer, identity_subject) DO UPDATE SET
  email = COALESCE(excluded.email, app_users.email),
  updated_at = CASE
    WHEN excluded.email IS NOT NULL AND excluded.email IS NOT app_users.email
    THEN excluded.updated_at
    ELSE app_users.updated_at
  END
RETURNING id, email, display_name, created_at, updated_at;


-- Busca el perfil local de la identidad validada por Descope.
SELECT id, email, display_name, created_at, updated_at
FROM app_users
WHERE identity_issuer = ? AND identity_subject = ?;

-- Actualiza el nombre del usuario local.
UPDATE app_users SET
  display_name = ?,
  updated_at = CASE
    WHEN display_name IS NOT ? THEN ?
    ELSE updated_at
  END
WHERE identity_issuer = ? AND identity_subject = ?
RETURNING id, email, display_name, created_at, updated_at;
