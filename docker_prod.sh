#!/usr/bin/env bash
set -eux
docker stop nft_storage_proxy || true
docker wait nft_storage_proxy || true
docker rm nft_storage_proxy   || true
docker run --restart unless-stopped -p 9000:9000 -d --name nft_storage_proxy hf22/nft_storage_proxy:$1

