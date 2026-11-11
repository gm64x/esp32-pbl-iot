-- Migração 001: identifica cada ESP32 pela coluna device_id.
-- Para bancos criados antes desta versão. Pode ser executada mais de uma vez.
-- Linhas antigas ficam com device_id = 'desconhecido'.
--
-- Aplicar com o contêiner do MariaDB rodando (a senha vem do ambiente do contêiner):
--   docker compose exec -T db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" dbesp32mysql' < webservice/migrate-001-device-id.sql

ALTER TABLE medicoes ADD COLUMN IF NOT EXISTS device_id VARCHAR(40) NOT NULL DEFAULT 'desconhecido';

ALTER TABLE medicoes ADD INDEX IF NOT EXISTS idx_device_id (device_id, id);
