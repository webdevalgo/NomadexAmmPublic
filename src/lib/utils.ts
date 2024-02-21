import algosdk from 'algosdk';
import Contract from 'arc200js';
import { indexerClient, nodeClient } from './_shared';
import { goto } from '$app/navigation';
import { writable } from 'svelte/store';

export class Arc200Interface {
	static async arc200_name(appId: number) {
		const contract = new Contract(appId, nodeClient, indexerClient);
		const response = await contract.arc200_name();
		if (response.success) {
			return response.returnValue;
		} else {
			throw Error('failed to fetch arc200 name');
		}
	}

	static async arc200_symbol(appId: number) {
		const contract = new Contract(appId, nodeClient, indexerClient);
		const response = await contract.arc200_symbol();
		if (response.success) {
			return response.returnValue;
		} else {
			throw Error('failed to fetch arc200 symbol');
		}
	}

	static async arc200_totalSupply(appId: number) {
		const contract = new Contract(appId, nodeClient, indexerClient);
		const response = await contract.arc200_totalSupply();
		if (response.success) {
			return response.returnValue;
		} else {
			throw Error('failed to fetch arc200 total supply');
		}
	}

	static async arc200_decimals(appId: number) {
		const contract = new Contract(appId, nodeClient, indexerClient);
		const response = await contract.arc200_decimals();
		if (response.success) {
			return response.returnValue;
		} else {
			throw Error('failed to fetch arc200 decimals');
		}
	}

	static async arc200_balanceOf(appId: number, owner: string) {
		const contract = new Contract(appId, nodeClient, indexerClient);
		const response = await contract.arc200_balanceOf(owner);
		if (response.success) {
			return response.returnValue;
		} else {
			throw Error('failed to fetch arc200 balance');
		}
	}

	static async arc200_transfer(appId: number, from: string, addrTo: string, amt: bigint) {
		const contract = new Contract(appId, nodeClient, indexerClient, {
			acc: { addr: from, sk: Uint8Array.from([]) },
			simulate: true,
		});
		const res: any = await contract.arc200_transfer(addrTo, amt, true, false);
		return <algosdk.Transaction[]>(
			res.txns?.map((txn) => algosdk.decodeUnsignedTransaction(Buffer.from(txn, 'base64'))).filter(Boolean)
		);
	}

	static async arc200_transferFrom(appId: number, from: string, addrFrom: string, addrTo: string, amt: bigint) {
		const contract = new Contract(appId, nodeClient, indexerClient, {
			acc: { addr: from, sk: Uint8Array.from([]) },
			simulate: true,
		});
		const res: any = await contract.arc200_transferFrom(addrFrom, addrTo, amt, true, false);
		return <algosdk.Transaction[]>(
			res.txns?.map((txn) => algosdk.decodeUnsignedTransaction(Buffer.from(txn, 'base64'))).filter(Boolean)
		);
	}

	static async arc200_approve(appId: number, from: string, addrTo: string, amt: bigint) {
		const contract = new Contract(appId, nodeClient, indexerClient, {
			acc: { addr: from, sk: Uint8Array.from([]) },
			simulate: true,
		});
		const res: any = await contract.arc200_approve(addrTo, amt, true, false);
		return <algosdk.Transaction[]>(
			res.txns?.map((txn) => algosdk.decodeUnsignedTransaction(Buffer.from(txn, 'base64'))).filter(Boolean)
		);
	}
}

export async function hardGoto(target: string) {
	goto(`/loading?from=${location.pathname}&at=${Date.now()}`, { replaceState: true });
	await new Promise((r) => setTimeout(r, 5));
	goto(target);
}

export const pageContentRefreshPending = writable(false);
export async function pageContentRefresh(ms = 1000) {
	pageContentRefreshPending.set(true);
	await new Promise((r) => setTimeout(r, ms));
	pageContentRefreshPending.set(false);
}

export function fillMissingSeconds(data: { time: number; value: number }[]): { time: number; value: number }[] {
	const filledData: { time: number; value: number }[] = [];

	for (let i = 0; i < data.length; i++) {
		filledData.push(data[i]);

		// Check if there is a missing hour
		if (i < data.length - 1 && data[i + 1].time - data[i].time > 1) {
			const missingHours = data[i + 1].time - data[i].time - 1;

			// Fill missing hours with the previous hour's value
			for (let j = 1; j <= missingHours; j++) {
				filledData.push({
					time: data[i].time + j,
					value: data[i].value,
				});
			}
		}
	}

	return filledData;
}

export function timeAgo(timestamp: number): string {
	const now = Date.now();
	const seconds = Math.floor((now - timestamp) / 1000);

	if (seconds < 60) {
		return `${seconds}sec${seconds !== 1 ? 's' : ''} ago`;
	} else if (seconds < 3600) {
		const minutes = Math.floor(seconds / 60);
		return `${minutes}min${minutes !== 1 ? 's' : ''} ago`;
	} else if (seconds < 86400) {
		const hours = Math.floor(seconds / 3600);
		return `${hours}hr${hours !== 1 ? 's' : ''} ago`;
	} else if (seconds < 2592000) {
		const days = Math.floor(seconds / 86400);
		return `${days}d${days !== 1 ? 's' : ''} ago`;
	} else if (seconds < 31536000) {
		const months = Math.floor(seconds / 2592000);
		return `${months}mon${months !== 1 ? 's' : ''} ago`;
	} else {
		const years = Math.floor(seconds / 31536000);
		return `${years}yr${years !== 1 ? 's' : ''} ago`;
	}
}
