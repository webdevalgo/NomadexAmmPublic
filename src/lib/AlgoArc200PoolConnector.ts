import algosdk from 'algosdk';
import Contract from 'arc200js';
import { getTransactionSignerAccount, signAndSendTransections } from './UseWallet.svelte';
import { getBoxName, getUnnamedResourcesAccessed, nodeClient, nodeClientAllowsCompile } from './_shared';
import { Arc200Interface } from './utils';
import { addNotification } from './Notify.svelte';
import { AlgoArc200PoolV02Client } from '../contracts/clients/AlgoArc200PoolV02Client';

const MANAGER = 'DYX2V5XF4IKOHE55Z63XAHVBJTMYM723HK5WJZ72BDZ5AFEFKJ5YP4DOQQ';

const MIN_BALANCE = 250_000;
const MIN_ARC200_BALANCE = 1;

function strToFixedBytes(str: string, length: number) {
	str = str.slice(0, length);
	const uint8Array = new TextEncoder().encode(str);
	const restArray = new Uint8Array(length - uint8Array.length);

	return Uint8Array.from([...uint8Array, ...restArray]);
}

export class AlgoArc200PoolConnector extends AlgoArc200PoolV02Client {
	appId = 0;
	arc200AssetId = 0;
	readonly algodClient: algosdk.Algodv2;
	readonly signer: ReturnType<typeof getTransactionSignerAccount>;

	constructor(arc200AssetId: number, appId: number, signer = getTransactionSignerAccount(), algodClient = nodeClient) {
		signer = signer ?? getTransactionSignerAccount();
		super({ id: appId, resolveBy: 'id', sender: signer }, algodClient);

		this.algodClient = algodClient;
		this.arc200AssetId = arc200AssetId;
		this.appId = appId;
		this.signer = signer;
	}

	static async createPool(arc200_token: number): Promise<AlgoArc200PoolConnector> {
		const removeNot = addNotification('pending', `Txn in progress`);

		let appId: number | bigint | undefined = 0;
		try {
			const client = new AlgoArc200PoolConnector(0, 0, getTransactionSignerAccount(), nodeClientAllowsCompile);

			const result = await client.create.createApplication({
				manager: MANAGER,
			});

			appId = result.confirmation?.applicationIndex;
			if (!appId) throw Error('Got invalid app id');

			addNotification('info', `Created app ${appId}`, 5000);
			const connector = new AlgoArc200PoolConnector(arc200_token, Number(appId));

			connector.arc200AssetId = arc200_token;

			removeNot();

			return connector;
		} catch (e) {
			removeNot();
			throw e;
		}
	}

	async updatePool() {
		await this.update.updateApplication({});
	}

	async initPool() {
		if (!this.signer?.addr) throw Error('Signer address not defined');

		const arc200 = new Contract(this.arc200AssetId, nodeClient, undefined);
		const { returnValue: unit } = <{ returnValue: '' }>await arc200.arc200_symbol();

		if (!unit) throw Error('Failed to get unit for the Arc200 token');

		const poolTokenName = `VOI-${unit} LPT`;
		const poolUnitName = `LPT`;

		const suggestedParams = await nodeClient.getTransactionParams().do();

		const getInitGroup = async (res?: object): Promise<algosdk.Transaction[]> => {
			const deployed = this.compose();

			deployed.addTransaction({
				txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
					from: this.signer.addr,
					to: algosdk.getApplicationAddress(this.appId),
					amount: MIN_BALANCE,
					suggestedParams: suggestedParams,
				}),
				signer: getTransactionSignerAccount().signer,
			});

			await deployed.poolInitialize(
				{
					name: strToFixedBytes(poolTokenName, 32),
					symbol: strToFixedBytes(poolUnitName, 8),
					tokenYAppId: this.arc200AssetId,
				},
				...(res ? [res] : [])
			);

			const txns = (await deployed.atc()).buildGroup().map((a) => a.txn);

			if (res) {
				return txns;
			}

