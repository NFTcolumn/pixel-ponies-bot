import dotenv from 'dotenv';
import BaseService from '../src/services/BaseService.js';
import readline from 'readline';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function testTransfer() {
  try {
    console.log('🧪 Base Token Transfer Test\n');

    // Check bot wallet
    const botWallet = BaseService.getWalletAddress();
    if (!botWallet) {
      console.error('❌ Bot wallet not configured!');
      console.log('   Please ensure wallet.json exists or BASE_PRIVATE_KEY is set in .env');
      process.exit(1);
    }

    console.log(`✅ Bot Wallet: ${botWallet}`);
    console.log(`🪙 Token: ${process.env.PONY_TOKEN_ADDRESS || '0x6ab297799335E7b0f60d9e05439Df156cf694Ba7'}`);
    console.log(`🌐 Network: Base Mainnet\n`);

    rl.question('Enter recipient wallet address: ', async (recipientAddress) => {
      if (!BaseService.validateAddress(recipientAddress)) {
        console.error('❌ Invalid Ethereum address!');
        rl.close();
        process.exit(1);
      }

      rl.question('Enter amount to send (in PONY tokens): ', async (amountStr) => {
        const amount = parseInt(amountStr);
        if (isNaN(amount) || amount <= 0) {
          console.error('❌ Invalid amount!');
          rl.close();
          process.exit(1);
        }

        console.log(`\n📤 Attempting to send ${amount.toLocaleString()} $PONY to ${recipientAddress.slice(0, 10)}...`);
        console.log('⏳ Please wait...\n');

        try {
          const result = await BaseService.sendPony(recipientAddress, amount);

          if (result.success) {
            console.log('✅ Transfer successful!');
            console.log(`   Transaction Hash: ${result.hash}`);
            console.log(`   Amount: ${amount.toLocaleString()} $PONY`);
            console.log(`   View on BaseScan: https://basescan.org/tx/${result.hash}`);
          } else {
            console.error('❌ Transfer failed!');
            console.error(`   Error: ${result.error}`);
          }
        } catch (error) {
          console.error('❌ Transfer error:', error.message);
          console.error(error.stack);
        }

        rl.close();
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
    rl.close();
    process.exit(1);
  }
}

testTransfer();
