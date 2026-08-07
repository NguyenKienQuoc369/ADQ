#!/usr/bin/env bash
# ====================================================================
# ADQ Enterprise DAST/ASM Platform - Production VPS Setup & Hardening
# ====================================================================

set -e

echo "🛡️ Starting ADQ VPS Hardening and Production Deployment Setup..."

# 1. System Limits & Kernel Tuning for High-Concurrency Scanning
echo "⚡ Optimizing Kernel sysctl parameters for socket/network concurrency..."
sudo sysctl -w net.core.somaxconn=1024
sudo sysctl -w net.ipv4.tcp_tw_reuse=1
sudo sysctl -w fs.file-max=2097152

# 2. Configure UFW Firewall
echo "🔒 Configuring UFW Firewall Rules..."
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow Essential Public Services
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP Nginx / API'
sudo ufw allow 443/tcp comment 'HTTPS TLS / API'
sudo ufw allow 8000/tcp comment 'FastAPI Backend Endpoint'
sudo ufw allow 8888/tcp comment 'ADQ OAST Interaction Listener'

# Ensure Internal Services (Postgres 5432 & Redis 6379) remain DENIED to public
sudo ufw deny 5432/tcp comment 'Block Postgres Public Access'
sudo ufw deny 6379/tcp comment 'Block Redis Public Access'

# Enable UFW non-interactively
echo "y" | sudo ufw enable
sudo ufw status verbose

# 3. Verify Docker & Docker Compose Installation
if ! command -v docker &> /dev/null; then
    echo "🐳 Docker not found. Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
fi

# 4. Environment Check
if [ ! -f .env ]; then
    echo "⚠️ .env file not found. Copying from .env.production.example..."
    cp .env.production.example .env
    echo " Please edit .env with your actual production secrets before running!"
fi

# 5. Launch Backend Services with Production Compose Spec
echo "🚀 Building and starting ADQ Backend & Worker Grid..."
docker compose -f docker-compose.prod.yml up -d --build

echo "===================================================================="
echo "✅ ADQ Production VPS Backend Deployed Successfully!"
echo "   - FastAPI Swagger Docs: http://YOUR_VPS_IP:8000/docs"
echo "   - OAST Interaction Server: http://YOUR_VPS_IP:8888"
echo "   - UFW Firewall Active (Ports 5432 & 6379 strictly blocked)"
echo "===================================================================="
