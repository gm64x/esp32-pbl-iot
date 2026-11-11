-- Cria o banco e a tabela de medições do PBL 03 (MariaDB)
-- Bancos já existentes: rode webservice/migrate-001-device-id.sql
CREATE DATABASE IF NOT EXISTS dbesp32mysql CHARACTER SET utf8mb4;

USE dbesp32mysql;

CREATE TABLE IF NOT EXISTS medicoes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sensor VARCHAR(30) NOT NULL,
    local_instalado VARCHAR(30) NOT NULL,
    valor1 VARCHAR(10),
    valor2 VARCHAR(10),
    valor3 VARCHAR(10),
    data_hora DATETIME,
    device_id VARCHAR(40) NOT NULL DEFAULT 'desconhecido',
    INDEX idx_device_id (device_id, id)
);
