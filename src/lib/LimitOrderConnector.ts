import { getTransactionSignerAccount, signAndSendTransections } from './UseWallet.svelte';
import { getBoxName, getUnnamedResourcesAccessed, nodeClient } from './_shared';
import { addNotification } from './Notify.svelte';
import { LimitOrders001Client } from '../contracts/clients/LimitOrders001Client';
import algosdk from 'algosdk';
import { makePaymentTxnWithSuggestedParamsFromObject } from 'algosdk';
import { Arc200Interface } from './utils';

// const ADMIN = 'DYX2V5XF4IKOHE55Z63XAHVBJTMYM723HK5WJZ72BDZ5AFEFKJ5YP4DOQQ';

// const SCALE = 100_000_000_000_000;
// const MIN_BALANCE = 1_000_000;

export enum LimitOrderType {
	SELL_ALGO_FOR_ARC200,
	SELL_ARC200_FOR_ALGO,
}

export class LimitOrders001ClientConnector extends LimitOrders001Client {
	appId = 0;
	readonly algodClient: algosdk.Algodv2;
	readonly signer: ReturnType<typeof getTransactionSignerAccount>;

	constructor(appId: number, signer = getTransactionSignerAccount()) {
		super({ id: appId, resolveBy: 'id', sender: signer }, nodeClient);

		this.algodClient = nodeClient;
		this.appId = appId;
		this.signer = signer;
	}

	async updatePool() {
		await this.update.updateApplication({});
	}

	async getUnnamedResourcesAccessedFromMethod<C extends LimitOrders001ClientConnector>(
		methodName: keyof ReturnType<C['compose']>,
		args: any = {}
	) {
		const cl: any = new LimitOrders001Client(
			{
				id: this.appId,
				resolveBy: 'id',
				sender: this.signer,
			},
			nodeClient
		);

		const composer = await cl.compose()[methodName](args, {}).atc();
		const txns = composer.buildGroup().map(({ txn }) => txn);

		return getUnnamedResourcesAccessed(txns);
	}

	async createOrder(orderType: LimitOrderType, arc200Id: number, algoAmount: bigint, arc200Amount: bigint) {
		if (!this.appId) throw Error('appId not set');

		const params = await nodeClient.getTransactionParams().do();

		const globalState = await this.getGlobalState();

		const orderId = globalState.order_counter?.asNumber();
		if (typeof orderId !== 'number') throw Error(`Could not get order id:`);

		if (orderType === LimitOrderType.SELL_ALGO_FOR_ARC200) {
			const args = () => ({
				algoPayTxn: makePaymentTxnWithSuggestedParamsFromObject({
					from: this.signer.addr,
					to: algosdk.getApplicationAddress(this.appId),
					amount: algoAmount,
					suggestedParams: params,
				}),
				arc200Id: arc200Id,
				arc200Amount: arc200Amount,
			});

			const resources = await this.getUnnamedResourcesAccessedFromMethod('createAlgoSellOrder', args());
			await this.createAlgoSellOrder(args(), {
				accounts: [...resources.accounts],
				boxes: [
					...resources.boxes,
					{ appIndex: this.appId, name: algosdk.encodeUint64(orderId) },
					{ appIndex: this.appId, name: algosdk.encodeUint64(orderId + 1) },
					{ appIndex: this.appId, name: algosdk.encodeUint64(orderId + 2) },
				],
				apps: [...resources.apps],
			});
		} else if (orderType === LimitOrderType.SELL_ARC200_FOR_ALGO) {
			const args = () => ({
				arc200AppId: arc200Id,
				algoAmount: algoAmount,
				arc200Amount: arc200Amount,
			});

			const contractBalance = await Arc200Interface.arc200_balanceOf(
				arc200Id,
				algosdk.getApplicationAddress(this.appId),
			);

			const optinTxns: algosdk.Transaction[] = [];
			if (contractBalance < 1n) {
				const txns = await Arc200Interface.arc200_transfer(
					arc200Id,
					this.signer.addr,
					algosdk.getApplicationAddress(this.appId),
					1n
				);
				optinTxns.push(...txns);
			}

			const arc200ApproveTxns = await Arc200Interface.arc200_approve(
				arc200Id,
				this.signer.addr,
				algosdk.getApplicationAddress(this.appId),
				arc200Amount
			);

			const resources = await this.getUnnamedResourcesAccessedFromMethod('createAlgoBuyOrder', args());

			const composer = await this.compose();

			for (const txn of [...optinTxns, ...arc200ApproveTxns]) {
				txn.group = undefined;
				composer.addTransaction({
					txn: txn,
					signer: this.signer.signer
				});
			}

			composer.createAlgoBuyOrder(args(), {
				accounts: [...resources.accounts],
				boxes: [
					...resources.boxes,
					{ appIndex: this.appId, name: algosdk.encodeUint64(orderId) },
					{ appIndex: this.appId, name: algosdk.encodeUint64(orderId + 1) },
					{
						appId: arc200Id,
						name: getBoxName(algosdk.getApplicationAddress(this.appId)),
					},
				],
				apps: [...resources.apps],
			});

			const atc = await composer.atc();

			const txns = atc.buildGroup().map((txn) => txn.txn);

			await signAndSendTransections(nodeClient, [txns]);
		}
	}