			return getInitGroup(await getUnnamedResourcesAccessed(txns));
		};

		const arc200TransferTxns = await Arc200Interface.arc200_transfer(
			this.arc200AssetId,
			this.signer.addr,
			algosdk.getApplicationAddress(this.appId),
			BigInt(MIN_ARC200_BALANCE)
		);
		const txns = await getInitGroup();

		const allTxns: algosdk.Transaction[] = [];

		for (const txn of [...arc200TransferTxns, ...txns]) {
			txn.group = undefined;
			allTxns.push(txn);
		}

		algosdk.assignGroupID(allTxns);

		await signAndSendTransections(nodeClient, [allTxns]);
	}

	async getUnnamedResourcesAccessedFromMethod<C extends AlgoArc200PoolConnector>(
		methodName: keyof ReturnType<C['compose']>,
		args: any = {},
		txnsBefore: algosdk.Transaction[] = [],
		txnsAfter: algosdk.Transaction[] = []
	) {
		const cl: any = new AlgoArc200PoolV02Client(
			{
				id: this.appId,
				resolveBy: 'id',
				sender: this.signer,
			},
			nodeClient
		);

		const composer = await cl.compose()[methodName](args, {}).atc();
		const txns = composer.buildGroup().map(({ txn }) => txn);

		return getUnnamedResourcesAccessed([...txnsBefore, ...txns, ...txnsAfter]);
	}

	async swapVoiToArc200(voiAmount: bigint, minViaAmount: bigint) {
		const suggestedParams = await nodeClient.getTransactionParams().do();

		const manager = (await nodeClient.getApplicationByID(this.appId).do())?.params?.['global-state']?.find(
			(state) => Buffer.from(state.key, 'base64').toString() === 'manager'
		);

		const managerAddressBase64 = manager?.value?.bytes;

		let managerAddress = '';
		if (managerAddressBase64) {
			managerAddress = algosdk.encodeAddress(new Uint8Array(Buffer.from(managerAddressBase64, 'base64')));
		}

		const swapArgs = () => ({
			payTxnX: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
				amount: voiAmount,
				from: this.signer.addr,
				to: algosdk.getApplicationAddress(this.appId),
				suggestedParams: suggestedParams,
			}),
			minAmountY: minViaAmount,
		});

		const composer = this.compose();
		const opts = await this.getUnnamedResourcesAccessedFromMethod('swapXtoY', swapArgs());
		const atc = await composer
			.swapXtoY(swapArgs(), {
				...opts,
				boxes: [
					...opts.boxes,
					{
						appId: this.arc200AssetId,
						name: getBoxName(algosdk.getApplicationAddress(this.appId)),
					},
				],
				accounts: [...new Set([...opts.accounts, managerAddress])],
				apps: [...new Set([...opts.apps, this.arc200AssetId])],
			})
			.atc();

		const swapTxns = atc.buildGroup().map(({ txn }) => txn);

		await signAndSendTransections(nodeClient, [swapTxns]);
		console.log({ success: true });
	}

	async swapArc200ToVoi(arc200Amount: bigint, minVoiAmount: bigint) {
		const approveTxns = await Arc200Interface.arc200_approve(
			this.arc200AssetId,
			this.signer.addr,
			algosdk.getApplicationAddress(this.appId),
			BigInt(arc200Amount)
		);

		const swapArgs = () => ({
			amountY: arc200Amount,
			minAmountX: minVoiAmount,
		});
		const composer = this.compose();

		for (const approveTxn of approveTxns) {
			approveTxn.group = undefined;
			composer.addTransaction({ txn: approveTxn, signer: this.signer.signer });
		}
		const opts = await this.getUnnamedResourcesAccessedFromMethod('swapYtoX', swapArgs(), approveTxns);

		const atc = await composer
			.swapYtoX(swapArgs(), {
				...opts,
				apps: [...new Set([...opts.apps, this.arc200AssetId])],
			})
			.atc();
		const swapTxns = atc.buildGroup().map(({ txn }) => txn);

		await signAndSendTransections(nodeClient, [swapTxns]);
		console.log({ success: true });
	}

	async mint(algoAmount: bigint, arc200Amount: bigint) {
		if (!this.signer?.addr) throw Error('signer undefined');

		const params = await nodeClient.getTransactionParams().do();

		const approveTxns = await Arc200Interface.arc200_approve(
			this.arc200AssetId,
			this.signer.addr,
			algosdk.getApplicationAddress(this.appId),
			BigInt(arc200Amount)
		);

		const mintArgs = () => ({
			payTxnX: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
				amount: BigInt(algoAmount),
				from: this.signer.addr,
				to: algosdk.getApplicationAddress(this.appId),
				suggestedParams: params,
			}),
			amountY: BigInt(arc200Amount),
		});
		const composer = this.compose();

		for (const approveTxn of approveTxns) {
			approveTxn.group = undefined;
			composer.addTransaction({ txn: approveTxn, signer: this.signer.signer });
		}
		const opts = await this.getUnnamedResourcesAccessedFromMethod('addLiquidity', mintArgs(), approveTxns);

		const mintTxns = (
			await composer
				.addLiquidity(mintArgs(), {
					...opts,
					apps: [...new Set([...opts.apps, this.arc200AssetId])],
				})
				.atc()
		)
			.buildGroup()
			.map(({ txn }) => txn);

		await signAndSendTransections(nodeClient, [mintTxns]);
	}

	async burn(lptAmount: bigint) {
		const removeLiqArgs = () => ({
			lptAmount,
		});

		const composer = this.compose();

		const atc = await composer
			.removeLiquidity(
				removeLiqArgs(),
				await this.getUnnamedResourcesAccessedFromMethod('removeLiquidity', removeLiqArgs())
			)
			.atc();

		const burnTxns = atc.buildGroup().map(({ txn }) => txn);

		await signAndSendTransections(nodeClient, [burnTxns]);
		console.log({ success: true });
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
			removeNot();
			addNotification('error', (<Error>error).message, 15000);
			throw error;
		}
	}
}
