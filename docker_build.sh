#!/usr/bin/env bash
set -eux
docker build -t nft_storage_proxy:$1 .
