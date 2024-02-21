import { currentAppId } from './_deployed';
import {
	account,
	deployVoiSwap,
	getArc200Balance,
	getBalance,
	getClient,
	getUnnamedResourcesAccessedFromMethod,
	viaAppId,
} from './_shared';

async function main() {
	let appId = currentAppId;

	console.log('Signer Voi Balance:', (await getBalance(account.addr)) / 1e6);
	console.log(`Signer Via Balance:`, (await getArc200Balance(viaAppId, account.addr)) / 1e6);

	appId = await deployVoiSwap(appId);
	console.log('AppId:', appId);
	if (!appId) return;

	const client = getClient(appId);

	await client.emergencyWithdraw(
		{},
		{
			...(await getUnnamedResourcesAccessedFromMethod(client, 'emergencyWithdraw')),
		}
	);
	console.log('Emergency withdraw completed');
}

main();
