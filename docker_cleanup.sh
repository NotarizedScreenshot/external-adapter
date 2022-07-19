#!/usr/bin/env bash
set -eux
docker stop $(docker ps -a -q --filter "ancestor=hf22/spa_ssr_old")
docker rm $(docker ps -a -q --filter "ancestor=hf22/spa_ssr_old")
docker rmi hf22/spa_ssr_old


