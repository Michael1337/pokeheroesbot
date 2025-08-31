#!/bin/bash

set -e  # Exit on error
set -o pipefail

echo ">>> Pulling latest code from GitHub..."
git pull || { echo "git pull failed!"; exit 1; }
echo ""

echo ">>> Bringing down any running containers..."
docker compose down || echo "No containers to bring down."
echo ""

echo ">>> Removing old image..."
docker image rm pokeheroesbot || echo "Image not found, skipping removal."
echo ""

echo ">>> Building new image..."
docker build -t pokeheroesbot . || { echo "Docker build failed!"; exit 1; }
echo ""

echo ">>> Starting container in detached mode..."
docker compose up -d || { echo "docker compose up failed!"; exit 1; }
echo ""

echo ">>> Deployment complete!"
