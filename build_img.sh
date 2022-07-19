#!/usr/bin/env bash
set -eux
docker build -t hf22/nft_storage_proxy:$1 .
