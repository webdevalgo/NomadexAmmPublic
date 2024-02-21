import algosdk from 'algosdk';
import {
	account,
	getSuggestedParams,
	getUnnamedResourcesAccessedFromMethod,
	indexerClient,
	nodeClient,
} from './_shared';
import { getArc200Balance, getBalance, getClient, viaAppId } from './_shared';
import { currentAppId, currentLptAssetId } from './_deployed';
import Contract from 'arc200js';

async function main() {
	const appId = currentAppId;
	const appAddress = algosdk.getApplicationAddress(appId);

	console.log('Signer Voi Balance:', (await getBalance(account.addr)) / 1e6);
	console.log(`Signer Via Balance:`, (await getArc200Balance(viaAppId, account.addr)) / 1e6);

	console.log('App Voi Balance:', (await getBalance(appAddress)) / 1e6);
	console.log(`App Via Balance:`, (await getArc200Balance(viaAppId, appAddress)) / 1e6);

	const suggestedParams = await getSuggestedParams();

	// Add liquidity

	const voiAmount = 1_300_000;
	const viaAmount = 1_000_000;

	// appId = await deployVoiSwap(appId);
	// console.log('AppId:', appId);
	// if (!appId) return;

	// console.log('OptIn:', await optInAsset(currentLptAssetId));

	const contract = new Contract(viaAppId, nodeClient, indexerClient, { acc: account, waitForConfirmation: true });

	// Approve VIA
	const { success } = await contract.arc200_approve(
		algosdk.getApplicationAddress(appId),
		BigInt(viaAmount),
		false,
		true
	);
	console.log('Approve VIA:', success);
	if (!success) return;

	const client = getClient(appId);

	const addLiqArgs = () => ({
		voiPayTxn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
			amount: voiAmount,
			from: account.addr,
			to: algosdk.getApplicationAddress(appId),
			suggestedParams: suggestedParams,
		}),
		viaAmount,
		poolAsset: currentLptAssetId,
	});

	const res = await client.mint(
		addLiqArgs(),
		await getUnnamedResourcesAccessedFromMethod(client, 'mint', addLiqArgs())
	);
	console.log('Mint:', res.return);

	console.log('App Voi Balance:', (await getBalance(appAddress)) / 1e6);
	console.log(`App Via Balance:`, (await getArc200Balance(viaAppId, appAddress)) / 1e6);

	console.log('Signer Voi Balance:', (await getBalance(account.addr)) / 1e6);
	console.log(`Signer Via Balance:`, (await getArc200Balance(viaAppId, account.addr)) / 1e6);
}

main();
