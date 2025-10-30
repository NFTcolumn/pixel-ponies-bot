import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// ERC20 ABI for token transfers
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
];

class BaseService {
  constructor() {
    // Base Mainnet RPC
    this.provider = new ethers.JsonRpcProvider(
      process.env.BASE_RPC_URL || 'https://mainnet.base.org'
    );

    // Load wallet from wallet.json file
    const walletPath = path.join(__dirname, '../../wallet.json');
    if (fs.existsSync(walletPath)) {
      const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
      this.botWallet = new ethers.Wallet(walletData.privateKey, this.provider);
    } else {
      console.error('❌ wallet.json not found! Please create it with your private key.');
      // Fallback to env variable if wallet.json doesn't exist
      if (process.env.BASE_PRIVATE_KEY) {
        this.botWallet = new ethers.Wallet(process.env.BASE_PRIVATE_KEY, this.provider);
      }
    }

    // PONY Token contract address from whitepaper
    this.ponyTokenAddress = process.env.PONY_TOKEN_ADDRESS ||
                           '0x6ab297799335E7b0f60d9e05439Df156cf694Ba7';

    // Create token contract instance
    if (this.botWallet) {
      this.ponyToken = new ethers.Contract(
        this.ponyTokenAddress,
        ERC20_ABI,
        this.botWallet
      );
    }
  }

  /**
   * Validate Ethereum address
   * @param {string} address - Address to validate
   * @returns {boolean} - True if valid
   */
  validateAddress(address) {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * Get PONY token balance for an address
   * @param {string} address - Address to check balance
   * @returns {Promise<string>} - Balance in PONY tokens
   */
  async getBalance(address) {
    try {
      if (!this.validateAddress(address)) {
        throw new Error('Invalid Ethereum address');
      }

      const balance = await this.ponyToken.balanceOf(address);
      const decimals = await this.ponyToken.decimals();

      // Convert from wei to human-readable format
      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      console.error('Error getting balance:', error);
      throw error;
    }
  }

  /**
   * Send PONY tokens to a recipient
   * @param {string} recipientAddress - Recipient's Ethereum address
   * @param {number} amount - Amount of PONY tokens to send
   * @returns {Promise<Object>} - Transaction result
   */
  async sendPony(recipientAddress, amount) {
    try {
      console.log(`\n🚀 === STARTING $PONY TRANSFER ===`);
      console.log(`💰 Amount: ${amount} $PONY`);
      console.log(`📍 Recipient: ${recipientAddress}`);
      console.log(`🤖 Bot wallet: ${this.botWallet.address}`);
      console.log(`🪙 Token contract: ${this.ponyTokenAddress}`);

      // Validate recipient address
      if (!this.validateAddress(recipientAddress)) {
        throw new Error('Invalid recipient address');
      }

      console.log(`\n🔍 Step 1: Getting token decimals...`);
      const decimals = await this.ponyToken.decimals();
      console.log(`✅ Token decimals: ${decimals}`);

      console.log(`\n🔍 Step 2: Checking bot balance...`);
      const balance = await this.ponyToken.balanceOf(this.botWallet.address);
      const balanceFormatted = ethers.formatUnits(balance, decimals);
      console.log(`✅ Bot balance: ${balanceFormatted} PONY`);

      // Convert amount to token units
      const tokenAmount = ethers.parseUnits(amount.toString(), decimals);
      console.log(`📊 Token amount (with decimals): ${tokenAmount.toString()}`);

      // Check if bot has enough balance
      if (balance < tokenAmount) {
        throw new Error(`Insufficient balance. Need ${amount} PONY, have ${balanceFormatted} PONY`);
      }

      console.log(`\n🔍 Step 3: Estimating gas...`);
      const gasEstimate = await this.ponyToken.transfer.estimateGas(
        recipientAddress,
        tokenAmount
      );
      console.log(`✅ Estimated gas: ${gasEstimate.toString()}`);

      console.log(`\n🔍 Step 4: Sending transaction...`);
      // Send the transaction with gas limit
      const tx = await this.ponyToken.transfer(
        recipientAddress,
        tokenAmount,
        {
          gasLimit: gasEstimate * 120n / 100n // Add 20% buffer
        }
      );

      console.log(`⏳ Transaction sent, waiting for confirmation...`);
      console.log(`🔗 Transaction hash: ${tx.hash}`);

      // Wait for transaction to be mined
      const receipt = await tx.wait();

      console.log(`✅ Transfer successful!`);
      console.log(`✅ Block number: ${receipt.blockNumber}`);
      console.log(`✅ Gas used: ${receipt.gasUsed.toString()}`);
      console.log(`🌐 View on BaseScan: https://basescan.org/tx/${tx.hash}`);
      console.log(`🏁 === TRANSFER COMPLETE ===\n`);

      return {
        success: true,
        hash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };

    } catch (error) {
      console.error(`\n❌ === TRANSFER FAILED ===`);
      console.error(`Error type: ${error.constructor.name}`);
      console.error(`Error message: ${error.message}`);

      if (error.code) {
        console.error(`Error code: ${error.code}`);
      }

      console.error(`Full error:`, error);
      console.error(`🏁 === ERROR END ===\n`);

      return { success: false, error: error.message };
    }
  }

  /**
   * Get bot wallet address
   * @returns {string} - Bot wallet address
   */
  getWalletAddress() {
    return this.botWallet?.address || null;
  }

  /**
   * Get current gas price on Base
   * @returns {Promise<string>} - Gas price in Gwei
   */
  async getGasPrice() {
    try {
      const feeData = await this.provider.getFeeData();
      return ethers.formatUnits(feeData.gasPrice || 0n, 'gwei');
    } catch (error) {
      console.error('Error getting gas price:', error);
      throw error;
    }
  }

  /**
   * Get network information
   * @returns {Promise<Object>} - Network info
   */
  async getNetworkInfo() {
    try {
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      const gasPrice = await this.getGasPrice();

      return {
        chainId: network.chainId.toString(),
        name: network.name,
        blockNumber,
        gasPrice: `${gasPrice} Gwei`
      };
    } catch (error) {
      console.error('Error getting network info:', error);
      throw error;
    }
  }
}

export default new BaseService();
