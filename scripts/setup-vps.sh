#!/usr/bin/env bash
# This script runs on the remote VPS to install core dependencies.
# It is designed to be streamed via SSH: ssh <host> 'bash -s' < scripts/setup-vps.sh
set -Eeuo pipefail

echo "==> Updating apt package list..."
sudo apt-get update

echo "==> Installing basic prerequisites..."
sudo apt-get install -y curl gnupg ca-certificates

echo "==> Setting up Node.js 22 (LTS) repository..."
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -

echo "==> Installing Node.js..."
sudo apt-get install -y nodejs

echo "==> Installing PM2 globally..."
sudo npm install -g pm2

echo "==> Adding official MongoDB 8.0 key & repository..."
sudo rm -f /usr/share/keyrings/mongodb-server-gkeyring.gpg
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-gkeyring.gpg
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-gkeyring.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list

echo "==> Installing MongoDB Community Edition..."
sudo apt-get update
sudo apt-get install -y mongodb-org

echo "==> Starting and enabling MongoDB service..."
sudo systemctl daemon-reload
sudo systemctl start mongod
sudo systemctl enable mongod

echo "==> Verifying installed versions:"
echo "    Node:    $(node -v)"
echo "    NPM:     $(npm -v)"
echo "    PM2:     $(pm2 -v)"
echo "    MongoDB: $(mongod --version | head -n 1)"
echo "==> VPS Setup Complete! 🎉"
