import { sha512_256 } from 'js-sha512';
import { indexerClient } from './_shared';
import algosdk from 'algosdk';
import { browser } from '$app/environment';

export type SwapTxn = {
	'close-rewards': number;
	'closing-amount': number;
	'confirmed-round': number;
	'created-application-index': number;
	fee: number;
	id: string;
	'intra-round-offset': number;
	'receiver-rewards': number;
	'round-time': number;
	sender: string;
	'sender-rewards': number;
	signature: { sig: string };
	'tx-type': string;
	logs?: string[];
};

interface CacheStructure {
	lastRound: number;
	txns: SwapTxn[];
}

export class SwapEvents {
	static async setCache(update: CacheStructure, appId: number, signature: string) {
		if (!browser) return;

		const key = `${appId}-${signature}`;
		localStorage.removeItem(key);

		const cached = await caches.open(key);
		await cached.put(`/${key}`, new Response(JSON.stringify(update)));
	}

	static async getCache(appId: number, signature: string): Promise<CacheStructure> {
		const defaultRet = { lastRound: 2000000, txns: [] };
		if (!browser) return defaultRet;

		const key = `${appId}-${signature}`;
		localStorage.removeItem(key);

		const cached = await caches.open(key);
		const resp = await cached.match(`/${key}`);
		if (resp) {
			try {
				const jsonResponse = await resp.json();
				if (jsonResponse?.txns) {
					return <CacheStructure>jsonResponse;
				}
			} catch (e) {
				/**/
			}
		}
		return defaultRet;
	}

	static async loadTxnsByEvent(appId: number, event: string) {
		const selector = sha512_256(event).slice(0, 8);
		const cache = await SwapEvents.getCache(appId, selector);
		const LIMIT = 1000;
		let next: string | undefined;

		do {
			let req = await indexerClient
				.searchForTransactions()
				.applicationID(appId)
				.minRound(cache.lastRound + 1);

			if (LIMIT) req = req.limit(LIMIT);
			if (next) req = req.nextToken(next);

			const resp = await req.do();

			if (resp['transactions'] instanceof Array) {
				const batch: SwapTxn[] = resp['transactions'];
				const filteredTxns = batch
					.filter((txn) => !cache.txns.find((cTxn) => cTxn.id === txn.id))
					.filter(
						(txn) =>
							txn.logs?.length &&
							txn.logs.find((log) => Buffer.from(log, 'base64').toString('hex').startsWith(selector))
					);
				cache.txns.push(...filteredTxns);
			}

			if (resp['transactions'].length < LIMIT) {
				next = undefined;
			} else {
				next = resp['next-token'];
			}
		} while (next);
		for (const txn of cache.txns) {
			if (typeof txn['confirmed-round'] === 'number') {
				cache.lastRound = Math.max(cache.lastRound, txn['confirmed-round']);
			}
		}

		cache.txns = cache.txns.filter((txn, i) => !cache.txns.find((cTxn, index) => cTxn.id === txn.id && i !== index));

		await SwapEvents.setCache(cache, appId, selector);

		return cache.txns.map((txn) => {
			const logs = (txn.logs ?? []).map((log) => Buffer.from(log, 'base64').toString('hex'));
			const filteredLogs = logs.filter((log) => log.startsWith(selector));
			try {
				const events = filteredLogs.map((log) => {
					const argsAbiType = algosdk.ABITupleType.from(event.replace(/^\w+/, ''));
					// console.log('decoded', argsAbiType.decode(Uint8Array.from(Buffer.from(log.slice(8), 'hex'))));
					try {
						return argsAbiType.decode(Uint8Array.from(Buffer.from(log.slice(8), 'hex')));
					} catch (e) {
						console.log(log);
						throw e;
					}
				});
				return { ...txn, events: { [event]: events } };
			} catch (error) {
				console.error((<Error>error).message);
			}
			return { ...txn, events: <Record<string, algosdk.ABIValue[]>>{} };
		});
	}
}
