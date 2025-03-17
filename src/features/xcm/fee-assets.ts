import { DenominatedNumber } from "@reactive-dot/utils";

// Define fee asset configuration
export interface FeeAsset {
  id: number;
  symbol: string;
  decimals: number;
  minFeeAmount: bigint;
}

// Define supported fee assets with their configurations
export const FEE_ASSETS: Record<string, FeeAsset> = {
  USDT: {
    id: 2,
    symbol: "USDT",
    decimals: 6,
    minFeeAmount: BigInt("100000"), // 0.1 USDT
  },
  USDC: {
    id: 1,
    symbol: "USDC",
    decimals: 6,
    minFeeAmount: BigInt("100000"), // 0.1 USDC
  },
} as const;

// Helper to check if an asset can be used for fee payment
export function canPayFees(assetId: number): boolean {
  return Object.values(FEE_ASSETS).some((asset) => asset.id === assetId);
}

// Helper to check if an asset needs fee payment for bridging
export function needsFeePayment(assetId: number): boolean {
  if (assetId === 3) {
    return false;
  }
  return !canPayFees(assetId);
}

// Get fee asset by ID
export function getFeeAsset(assetId: number): FeeAsset | undefined {
  return Object.values(FEE_ASSETS).find((asset) => asset.id === assetId);
}

// Calculate fee amount for a given fee asset
export function calculateFeeAmount(feeAssetId: number): bigint {
  const feeAsset = getFeeAsset(feeAssetId);
  if (!feeAsset) {
    throw new Error(`Invalid fee asset ID: ${feeAssetId}`);
  }
  return feeAsset.minFeeAmount;
}

// Validate if an account has sufficient fee balance
export function validateFeeBalance(
  feeAssetId: number,
  balance: bigint,
): { isValid: boolean; error?: string } {
  const feeAsset = getFeeAsset(feeAssetId);
  if (!feeAsset) {
    return {
      isValid: false,
      error: `Invalid fee asset ID: ${feeAssetId}`,
    };
  }

  if (balance < feeAsset.minFeeAmount) {
    const required = new DenominatedNumber(
      feeAsset.minFeeAmount,
      feeAsset.decimals,
    ).toLocaleString();

    return {
      isValid: false,
      error: `Insufficient fee balance. Required: ${required} ${feeAsset.symbol}`,
    };
  }

  return { isValid: true };
}

// Get available fee assets based on balances
export function getAvailableFeeAssets(
  balances: Record<number, bigint>,
): FeeAsset[] {
  return Object.values(FEE_ASSETS).filter((asset) => {
    const balance = balances[asset.id] || 0n;
    return balance >= asset.minFeeAmount;
  });
}
