import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
];

async function checkBalance() {
  try {
    console.log('🔍 Checking Bot Wallet Balance\n');

    // Get provider
    const provider = new ethers.JsonRpcProvider(
      process.env.BASE_RPC_URL || 'https://mainnet.base.org'
    );

    // Get wallet
    const walletPath = path.join(__dirname, '../wallet.json');
    let botWallet;

    if (fs.existsSync(walletPath)) {
      const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
      botWallet = new ethers.Wallet(walletData.privateKey, provider);
    } else if (process.env.BASE_PRIVATE_KEY) {
      botWallet = new ethers.Wallet(process.env.BASE_PRIVATE_KEY, provider);
    } else {
      console.error('❌ No wallet configured!');
      process.exit(1);
    }

    console.log(`💼 Bot Wallet: ${botWallet.address}`);

    // Get ETH balance
    const ethBalance = await provider.getBalance(botWallet.address);
    const ethBalanceFormatted = ethers.formatEther(ethBalance);
    console.log(`⛽ ETH Balance: ${parseFloat(ethBalanceFormatted).toFixed(6)} ETH`);

    // Get PONY token balance
    const ponyTokenAddress = process.env.PONY_TOKEN_ADDRESS || '0x6ab297799335E7b0f60d9e05439Df156cf694Ba7';
    const ponyToken = new ethers.Contract(ponyTokenAddress, ERC20_ABI, provider);

    const tokenName = await ponyToken.name();
    const tokenSymbol = await ponyToken.symbol();
    const tokenDecimals = await ponyToken.decimals();
    const tokenBalance = await ponyToken.balanceOf(botWallet.address);

    const tokenBalanceFormatted = ethers.formatUnits(tokenBalance, tokenDecimals);

    console.log(`\n🪙 Token: ${tokenName} (${tokenSymbol})`);
    console.log(`📍 Contract: ${ponyTokenAddress}`);
    console.log(`💰 Balance: ${parseFloat(tokenBalanceFormatted).toLocaleString()} ${tokenSymbol}`);
    console.log(`🔢 Raw Balance: ${tokenBalance.toString()}`);

    // Calculate how many rewards can be paid
    const signupBonus = 1000000000; // 1B
    const raceReward = 100000000; // 100M
    const referralReward = 250000000; // 250M

    const totalBalance = parseFloat(tokenBalanceFormatted);
    const signupsAvailable = Math.floor(totalBalance / signupBonus);
    const racesAvailable = Math.floor(totalBalance / raceReward);

    console.log(`\n📊 Rewards Available:`);
    console.log(`   🎁 Signup bonuses (1B each): ${signupsAvailable.toLocaleString()}`);
    console.log(`   🏇 Race rewards (100M each): ${racesAvailable.toLocaleString()}`);
    console.log(`   👥 Referral rewards (250M each): ${Math.floor(totalBalance / referralReward).toLocaleString()}`);

    if (parseFloat(ethBalanceFormatted) < 0.001) {
      console.log(`\n⚠️  WARNING: Low ETH balance! You need ETH for gas fees to send tokens.`);
      console.log(`   Current: ${parseFloat(ethBalanceFormatted).toFixed(6)} ETH`);
      console.log(`   Recommended: At least 0.01 ETH for gas fees`);
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Error checking balance:', error.message);
    process.exit(1);
  }
}

checkBalance();
