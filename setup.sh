#!/bin/bash

set -e

echo "🚀 Prestige Club - Setup Script"
echo "================================"
echo ""

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js v20+ required. Current: $(node -v)"
    exit 1
fi
echo "✅ Node.js $(node -v)"
echo ""

# Check Docker
echo "Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi
echo "✅ Docker $(docker --version | cut -d' ' -f3 | cut -d',' -f1)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo ""

# Start PostgreSQL
echo "🐘 Starting PostgreSQL..."
docker-compose up -d
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5
echo ""

# Generate Prisma client
echo "🔨 Generating Prisma client..."
npm run prisma:generate
echo ""

# Run migrations
echo "📊 Running database migrations..."
npm run prisma:migrate
echo ""

# Seed database
read -p "📝 Seed database with sample data? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm run prisma:seed
    echo ""
fi

# Success
echo "✅ Setup complete!"
echo ""
echo "Start the development server:"
echo "  npm run dev"
echo ""
echo "Run tests:"
echo "  npm test"
echo ""
echo "API will be available at: http://localhost:3000"
