import { ethers } from 'ethers';
import fs from 'fs';

// Generate a new random wallet
const wallet = ethers.Wallet.createRandom();

console.log('\n🔐 New Base Wallet Generated!\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📍 Address:', wallet.address);
console.log('🔑 Private Key:', wallet.privateKey);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('⚠️  IMPORTANT - SAVE THIS INFORMATION:');
console.log('   - This wallet will be used for your bot');
console.log('   - Save the private key in a secure location');
console.log('   - Never share your private key with anyone');
console.log('   - You need to fund this wallet with ETH and PONY tokens\n');

// Create wallet.json content
const walletData = {
  address: wallet.address,
  privateKey: wallet.privateKey,
  network: 'base-mainnet',
  chainId: 8453,
  note: 'NEVER commit to git. NEVER share. Bot wallet for Pixel Ponies.',
  created: new Date().toISOString()
};

// Write to wallet.json
fs.writeFileSync('wallet.json', JSON.stringify(walletData, null, 2));

console.log('✅ Wallet saved to wallet.json\n');
console.log('📋 FUNDING INSTRUCTIONS:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`1. Send ETH (Base network) to: ${wallet.address}`);
console.log('   - Recommended: 0.01-0.05 ETH for gas fees');
console.log('   - Gas on Base is very cheap (~$0.01 per transaction)');
console.log('');
console.log(`2. Send PONY tokens to: ${wallet.address}`);
console.log('   - Token Address: 0x6ab297799335E7b0f60d9e05439Df156cf694Ba7');
console.log('   - Amount depends on your expected payouts');
console.log('   - Recommended: Start with 100,000+ PONY for testing');
console.log('');
console.log('3. You can check your balance at:');
console.log(`   https://basescan.org/address/${wallet.address}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('🚀 Once funded, you can start the bot with: pnpm start\n');
