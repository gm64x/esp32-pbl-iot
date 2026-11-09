#!/bin/sh
# Cria o usuário do Webservice com privilégios apenas sobre dbesp32mysql.*
# (SELECT para a listagem e INSERT para gravar as medições). Roda uma vez,
# na primeira inicialização do volume, com as variáveis definidas no docker-compose.yml.
set -e

mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" <<SQL
CREATE USER IF NOT EXISTS '$DB_USER'@'%' IDENTIFIED BY '$DB_PASSWORD';
GRANT SELECT, INSERT ON dbesp32mysql.* TO '$DB_USER'@'%';
FLUSH PRIVILEGES;
SQL
