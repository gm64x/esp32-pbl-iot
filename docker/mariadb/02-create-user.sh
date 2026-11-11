#!/bin/sh
# Cria o usuário do Webservice com privilégios apenas sobre dbesp32mysql.*
# (SELECT para a listagem e INSERT para gravar as medições). Roda uma vez,
# na primeira inicialização do volume, com as variáveis definidas no docker-compose.yml.
set -e

# DELETE só em modo simulação (reset pelo atalho do site); fora dele o usuário não apaga nada
PRIVILEGIOS_EXTRAS=""
if [ "${SIMULATION:-0}" = "1" ]; then
    PRIVILEGIOS_EXTRAS="GRANT DELETE ON dbesp32mysql.medicoes TO '$DB_USER'@'%';"
fi

mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" <<SQL
CREATE USER IF NOT EXISTS '$DB_USER'@'%' IDENTIFIED BY '$DB_PASSWORD';
GRANT SELECT, INSERT ON dbesp32mysql.* TO '$DB_USER'@'%';
$PRIVILEGIOS_EXTRAS
FLUSH PRIVILEGES;
SQL
