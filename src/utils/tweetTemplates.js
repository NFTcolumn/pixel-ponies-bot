/**
 * Tweet Templates for Pixel Ponies
 */

export const REGISTRATION_TWEET_TEMPLATE = `I just registered to race on #PixelPonies and got 10B $PONY. Join @pxponies telegram and register to get yours NOW!

TG: https://t.me/pixelponies

Website: pxponies.com

Get $PONY: https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x6ab297799335E7b0f60d9e05439Df156cf694Ba7&chain=base

Token CA: https://basescan.org/address/0x6ab297799335E7b0f60d9e05439Df156cf694Ba7

Game CA: https://basescan.org/address/0x2B4652Bd6149E407E3F57190E25cdBa1FC9d37d8`;

export const RACE_TWEET_TEMPLATE = (horseNumber, amount) => `I just bet ${amount} $PONY that horse #${horseNumber} would win on @PixelPonies

TG: https://t.me/pixelponies

Website: pxponies.com

Get $PONY: https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x6ab297799335E7b0f60d9e05439Df156cf694Ba7&chain=base

Token CA: https://basescan.org/address/0x6ab297799335E7b0f60d9e05439Df156cf694Ba7

Game CA: https://basescan.org/address/0x2B4652Bd6149E407E3F57190E25cdBa1FC9d37d8`;

// Format large numbers for display
export function formatPonyAmount(amount) {
  if (amount >= 1000000000) {
    return `${(amount / 1000000000).toLocaleString()}B`;
  } else if (amount >= 1000000) {
    return `${(amount / 1000000).toLocaleString()}M`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toLocaleString()}K`;
  }
  return amount.toLocaleString();
}

// Reward amounts
export const REWARDS = {
  SIGNUP: 10000000000,   // 10B $PONY
  PER_RACE: 100000000,   // 100M $PONY
  REFERRAL: 250000000    // 250M $PONY
};

// Links
export const LINKS = {
  TELEGRAM: 'https://t.me/pixelponies',
  TWITTER: 'https://x.com/pxponies',
  WEBSITE: 'pxponies.com',
  TOKEN_CA: 'https://basescan.org/address/0x6ab297799335E7b0f60d9e05439Df156cf694Ba7',
  GAME_CA: 'https://basescan.org/address/0x2B4652Bd6149E407E3F57190E25cdBa1FC9d37d8'
};
