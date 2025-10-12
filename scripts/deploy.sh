#!/bin/bash

# Pixel Ponies Bot Deployment Script
# Run with: bash scripts/deploy.sh

set -e

echo "🚀 Deploying Pixel Ponies Bot..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found! Please create it from .env.example"
    exit 1
fi

# Load environment variables
source .env

# Validate critical environment variables
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "❌ TELEGRAM_BOT_TOKEN not set in .env"
    exit 1
fi

if [ -z "$SOLANA_PRIVATE_KEY" ]; then
    echo "❌ SOLANA_PRIVATE_KEY not set in .env"
    exit 1
fi

if [ -z "$MONGODB_URI" ]; then
    echo "❌ MONGODB_URI not set in .env"
    exit 1
fi

echo "✅ Environment validation passed"

# Install/update dependencies
echo "📦 Installing production dependencies..."
npm install --only=production

# Run any necessary database migrations/setup
echo "🗄️  Setting up database..."
# Add any database setup commands here

# Test Solana connection
echo "🔗 Testing Solana connection..."
node -e "
import('./src/services/solanaService.js').then(module => {
  const solanaService = module.default;
  solanaService.healthCheck()
    .then(health => {
      if (health.connected) {
        console.log('✅ Solana connection successful');
        console.log('💰 Bot balance:', health.botPonyBalance, '$PONY');
        if (health.botPonyBalance < 1000) {
          console.log('⚠️  Warning: Low bot balance');
        }
      } else {
        console.log('❌ Solana connection failed:', health.error);
        process.exit(1);
      }
    })
    .catch(err => {
      console.log('❌ Solana service error:', err.message);
      process.exit(1);
    });
}).catch(err => {
  console.log('❌ Module import error:', err.message);
  process.exit(1);
});
"

# Check if PM2 is available
if command -v pm2 &> /dev/null; then
    echo "🔄 Deploying with PM2..."
    
    # Stop existing instance if running
    pm2 delete pixel-ponies-bot 2>/dev/null || true
    
    # Start new instance
    pm2 start src/index.js --name "pixel-ponies-bot" --env production
    
    # Save PM2 configuration
    pm2 save
    
    echo "✅ Bot deployed with PM2"
    echo "📊 Check status: pm2 status"
    echo "📋 View logs: pm2 logs pixel-ponies-bot"
    
else
    echo "⚠️  PM2 not found. Starting with node..."
    echo "🔄 Use PM2 for production: npm install -g pm2"
    NODE_ENV=production node src/index.js
fi

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📊 Monitoring commands:"
echo "   pm2 status                    - Check bot status"
echo "   pm2 logs pixel-ponies-bot     - View logs"
echo "   pm2 restart pixel-ponies-bot  - Restart bot"
echo "   pm2 stop pixel-ponies-bot     - Stop bot"
echo ""
echo "🔍 Bot should be running at:"
echo "   Telegram: @$(echo $TELEGRAM_BOT_TOKEN | cut -d':' -f1)"
echo "   Admin Chat ID: $ADMIN_CHAT_ID"
echo ""