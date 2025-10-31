import dotenv from 'dotenv';
import BaseService from '../src/services/BaseService.js';

dotenv.config();

async function quickTransfer() {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.log('Usage: node scripts/quickTransfer.js <recipient_address> <amount>');
    console.log('Example: node scripts/quickTransfer.js 0x1234... 1000000000');
    process.exit(1);
  }

  const recipientAddress = args[0];
  const amount = parseInt(args[1]);

  if (!BaseService.validateAddress(recipientAddress)) {
    console.error('❌ Invalid Ethereum address!');
    process.exit(1);
  }

  if (isNaN(amount) || amount <= 0) {
    console.error('❌ Invalid amount!');
    process.exit(1);
  }

  console.log('🚀 Sending test transfer...');
  console.log(`📤 To: ${recipientAddress}`);
  console.log(`💰 Amount: ${amount.toLocaleString()} $PONY\n`);

  try {
    const result = await BaseService.sendPony(recipientAddress, amount);

    if (result.success) {
      console.log('✅ Transfer successful!');
      console.log(`🔗 Transaction: ${result.hash}`);
      console.log(`🌐 View on BaseScan: https://basescan.org/tx/${result.hash}`);
    } else {
      console.error('❌ Transfer failed!');
      console.error(`   Error: ${result.error}`);
    }
  } catch (error) {
    console.error('❌ Transfer error:', error.message);
  }

  process.exit(0);
}

quickTransfer();