	async fillOrder(orderType: LimitOrderType, orderId: number, maker: string, arc200Id: number, amount: bigint) {
		if (orderType === LimitOrderType.SELL_ALGO_FOR_ARC200) {
			const approveTxns = await Arc200Interface.arc200_approve(
				arc200Id,
				this.signer.addr,
				algosdk.getApplicationAddress(this.appId),
				amount
			);
			const args = () => ({
				orderId: orderId,
				arc200Amount: amount,
			});

			const composer = await this.compose();

			for (const txn of [...approveTxns]) {
				txn.group = undefined;
				composer.addTransaction({
					txn: txn,
					signer: this.signer.signer
				});
			}

			const resources = await this.getUnnamedResourcesAccessedFromMethod('fillAlgoToArc200Order', args());
			const atc = await composer
				.fillAlgoToArc200Order(
					{
						orderId: orderId,
						arc200Amount: amount,
					},
					{
						...resources,
						boxes: [
							...resources.boxes,
							{
								appIndex: arc200Id,
								name: getBoxName(this.signer.addr),
							},
							{
								appIndex: arc200Id,
								name: getBoxName(maker),
							},
						],
					}
				)
				.atc();
			await signAndSendTransections(nodeClient, [atc.buildGroup().map((t) => t.txn)]);
		} else if (orderType === LimitOrderType.SELL_ARC200_FOR_ALGO) {
			const suggestedParams = await nodeClient.getTransactionParams().do();

			const args = () => ({
				orderId: orderId,
				algoPayTxn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
					from: this.signer.addr,
					to: algosdk.getApplicationAddress(this.appId),
					amount: amount,
					suggestedParams: suggestedParams,
				}),
			});
			const resources = await this.getUnnamedResourcesAccessedFromMethod('fillArc200ToAlgoOrder', args());

			const atc = await this.compose()
				.fillArc200ToAlgoOrder(args(), {
					...resources,
				})
				.atc();
			await signAndSendTransections(nodeClient, [atc.buildGroup().map((t) => t.txn)]);
		} else {
			console.error('unknown order type');
		}
	}

	async deleteLimitOrder(orderId: number) {
		const args = () => ({
			orderId: orderId,
		});

		const resources = await this.getUnnamedResourcesAccessedFromMethod('cancelOrder', args());

		const atc = await this.compose()
			.cancelOrder(args(), {
				...resources,
			})
			.atc();

		await signAndSendTransections(nodeClient, [atc.buildGroup().map((t) => t.txn)]);
	}

	async invoke(functionName: string, ...args: any[]) {
		const removeNot = addNotification('pending', `Txn in progress`);
		try {
			const resp = await this[<string>functionName](...args);
			addNotification('success', `Success`, 5000);
			removeNot();
			return resp;
		} catch (error) {
			console.error((<Error>error).message);
			addNotification('error', (<Error>error).message, 15000);
		}
		removeNot();
	}
}
