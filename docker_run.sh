#!/usr/bin/env bash
set -eux
docker stop nft_storage_proxy
docker wait nft_storage_proxy
docker rm nft_storage_proxy
docker run --restart unless-stopped --network hf22 --add-host=play.dev.hf22.io:172.100.100.1 --add-host=services.dev.hf22.io:10.220.35.21 -p 9000:9000 -d --name nft_storage_proxy hf22/nft_storage_proxy:$1