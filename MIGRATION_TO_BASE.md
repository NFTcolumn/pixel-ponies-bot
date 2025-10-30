# Migration to Base - Summary

## Overview
Successfully migrated the Pixel Ponies bot from Solana to Base (Ethereum L2) network.

## Changes Made

### 1. Dependencies Updated
- **Removed**: `@solana/web3.js`, `@solana/spl-token`, `bs58`
- **Added**: `ethers@^6.9.0`
- Updated keywords in package.json to reflect Base/Ethereum support

### 2. New Files Created

#### `src/services/BaseService.js`
- Complete replacement for SolanaService
- Features:
  - Base Mainnet RPC connection (https://mainnet.base.org)
  - ERC20 token interaction for PONY token
  - Address validation for Ethereum addresses
  - Token transfer functionality
  - Balance checking
  - Gas estimation and network info
  - Reads wallet from `wallet.json` file (with env fallback)

#### `wallet.json` (NOT TRACKED IN GIT)
- Stores your private key securely
- Format:
  ```json
  {
    "privateKey": "YOUR_PRIVATE_KEY_HERE",
    "network": "base-mainnet",
    "chainId": 8453,
    "note": "NEVER commit to git. NEVER share."
  }
  ```

### 3. Configuration Updates

#### `.env.example`
- Changed from Solana to Base configuration
- New variables:
  - `BASE_RPC_URL=https://mainnet.base.org`
  - `PONY_TOKEN_ADDRESS=0x6ab297799335E7b0f60d9e05439Df156cf694Ba7`
- Removed old Solana variables

#### `.gitignore`
- Added `wallet.json` to ensure private keys are never committed

### 4. Code Updates

All service and handler files updated to use Base:

#### Services
- `PayoutService.js` - Uses BaseService, updates URLs to BaseScan
- `ReferralService.js` - Uses BaseService for token transfers
- `BaseService.js` - New service (replaces SolanaService)

#### Handlers
- `registrationHandler.js` - Validates Ethereum addresses
- `adminHandler.js` - Updated comments and address handling
- `infoHandler.js` - Shows Base addresses
- `raceHandler.js` - Checks Base addresses

#### Models
- `User.js` - Changed `solanaAddress` field to `baseAddress`

#### Core
- `index.js` - Updated environment checks for Base configuration

### 5. Database Schema Changes

**User Model Field Change:**
- `solanaAddress` → `baseAddress`

**Migration Note:** Existing users in your MongoDB will need their addresses migrated. You may need to run a migration script or have users re-register with their Ethereum addresses.

## Network Details

### Base Mainnet
- **Chain ID**: 8453
- **RPC URL**: https://mainnet.base.org
- **Block Explorer**: https://basescan.org

### PONY Token Contract
- **Address**: `0x6ab297799335E7b0f60d9e05439Df156cf694Ba7`
- **Type**: ERC20
- **Deployed**: Per whitepaper V1

### Smart Contracts (From Whitepaper)
- **PonyTokenV1**: `0x6ab297799335E7b0f60d9e05439Df156cf694Ba7`
- **PixelPonyV1 (Game)**: `0x2B4652Bd6149E407E3F57190E25cdBa1FC9d37d8`

## Setup Instructions

### 1. Configure Wallet
Edit `wallet.json` with your Base wallet private key:
```json
{
  "privateKey": "your_ethereum_private_key_without_0x_prefix",
  "network": "base-mainnet",
  "chainId": 8453
}
```

**IMPORTANT**: This private key should have:
- Enough ETH on Base for gas fees
- PONY tokens for payouts

### 2. Update Environment Variables
Copy `.env.example` to `.env` and configure:
```bash
# Required
TELEGRAM_BOT_TOKEN=your_bot_token
MONGODB_URI=your_mongodb_uri

# Optional (uses defaults from whitepaper)
BASE_RPC_URL=https://mainnet.base.org
PONY_TOKEN_ADDRESS=0x6ab297799335E7b0f60d9e05439Df156cf694Ba7
```

### 3. Install Dependencies
```bash
pnpm install
```

### 4. Database Migration (if needed)
If you have existing users with `solanaAddress`, you'll need to migrate them:
```javascript
// Run this in MongoDB or via migration script
db.users.updateMany(
  { solanaAddress: { $exists: true } },
  { $rename: { solanaAddress: "baseAddress" } }
)
```

### 5. Start the Bot
```bash
pnpm start
```

## Key Differences: Solana vs Base

| Feature | Solana | Base |
|---------|--------|------|
| Address Format | Base58 (44 chars) | Hex with 0x (42 chars) |
| Transaction Format | Signature (88 chars) | Hash with 0x (66 chars) |
| Explorer | solscan.io | basescan.org |
| Gas | SOL | ETH |
| Token Standard | SPL | ERC20 |
| Decimals | 6 (typically) | 18 (typically) |

## Testing Checklist

- [ ] Bot starts without errors
- [ ] User registration with Ethereum address works
- [ ] Address validation rejects invalid addresses
- [ ] Token transfers execute on Base
- [ ] Transaction links go to BaseScan
- [ ] Gas estimation works correctly
- [ ] Balance checking functions properly

## Security Notes

⚠️ **CRITICAL**:
- Never commit `wallet.json` to version control
- Never share your private key
- Use a dedicated wallet for the bot with limited funds
- Monitor the wallet balance regularly
- Consider using a hardware wallet or secure key management system for production

## Support

For issues related to:
- **Base network**: https://docs.base.org
- **ethers.js**: https://docs.ethers.org/v6/
- **PONY token**: Refer to WHITEPAPER_V1.md

## Next Steps

1. ✅ Fill in your private key in `wallet.json`
2. ✅ Fund the wallet with ETH (for gas) and PONY tokens (for payouts)
3. ✅ Test in a development environment first
4. ✅ Migrate existing user data if needed
5. ✅ Deploy to production

---

**Migration completed**: 2025-10-30
**Target Network**: Base Mainnet (Chain ID: 8453)
