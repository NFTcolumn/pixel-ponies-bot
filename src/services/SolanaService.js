import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, transfer } from '@solana/spl-token';
import bs58 from 'bs58';
import dotenv from 'dotenv';

dotenv.config();

class SolanaService {
  constructor() {
    this.connection = new Connection(process.env.SOLANA_RPC_URL);
    this.botWallet = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY));
    this.ponyMint = new PublicKey(process.env.PONY_TOKEN_MINT);
  }

  validateSolanaAddress(address) {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  async sendPony(recipientAddress, amount) {
    try {
      console.log(`\n🚀 === STARTING $PONY TRANSFER ===`);
      console.log(`💰 Amount: ${amount} $PONY`);
      console.log(`📍 Recipient: ${recipientAddress}`);
      console.log(`🤖 Bot wallet: ${this.botWallet.publicKey.toBase58()}`);
      console.log(`🪙 Token mint: ${this.ponyMint.toBase58()}`);
      
      const recipient = new PublicKey(recipientAddress);
      
      console.log(`\n🔍 Step 1: Getting bot token account...`);
      const botTokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.botWallet,
        this.ponyMint,
        this.botWallet.publicKey
      );
      console.log(`✅ Bot token account: ${botTokenAccount.address.toBase58()}`);
      
      console.log(`\n🔍 Step 2: Getting/creating recipient token account...`);
      console.log(`📝 This may create a new token account for the recipient...`);
      
      const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.botWallet, // Bot pays for account creation
        this.ponyMint,
        recipient,
        false, // allowOwnerOffCurve
        'confirmed', // commitment
        {}, // confirmOptions
        undefined, // TOKEN_PROGRAM_ID (default)
        undefined  // ASSOCIATED_TOKEN_PROGRAM_ID (default)
      );
      console.log(`✅ Recipient token account: ${recipientTokenAccount.address.toBase58()}`);
      
      const tokenAmount = amount * 1000000; // Convert to 6 decimals
      console.log(`\n🔍 Step 3: Transferring ${tokenAmount} tokens (${amount} $PONY)...`);
      
      // Send tokens
      const signature = await transfer(
        this.connection,
        this.botWallet,
        botTokenAccount.address,
        recipientTokenAccount.address,
        this.botWallet,
        tokenAmount
      );

      console.log(`✅ Transfer successful!`);
      console.log(`🔗 Transaction signature: ${signature}`);
      console.log(`🌐 View on explorer: https://solscan.io/tx/${signature}`);
      console.log(`🏁 === TRANSFER COMPLETE ===\n`);
      
      return { success: true, signature };
      
    } catch (error) {
      console.error(`\n❌ === TRANSFER FAILED ===`);
      console.error(`Error type: ${error.constructor.name}`);
      console.error(`Error message: ${error.message}`);
      console.error(`Full error:`, error);
      console.error(`🏁 === ERROR END ===\n`);
      
      return { success: false, error: error.message };
    }
  }
}

export default new SolanaService();