import { writable } from 'svelte/store';
import { getCollection, putDoc } from './firebase';

export enum TokenType {
	Default = '',
	ASA = 'asa',
	ARC200 = 'arc200',
}

export type Token = {
	ticker: string;
	id: number;
	type: TokenType;
	decimals: number;
	unit: number;
};

export type Pool = {
	poolId: number;
	lptId: number;
	arc200Asset: {
		assetId: number;
		symbol: string;
		decimals: number;
		unit: number;
	};
	swapFee: number;
};

export const knownPools = writable<Pool[]>([]);
[
	// 26179950
	// {
	//     poolId: 26179950,
	//     lptId: 26179950,
	//     arc200Asset: {
	//         assetId: 6779767,
	//         symbol: 'VIA',
	//         unit: 1e6
	//     },
	//     swapFee: 1_000_000,
	// }
	// {
	//     poolId: 24589652,
	//     lptId: 24589656,
	//     arc200Asset: {
	//         assetId: 6779767,
	//         symbol: 'VIA',
	//         unit: 1e6
	//     },
	//     swapFee: 1_000_000,
	// },
	// {
	//     poolId: 25351179,
	//     lptId: 25351184,
	//     arc200Asset: {
	//         assetId: 6778021,
	//         symbol: 'VRC200',
	//         unit: 1e8
	//     },
	//     swapFee: 2_500_000,
	// },
	// {
	//     poolId: 26167314,
	//     lptId: 26167319,
	//     arc200Asset: {
	//         assetId: 6795477,
	//         symbol: 'Tacos',
	//         unit: 1
	//     },
	//     swapFee: 2_500_000
	// }
];

export const knownTokens = writable<Token[]>([
	{ ticker: 'VOI', id: 0, type: TokenType.Default, decimals: 6, unit: 1e6 },
	// { ticker: 'VIA', id: 6779767, type: TokenType.ARC200, decimals: 6, unit: 1e6 },
	// { ticker: 'VRC200', id: 6778021, type: TokenType.ARC200, decimals: 8, unit: 1e8 },
	// { ticker: 'Tacos', id: 6795477, type: TokenType.ARC200, decimals: 0, unit: 1 },
	// { ticker: 'TEST', id: 26178395, type: TokenType.ARC200, decimals: 6, unit: 1e6 }
]);

export const arePoolsLoaded = writable(false);

export const contracts = {
	orderbookLimitOrderApp: 26171479,
};

export const contractsConstants = {
	orderbookLimitOrderAppFeePercent: 1,
};

const network = 'voitest-v1';
const version = 'v02';

export async function getListOfArc200Tokens() {
	const tokensSnap = await getCollection(`/networks/${network}/versions/${version}/arc200tokens`);
	const tokens = tokensSnap.docs.map((doc) => {
		const data = doc.data();
		return {
			id: data.id,
			symbol: doc.id,
			decimals: data.decimals,
		};
	});
	const validTokens: Token[] = tokens
		.filter((token) => 0 <= token.decimals && token.decimals <= 18)
		.map((token) => ({
			id: token.id,
			ticker: token.symbol,
			type: TokenType.ARC200,
			decimals: token.decimals,
			unit: 10 ** token.decimals,
		}));

	console.log('Tokens:', validTokens);

	const poolsSnap = await getCollection(`/networks/${network}/versions/${version}/voiarc200pools`);

	const pools = poolsSnap.docs.map((doc) => {
		const data = doc.data();
		return {
			id: data.id,
			arc200Asset: <Token>validTokens.find((token) => token.id === data.arc200Id),
		};
	});
	const validPools: Pool[] = pools
		.filter((pool) => pool.arc200Asset)
		.map((token) => ({
			lptId: token.id,
			poolId: token.id,
			swapFee: 1_000_000_000_000,
			arc200Asset: {
				assetId: token.arc200Asset.id,
				symbol: token.arc200Asset.ticker,
				unit: token.arc200Asset.unit,
				decimals: token.arc200Asset.decimals,
			},
		}));

	console.log('Pools:', validPools);

	knownPools.update((pools) => pools.slice(0, 0).concat(validPools.sort((a, b) => a.poolId - b.poolId)));
	knownTokens.update((toks) => toks.slice(0, 1).concat(validTokens.sort((a, b) => a.id - b.id)));

	arePoolsLoaded.set(true);
}

export async function saveArc200TokenToList(symbol: string, id: number, decimals: number) {
	if (typeof symbol !== 'string' || typeof id !== 'number' || typeof decimals !== 'number') {
		throw Error('Bad arc200 token args, cannot add arc200 to the list');
	}
	await putDoc(`/networks/${network}/versions/${version}/arc200tokens/${symbol}`, { id, decimals });
	await getListOfArc200Tokens();
}

export async function saveVoiArc200PoolToList(symbol: string, poolId: number, arc200Id: number) {
	if (typeof symbol !== 'string' || typeof poolId !== 'number' || typeof arc200Id !== 'number') {
		throw Error('Bad voi-arc200 pool args, cannot add pool to the list');
	}
	await putDoc(`/networks/${network}/versions/${version}/voiarc200pools/VOI-${symbol}`, {
		id: poolId,
		arc200Id: arc200Id,
	});
	await getListOfArc200Tokens();
}
