const SCALE = 100_000_000_000_000n;

export function calculateOutTokens(inAmount: bigint, inSupply: bigint, outSupply: bigint, fee: bigint) {
	const factor = SCALE - fee;
	return (inAmount * outSupply * factor) / ((inAmount + inSupply) * SCALE);
}

export function calculateInTokens(outAmount: bigint, inSupply: bigint, outSupply: bigint, fee: bigint) {
	const factor = SCALE - fee;
	const inAmount = (SCALE * inSupply * outAmount) / (outSupply * factor - outAmount * SCALE);
	if (inAmount > 0n) {
		return inAmount;
	}
	return BigInt(Number.MAX_SAFE_INTEGER) * BigInt(Number.MAX_SAFE_INTEGER);
}
