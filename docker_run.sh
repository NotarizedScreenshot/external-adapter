#!/usr/bin/env bash
set -eux
docker stop nft_storage_proxy
docker rm nft_storage_proxy
docker run -p 9000:9000 -d --name nft_storage_proxy nft_storage_proxy:$1
