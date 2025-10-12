# 🏇 Pixel Ponies - Telegram Racing Bot

**Production-ready Telegram bot for horse racing with real $PONY (SPL token) payouts**

Automated races every 5 minutes • Real-time betting • On-chain payouts • Treasury management

## 🚀 Quick Start

### 1. Environment Setup

```bash
# Clone and setup
git clone <your-repo>
cd pixel-ponies-bot
npm install

# Copy environment template
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` with your settings:

```env
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
SOLANA_PRIVATE_KEY=your_base58_encoded_bot_wallet_private_key
MONGODB_URI=mongodb://localhost:27017/pixel-ponies
ADMIN_CHAT_ID=your_telegram_chat_id

# Optional (defaults shown)
RACE_INTERVAL_MINUTES=5
TREASURY_CAP_PER_RACE=700
DAILY_TREASURY_LIMIT=200000
MIN_BET_AMOUNT=1
MAX_BET_AMOUNT=100
```

### 3. Setup Bot Wallet

```bash
# Create a new Solana keypair or use existing
# Fund with $PONY tokens and SOL for fees
# Add private key (base58 encoded) to .env
```

### 4. Start the Bot

```bash
# Development
npm run dev

# Production
npm start
```

## 🎯 Features

### Core Racing
- **Automated Races**: New race every 5 minutes
- **6 Unique Horses**: Each with different odds and personality
- **Real-time Betting**: 2-minute betting window per race
- **Dynamic Odds**: Slight variance each race for excitement

### Betting System  
- **Multiple Bet Types**: Win (2.5x), Place (1.8x), Show (1.3x)
- **Flexible Limits**: 1-100 $PONY per bet, max 5 bets per race
- **Real Payouts**: Instant SPL token transfers to winners

### Treasury Management
- **Daily Caps**: 200,000 $PONY daily limit prevents drain
- **Per-race Limits**: 700 $PONY max payouts per race
- **Carryover System**: Unused funds roll to next race
- **Emergency Stop**: Auto-halt if treasury at risk

### User Experience
- **Easy Registration**: `/register [solana_address]`
- **Simple Betting**: `/bet [horse_number] [amount]`  
- **Real-time Updates**: Race announcements and results
- **Leaderboards**: Track top winners and stats

## 🤖 Bot Commands

### User Commands
```
/start          - Welcome and setup
/register       - Register your Solana address
/race           - View current race and horses
/bet 1 10       - Bet 10 $PONY on horse #1
/balance        - Check winnings and stats
/history        - Recent race results  
/leaderboard    - Top winners
/help           - Full command list
/stats          - Bot statistics
```

### Admin Commands
```
/admin_status         - Bot and scheduler status
/admin_treasury       - Treasury details and transactions
/admin_emergency_stop - Halt all races immediately
```

## 🏗️ Architecture

### Core Services
- **Race Service**: Creates races, handles betting, processes payouts
- **Solana Service**: SPL token transfers, balance checks, validation
- **Scheduler Service**: 5-minute automated race cycle with safety checks
- **Command Handler**: Telegram command processing and user interactions

### Data Models
- **User**: Registration, stats, Solana addresses
- **Race**: Race data, results, horses, payouts
- **Bet**: Individual bets with status tracking
- **Treasury**: Daily limits, transaction history, emergency controls

### Safety Features
- **Treasury Monitoring**: Real-time balance and limit tracking
- **Health Checks**: Solana connection, bot balance validation
- **Error Recovery**: Graceful handling of failures
- **Admin Alerts**: Notifications for critical events

## 💰 Economics

### 5-Day Runway (1M $PONY)
- **Total Races**: 1,440 races (5 days × 24 hours × 12 races/hour)
- **Average Budget**: ~694 $PONY per race
- **Safety Cap**: 700 $PONY max per race
- **Daily Limit**: 200,000 $PONY prevents early drain

### Payout Structure
```
Win Bets:   2.5x multiplier (horse must finish 1st)
Place Bets: 1.8x multiplier (horse must finish 1st or 2nd)  
Show Bets:  1.3x multiplier (horse must finish 1st, 2nd, or 3rd)
```

### Treasury Protection
- Per-race caps prevent individual race drain
- Daily limits ensure multi-day operation
- Carryover system maximizes engagement
- Emergency stops for critical situations

## 🔧 Configuration

### Race Settings
```javascript
RACE_INTERVAL_MINUTES=5     // Time between races
TREASURY_CAP_PER_RACE=700   // Max payout per race  
MIN_BET_AMOUNT=1            // Minimum bet size
MAX_BET_AMOUNT=100          // Maximum bet size
MAX_USER_BETS_PER_RACE=5    // Bets per user per race
```

### Payout Multipliers
```javascript
WIN_MULTIPLIER=2.5          // Win bet payout
PLACE_MULTIPLIER=1.8        // Place bet payout
SHOW_MULTIPLIER=1.3         // Show bet payout
```

### Safety Limits
```javascript
DAILY_TREASURY_LIMIT=200000 // Max daily payouts
JACKPOT_CARRYOVER_ENABLED=true // Roll unused funds
```

## 🚀 Deployment

### Local Development
```bash
# Start MongoDB
mongod

# Start bot in dev mode
npm run dev
```

### Production Deployment
```bash
# Install PM2 for process management
npm install -g pm2

# Start bot with PM2
pm2 start src/index.js --name "pixel-ponies-bot"
pm2 startup
pm2 save
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY src ./src
CMD ["npm", "start"]
```

### Environment Variables
Ensure these are set in production:
- `TELEGRAM_BOT_TOKEN` - From @BotFather
- `SOLANA_PRIVATE_KEY` - Bot wallet private key (base58)
- `MONGODB_URI` - Database connection string
- `ADMIN_CHAT_ID` - Your Telegram chat ID for alerts

## 🔐 Security

### Bot Wallet Security
- Store private keys securely (never commit to repo)
- Use environment variables or secure key management
- Fund with appropriate amounts (not entire treasury)
- Monitor for unusual activity

### Treasury Protection  
- Per-race and daily limits prevent drain
- Emergency stop functionality
- Real-time monitoring and alerts
- Automatic shutdowns on critical errors

### User Safety
- Address validation before payouts
- Bet limits prevent large losses  
- Transparent leaderboards and stats
- Clear terms and responsible gaming

## 📊 Monitoring

### Health Checks
- Solana connection status
- Bot token balance monitoring
- MongoDB connectivity
- Race scheduler status

### Alerts
- Low bot balance warnings
- Treasury limit approaches
- Failed transactions
- Emergency stop triggers

### Logging
- All bets and payouts logged
- Race results and statistics
- Error tracking and debugging
- Admin action audit trail

## 🎮 Game Mechanics

### Race Simulation
Horses have different base odds that affect their probability of winning:
- Lower odds = higher chance of winning
- Random variance adds excitement
- Finish times calculated with odds weighting
- Dramatic 3-second race execution

### Betting Dynamics
- Pool-based system (bets vs. treasury)
- Real-time betting statistics
- Horse popularity affects engagement
- Carryover jackpots for excitement

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Issues**: Use GitHub Issues for bugs and feature requests
- **Admin Support**: Contact via the configured admin Telegram chat
- **Documentation**: Check code comments for implementation details

---

**⚠️ Disclaimer**: This bot involves real cryptocurrency transactions. Use responsibly and ensure compliance with local gambling regulations. Always test thoroughly before production deployment.