import { nodeClient } from '$lib/_shared';
import { readable, writable } from 'svelte/store';
import { Arc200Interface } from '$lib/utils';

type AppState = {
	appId: number;
	state: Record<string, any>;
};

export type AccountState = {
	address: string;
	amount: number;
	'amount-without-pending-rewards'?: number;
	'apps-local-state'?: [];
	'apps-total-schema'?: {
		'num-byte-slice': number;
		'num-uint': number;
	};
	assets?: {
		amount: number;
		'asset-id': number;
		'is-frozen': boolean;
	}[];
	'created-apps'?: Record<string, any>[];
	'created-assets'?: Record<string, any>[];
	'min-balance'?: number;
	participation?: {
		'selection-participation-key': string;
		'state-proof-key': string;
		'vote-first-valid': number;
		'vote-key-dilution': number;
		'vote-last-valid': number;
		'vote-participation-key': string;
	};
	'pending-rewards'?: number;
	'reward-base'?: number;
	rewards?: number;
	round?: number;
	status?: string;
	'total-apps-opted-in'?: number;
	'total-assets-opted-in'?: number;
	'total-created-apps'?: number;
	'total-created-assets'?: number;
	asaBalances: Record<string, number>;
	lastUpdateAt: number;
};

export class OnChainStateWatcher {
	readonly ms: number;
	readonly appStateMap = new Map<number, ReturnType<typeof writable<AppState>>>();
	readonly accountMap = new Map<string, ReturnType<typeof writable<AccountState>>>();
	interval: NodeJS.Timeout | undefined;

	constructor(ms: number) {
		this.ms = ms;
		this.listen();
	}

	destroy() {
		clearInterval(this.interval);
	}

	static async getAppState(appId) {
		return await nodeClient.getApplicationByID(appId).do();
	}

	static async getAccountState(address: string) {
		return await nodeClient.accountInformation(address).do();
	}

	listen() {
		clearInterval(this.interval);
		this.interval = setInterval(() => this.update(), this.ms);
		setTimeout(() => this.update(), 0);
	}

	async update() {
		for (const [appId, store] of this.appStateMap.entries()) {
			try {
				store.set(<AppState>await OnChainStateWatcher.getAppState(appId));
			} catch (error) {
				console.error(`Error white fetching app state (${appId})\n${(<Error>error).message}`);
			}
		}

		for (const [address, store] of this.accountMap.entries()) {
			try {
				const accountState = <AccountState>await OnChainStateWatcher.getAccountState(address);

				store.set({
					...accountState,
					lastUpdateAt: Date.now(),
					asaBalances: Object.fromEntries(
						(accountState.assets ?? []).map((asset) => [asset['asset-id'], asset.amount])
					),
				});
			} catch (error) {
				console.error(`Error white fetching account state (${address})\n${(<Error>error).message}`);
			}
		}
	}

	getAppStateWatcher(appId: number) {
		const store =
			this.appStateMap.get(appId) ??
			writable<AppState>({
				appId: appId,
				state: {},
			});
		this.appStateMap.set(appId, store);

		this.listen();

		return store;
	}

	getAccountWatcher(address: string) {
		const store =
			this.accountMap.get(address) ??
			writable<AccountState>({
				address,
				amount: 0,
				asaBalances: {},
				lastUpdateAt: 0,
			});
		this.accountMap.set(address, store);

		this.listen();

		return store;
	}
}

export const onChainStateWatcher = new OnChainStateWatcher(10_000);

export function watchArc200Balance(
	appId: number,
	address: string,
	duration = 15_000
): ReturnType<typeof readable<bigint>> {
	const store = writable<bigint>();

	const update = async () => {
		try {
			const balance = await Arc200Interface.arc200_balanceOf(appId, address);
			if (typeof balance === 'bigint') {
				store.set(balance);
			}
		} catch (er) {
			//
			// console.error(er)
		}
	};

	update();
	const interval = setInterval(update, duration);

	return {
		subscribe(run) {
			const unsub = store.subscribe(run);
			return () => {
				clearInterval(interval);
				unsub();
			};
		},
	};
}

export function watchPoolTotalSupply(appId: number, duration = 15_000): ReturnType<typeof readable<bigint>> {
	const store = writable<bigint>();

	const update = async () => {
		try {
			const supply = await Arc200Interface.arc200_totalSupply(appId);
			if (typeof supply === 'bigint') {
				store.set(supply);
			}
		} catch (er) {
			//
			console.error(er);
		}
	};

	update();
	const interval = setInterval(update, duration);

	return {
		subscribe(run) {
			const unsub = store.subscribe(run);
			return () => {
				clearInterval(interval);
				unsub();
			};
		},
	};
}
