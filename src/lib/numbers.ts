export function powerOfTen(decimals: number | bigint): bigint {
	let result = 1n;

	for (let i = 0; i < Number(decimals); i = i + 1) {
		result = result * 10n;
	}

	return result;
}

export function convertDecimals(amount: bigint | number, decimals: bigint | number, targetDecimals: bigint | number) {
	return (BigInt(amount) * powerOfTen(targetDecimals)) / powerOfTen(decimals);
}
