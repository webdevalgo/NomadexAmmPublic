import algosdk from 'algosdk';
import { account, deployVoiSwap, getUnnamedResourcesAccessedFromMethod, indexerClient, nodeClient } from './_shared';
import { getArc200Balance, getBalance, getClient, viaAppId } from './_shared';
import { currentAppId } from './_deployed';
import Contract from 'arc200js';

async function main() {
	let appId = currentAppId;
	const appAddress = algosdk.getApplicationAddress(appId);

	console.log('Signer Voi Balance:', (await getBalance(account.addr)) / 1e6);
	console.log(`Signer Via Balance:`, (await getArc200Balance(viaAppId, account.addr)) / 1e6);

	console.log('App Voi Balance:', (await getBalance(appAddress)) / 1e6);
	console.log(`App Via Balance:`, (await getArc200Balance(viaAppId, appAddress)) / 1e6);

	// const suggestedParams = await getSuggestedParams();

	// Add liquidity

	const viaAmount = 3;
	const voiAmount = 2;

	appId = await deployVoiSwap(appId);
	console.log('AppId:', appId);
	if (!appId) return;

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

	const swapArgs = () => ({
		viaAmount: viaAmount,
		minVoi: voiAmount,
	});

	const res = await client.swapViaForVoi(
		swapArgs(),
		await getUnnamedResourcesAccessedFromMethod(client, 'swapViaForVoi', swapArgs())
	);
	console.log('Swap VOI-VIA:', res.return);

	console.log('App Voi Balance:', (await getBalance(appAddress)) / 1e6);
	console.log(`App Via Balance:`, (await getArc200Balance(viaAppId, appAddress)) / 1e6);

	console.log('Signer Voi Balance:', (await getBalance(account.addr)) / 1e6);
	console.log(`Signer Via Balance:`, (await getArc200Balance(viaAppId, account.addr)) / 1e6);
}

main();
