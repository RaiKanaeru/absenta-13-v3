#!/bin/bash
# ===========================================
# ABSENTA 13 - Production Deployment Script
# ===========================================

set -e

echo "🚀 Starting ABSENTA 13 Deployment..."

# Check if .env exists (using [[ for bash compatibility)
if [[ ! -f ".env" ]]; then
    echo "❌ Error: .env file not found!"
    echo "📝 Please copy .env.example to .env and update values"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Pull latest changes (if using git)
echo "📦 Pulling latest changes..."
git pull origin main 2>/dev/null || echo "⚠️ Git pull skipped (not a git repo or no remote)"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --omit=dev --legacy-peer-deps

# Build frontend
echo "🔨 Building frontend..."
npm run build

# Create required directories
echo "📁 Creating directories..."
mkdir -p logs backups temp downloads reports archives public/uploads/letterheads

# Restart PM2 (if using PM2) - using [[ for bash compatibility
if command -v pm2 &> /dev/null; then
    echo "🔄 Restarting PM2..."
    pm2 restart ecosystem.config.cjs --env production 2>/dev/null || \
    pm2 start ecosystem.config.cjs --env production
else
    echo "⚠️ PM2 not installed. Starting with node..."
    node server_modern.js &
fi

echo "✅ Deployment complete!"
echo "🌐 Server running on port ${PORT:-3001}"
