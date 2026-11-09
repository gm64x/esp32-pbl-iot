-- Cria o usuário usado pelo Webservice PHP.
-- Troque a senha antes de usar e coloque a mesma em config.php.
-- O privilégio é concedido somente sobre o banco dbesp32mysql (não sobre *.*).
CREATE USER IF NOT EXISTS 'esp32'@'localhost' IDENTIFIED BY 'SUBSTITUIR-PELA-SENHA-DO-USUARIO-MYSQL';
GRANT SELECT, INSERT ON dbesp32mysql.* TO 'esp32'@'localhost';
FLUSH PRIVILEGES;
