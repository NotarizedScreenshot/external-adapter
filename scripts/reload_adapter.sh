#!/usr/bin/sh
export TAGS=${1:-latest}
export TAG=$(echo "$TAGS" | cut -d',' -f1)
docker compose stop notaryshot-adapter
docker compose rm --stop --force notaryshot-adapter 
docker compose pull
docker compose create notaryshot-adapter
docker compose start notaryshot-adapter
