import {
	account,
	deployVoiSwap,
	getArc200Balance,
	getBalance,
	getClient,
	getSuggestedParams,
	getUnnamedResourcesAccessedFromMethod,
	indexerClient,
	nodeClient,
	viaAppId,
} from './_shared';
import { currentAppId, currentLptAssetId } from './_deployed';
import Contract from 'arc200js';
import algosdk from 'algosdk';
import fs from 'fs';
import path from 'path';

async function main() {
	let appId = currentAppId;
	let lptToken = currentLptAssetId;

	console.log('Signer Voi Balance:', (await getBalance(account.addr)) / 1e6);
	console.log(`Signer Via Balance:`, (await getArc200Balance(viaAppId, account.addr)) / 1e6);

	const suggestedParams = await getSuggestedParams();

	appId = await deployVoiSwap(appId);
	console.log('AppId:', appId);
	if (!appId) return;

	const client = getClient(appId);

	const voi = 1_004_000;
	const via = 1_200_000;

	const contract = new Contract(viaAppId, nodeClient, indexerClient, { acc: account, waitForConfirmation: true });

	// Transfer VIA (so account gets opened)
	const { success: successTransfer } = await contract.arc200_transfer(
		algosdk.getApplicationAddress(appId),
		BigInt(0),
		false,
		true
	);
	console.log('Transfer VIA:', successTransfer);
	if (!successTransfer) return;

	// Approve VIA
	const { success } = await contract.arc200_approve(algosdk.getApplicationAddress(appId), BigInt(via), false, true);
	console.log('Approve VIA:', success);
	if (!success) return;

	// Bootstrap Args
	const bootstrapArgs = () => ({
		voiPayTxn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
			amount: voi,
			from: account.addr,
			to: algosdk.getApplicationAddress(appId),
			suggestedParams: suggestedParams,
		}),
		viaAmount: via,
	});

	// Call bootstrap method
	const bootstrapResult = await client.bootstrap(
		bootstrapArgs(),
		await getUnnamedResourcesAccessedFromMethod(client, 'bootstrap', bootstrapArgs())
	);

	lptToken = Number(bootstrapResult.return);

	console.log('LPT Asset Id:', lptToken);

	fs.writeFileSync(
		path.join(__dirname, './_deployed.ts'),
		`export const currentAppId = ${appId};\nexport const currentLptAssetId = ${lptToken};\n`
	);

	// Bootstrap2 Args

	const bootstrap2Args = () => ({
		optinTxn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
			assetIndex: lptToken,
			amount: 0,
			from: account.addr,
			to: account.addr,
			suggestedParams: suggestedParams,
		}),
		poolAsset: lptToken,
	});

	// Call bootstrapStep2 method
	const bootstrap2Result = await client.bootstrapStep2(
		bootstrap2Args(),
		await getUnnamedResourcesAccessedFromMethod(client, 'bootstrapStep2', bootstrap2Args())
	);

	console.log('Bootstrap step 2', bootstrap2Result.return);
}

main();
