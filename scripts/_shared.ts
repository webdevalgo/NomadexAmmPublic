import algosdk, { AtomicTransactionComposer, EncodedSignedTransaction } from 'algosdk';
import { VoiSwapClient } from '../src/contracts/clients/VoiSwapClient';

export const mnemonic = ``;
export const account = algosdk.mnemonicToSecretKey(mnemonic);

console.log('Account:', account.addr);
export const nodeClient = new algosdk.Algodv2('', 'https://testnet-api.voi.nodly.io', '');
export const indexerClient = new algosdk.Indexer('', 'https://testnet-idx.voi.nodly.io', '');

export const viaAppId = 6779767;

export const getBoxName = (addr: string) => {
	const box = new Uint8Array(33).fill(0);
	box.set(algosdk.decodeAddress(addr).publicKey, 1);
	return box;
};

export const getBoxValue = async (appId: number, address: string) => {
	return (await nodeClient.getApplicationBoxByName(appId, getBoxName(address)).do()).value;
};

export const getBalance = async (address: string) => {
	return (await nodeClient.accountInformation(address).do()).amount;
};

export const getArc200Balance = async (appId: number, address: string) => {
	return Number('0x' + Buffer.from(await getBoxValue(appId, address)).toString('hex'));
};

export const getSuggestedParams = async () => {
	return await nodeClient.getTransactionParams().do();
};

export const deployVoiSwap = async (appId = 0) => {
	const voiSwapClient = new VoiSwapClient(
		{
			resolveBy: 'id',
			id: appId ?? 0,
			sender: account,
		},
		nodeClient
	);

	if (appId) {
		await voiSwapClient.update.updateApplication([]);
		return appId;
	} else {
		const result = await voiSwapClient.create.createApplication([]);
		return Number(result.confirmation?.applicationIndex);
	}
};

export const getClient = (appId: number) => {
	return new VoiSwapClient(
		{
			resolveBy: 'id',
			id: appId,
			sender: account,
		},
		nodeClient
	);
};

export async function getUnnamedResourcesAccessed(txns: algosdk.Transaction[]) {
	const signer = algosdk.makeEmptyTransactionSigner();
	const signed = await signer(
		txns,
		txns.map((_, i) => i)
	);

	const request = new algosdk.modelsv2.SimulateRequest({
		txnGroups: [
			new algosdk.modelsv2.SimulateRequestTransactionGroup({
				txns: <EncodedSignedTransaction[]>signed.map(algosdk.decodeObj),
			}),
		],
		allowUnnamedResources: true,
		allowEmptySignatures: true,
	});

	const simulated = await nodeClient.simulateTransactions(request).do();

	return {
		apps: (simulated.txnGroups[0].unnamedResourcesAccessed?.apps ?? []).map((n) => Number(n)),
		assets: (simulated.txnGroups[0].unnamedResourcesAccessed?.assets ?? []).map((n) => Number(n)),
		boxes: (simulated.txnGroups[0].unnamedResourcesAccessed?.boxes ?? []).map((box) => ({
			appIndex: Number(box.app),
			name: box.name,
		})),
		accounts: simulated.txnGroups[0].unnamedResourcesAccessed?.accounts ?? [],
	};
}

export async function getUnnamedResourcesAccessedFromComposer(composer: AtomicTransactionComposer) {
	const txns = composer.buildGroup().map(({ txn }) => txn);
	return getUnnamedResourcesAccessed(txns);
}

export async function getUnnamedResourcesAccessedFromMethod<C extends VoiSwapClient>(
	client: C,
	methodName: keyof ReturnType<C['compose']>,
	args: any = {}
) {
	const cl: any = client;
	const composer: AtomicTransactionComposer = await cl.compose()[methodName](args, {}).atc();
	return getUnnamedResourcesAccessedFromComposer(composer);
}

export async function optInAsset(assetId: number) {
	const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
		amount: 0,
		assetIndex: assetId,
		from: account.addr,
		to: account.addr,
		suggestedParams: await getSuggestedParams(),
	});
	const { txId } = await nodeClient.sendRawTransaction(txn.signTxn(account.sk)).do();
	return txId;
}
