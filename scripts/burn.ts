import algosdk from 'algosdk';
import { account, deployVoiSwap, getSuggestedParams, getUnnamedResourcesAccessedFromMethod } from './_shared';
import { getArc200Balance, getBalance, getClient, viaAppId } from './_shared';
import { currentAppId, currentLptAssetId } from './_deployed';

async function main() {
	let appId = currentAppId;
	const appAddress = algosdk.getApplicationAddress(appId);

	console.log('Signer Voi Balance:', (await getBalance(account.addr)) / 1e6);
	console.log(`Signer Via Balance:`, (await getArc200Balance(viaAppId, account.addr)) / 1e6);

	console.log('App Voi Balance:', (await getBalance(appAddress)) / 1e6);
	console.log(`App Via Balance:`, (await getArc200Balance(viaAppId, appAddress)) / 1e6);

	const suggestedParams = await getSuggestedParams();

	// Add liquidity

	const burnAmount = 1_000_000;

	appId = await deployVoiSwap(appId);
	console.log('AppId:', appId);
	if (!appId) return;

	const client = getClient(appId);

	const removeLiqArgs = () => ({
		poolXfer: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
			assetIndex: currentLptAssetId,
			amount: burnAmount,
			from: account.addr,
			to: algosdk.getApplicationAddress(appId),
			suggestedParams: suggestedParams,
		}),
		poolAsset: currentLptAssetId,
	});

	const res = await client.burn(
		removeLiqArgs(),
		await getUnnamedResourcesAccessedFromMethod(client, 'burn', removeLiqArgs())
	);
	console.log('Burn:', res.return);

	console.log('App Voi Balance:', (await getBalance(appAddress)) / 1e6);
	console.log(`App Via Balance:`, (await getArc200Balance(viaAppId, appAddress)) / 1e6);

	console.log('Signer Voi Balance:', (await getBalance(account.addr)) / 1e6);
	console.log(`Signer Via Balance:`, (await getArc200Balance(viaAppId, account.addr)) / 1e6);
}

main();
