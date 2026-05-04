#!/bin/bash
# Quick setup script for Grafana integration

set -e

echo "🚀 Monitoring System Setup"
echo "========================="
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "⚠️  .env.local not found"
    echo ""
    echo "Creating .env.local from template..."
    cp .env.example .env.local
    echo ""
    echo "📝 Please edit .env.local with your Grafana details:"
    echo "   - NEXT_PUBLIC_GRAFANA_URL: Your Grafana instance URL"
    echo "   - GRAFANA_API_KEY: Your Grafana API key"
    echo ""
    echo "To get your API key:"
    echo "   1. Go to Grafana Admin Panel"
    echo "   2. Configuration → API Keys"
    echo "   3. Create a new API key with 'Viewer' role"
    echo ""
    echo "After updating .env.local, run this script again."
    exit 1
fi

echo "✅ .env.local found"
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed"
    echo ""
fi

# Show what's configured
GRAFANA_URL=$(grep "NEXT_PUBLIC_GRAFANA_URL" .env.local | cut -d '=' -f 2)
GRAFANA_KEY=$(grep "GRAFANA_API_KEY" .env.local | cut -d '=' -f 2)

echo "📊 Configuration:"
echo "   Grafana URL: $GRAFANA_URL"
echo "   API Key: ${GRAFANA_KEY:0:10}..." 
echo ""

# Start dev server
echo "🏃 Starting development server..."
echo "   http://localhost:3000"
echo ""
echo "Test credentials:"
echo "   Admin:    admin / admin123"
echo "   User:     user / user123"
echo ""
echo "📚 Documentation:"
echo "   - Setup Guide: MONITORING_SETUP.md"
echo "   - Full Guide: MONITORING_README.md"
echo ""

npm run dev
