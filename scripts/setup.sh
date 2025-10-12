#!/bin/bash

# Pixel Ponies Bot Setup Script
# Run with: bash scripts/setup.sh

set -e

echo "🏇 Setting up Pixel Ponies Bot..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
if [ $NODE_VERSION -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) found"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration before starting the bot"
fi

# Create logs directory
mkdir -p logs

# Check if MongoDB is running (if using local MongoDB)
if command -v mongod &> /dev/null; then
    if pgrep -x "mongod" > /dev/null; then
        echo "✅ MongoDB is running"
    else
        echo "⚠️  MongoDB is installed but not running. Start it with: mongod"
    fi
else
    echo "⚠️  MongoDB not found locally. Make sure to configure MONGODB_URI in .env"
fi

# Setup PM2 if in production
if [ "$NODE_ENV" = "production" ]; then
    if ! command -v pm2 &> /dev/null; then
        echo "📦 Installing PM2 for production..."
        npm install -g pm2
    fi
    echo "✅ PM2 ready for production deployment"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env file with your configuration:"
echo "   - TELEGRAM_BOT_TOKEN (get from @BotFather)"
echo "   - SOLANA_PRIVATE_KEY (your bot wallet)"
echo "   - MONGODB_URI (database connection)"
echo "   - ADMIN_CHAT_ID (your Telegram chat ID)"
echo ""
echo "2. Fund your bot wallet with $PONY tokens and SOL for fees"
echo ""
echo "3. Start the bot:"
echo "   Development: npm run dev"
echo "   Production:  npm start"
echo ""
echo "🔐 Security reminder:"
echo "   - Never commit your .env file"
echo "   - Keep private keys secure"
echo "   - Monitor bot balance regularly"
echo ""
echo "📚 Read README.md for detailed setup instructions"