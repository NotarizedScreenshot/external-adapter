#!/usr/bin/sh
docker compose stop notaryshot-adapter
docker compose rm --stop --force notaryshot-adapter 
docker compose pull
docker compose create notaryshot-adapter
docker compose start notaryshot-adapter
