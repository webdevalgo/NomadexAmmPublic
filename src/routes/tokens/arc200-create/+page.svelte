<script lang="ts">
	import { connectedAccount, getTransactionSignerAccount, signAndSendTransections } from '$lib/UseWallet.svelte';
	import { getUnnamedResourcesAccessed, nodeClient } from '$lib/_shared';
	import algosdk from 'algosdk';
	import { Arc200TokenClient } from '../../../contracts/clients/Arc200TokenClient';
	import { goto } from '$app/navigation';
	import { addNotification } from '$lib/Notify.svelte';
	import { knownTokens, saveArc200TokenToList } from '$lib';

	let manager = $connectedAccount;
	let name = '';
	let symbol = '';
	let decimals = 6;
	let totalSupply = 10_000_000_000;

	function strToFixedBytes(str: string, length: number) {
		str = str.slice(0, length);
		const uint8Array = new TextEncoder().encode(str);
		const restArray = new Uint8Array(length - uint8Array.length);

		return Uint8Array.from([...uint8Array, ...restArray]);
	}

	async function createArc200Token() {
		manager = $connectedAccount;
		const tokenInfo = {
			manager,
			name: strToFixedBytes(name, 32),
			symbol: strToFixedBytes(symbol, 8),
			decimals,
			totalSupply: BigInt(totalSupply) * 10n ** BigInt(decimals),
		};

		let appId = 0;
		let remove = () => {};

		try {
			const client = new Arc200TokenClient(
				{
					id: 0,
					resolveBy: 'id',
					sender: getTransactionSignerAccount(),
				},
				new algosdk.Algodv2('', 'https://testnet-api.voi.nodly.io', '')
			);

			remove = addNotification('pending', 'Deploying token contract');

			console.log('creating app');
			const result = await client.create.createApplication({ manager: manager });
			console.log('created app', result);

			appId = Number(result.confirmation?.applicationIndex);
			remove();

			remove = addNotification('pending', 'Initializing token contract');

			console.log(appId);

			const suggestedParams = await nodeClient.getTransactionParams().do();

			const getInitGroup = async (res?: object): Promise<algosdk.Transaction[]> => {
				const deployed = new Arc200TokenClient(
					{
						id: appId,
						resolveBy: 'id',
						sender: getTransactionSignerAccount(),
					},
					nodeClient
				).compose();

				deployed.addTransaction({
					txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
						from: $connectedAccount,
						to: algosdk.getApplicationAddress(appId),
						amount: 1_000_000,
						suggestedParams: suggestedParams,
					}),
					signer: getTransactionSignerAccount().signer,
				});

				await deployed.initialize(
					{
						name: tokenInfo.name,
						symbol: tokenInfo.symbol,
						decimals: tokenInfo.decimals,
						totalSupply: tokenInfo.totalSupply,
						mintTo: tokenInfo.manager,
					},
					...(res ? [res] : [])
				);

				const txns = (await deployed.atc()).buildGroup().map((a) => a.txn);

				if (res) {
					return txns;
				}

				return getInitGroup(await getUnnamedResourcesAccessed(txns));
			};

			const txns = await getInitGroup();

			await signAndSendTransections(nodeClient, [txns]);

			remove();
			addNotification('success', `Created token ${appId}`, 10000);
			await saveArc200TokenToList(symbol, appId, decimals);
			goto(`/tokens/arc200-${appId}`);
		} catch (e) {
			console.error((<Error>e).message);
			remove();
		}
	}

	$: decimals = Math.max(0, Math.min(18, Math.floor(decimals)));
	$: totalSupply = Math.max(0, Math.min(2 ** 64, Math.floor(totalSupply)));

	$: isValid =
		algosdk.isValidAddress(manager) &&
		name.length > 3 &&
		name.length < 33 &&
		name.match(/^[\s\w_-]+$/) &&
		symbol.length > 1 &&
		symbol.length < 9 &&
		symbol.match(/^[\w]+$/) &&
		!$knownTokens.find((tok) => tok.ticker.toLowerCase() === symbol.toLowerCase());
</script>

<section class="pt-12 p-4 h-full flex flex-row justify-evenly items-center gap-3">
	<div class="h-full flex flex-col justify-start items-center gap-3 w-full">
		<br /><br />
		<div class="w-full max-w-[610px] flex flex-col justify-center">
			<div>Manager Adress:</div>
			<input
				class="input input-primary"
				type="text"
				on:keypress|preventDefault
				on:paste|preventDefault
				bind:value={$connectedAccount}
			/>
		</div>
		{#if !algosdk.isValidAddress(manager)}
			<div class="w-full max-w-[610px] flex flex-col justify-center">
				<button class="btn btn-primary btn-sm" on:click={() => (manager = $connectedAccount)}>Set to My Address</button>
			</div>
		{/if}
		<div class="w-full max-w-[610px] flex flex-col justify-center">
			<div>Token Name ({name.length}/32):</div>
			<input class="input input-primary" type="text" bind:value={name} />
		</div>
		<div class="w-full max-w-[610px] flex flex-col justify-center">
			<div>Token Symbol ({symbol.length}/8):</div>
			<input class="input input-primary" type="text" bind:value={symbol} />
		</div>
		<div class="w-full max-w-[610px] flex flex-col justify-center">
			<div>Decimals:</div>
			<input class="input input-primary" type="number" max={18} min={0} step={1} bind:value={decimals} />
		</div>
		<div class="w-full max-w-[610px] flex flex-col justify-center">
			<div>Total Supply</div>
			<input class="input input-primary" type="number" min={0} max={2 ** 64} step={1} bind:value={totalSupply} />
		</div>
		<div>
			Total Supply: {totalSupply.toLocaleString('en')}{decimals ? '.' : ''}{Array(decimals).fill('0').join('')}
		</div>
		{#if isValid}
			<div class="w-full max-w-[610px] flex flex-col justify-center">
				<button class="btn btn-primary btn-sm" on:click={createArc200Token}>Create ARC200 Token</button>
			</div>
		{/if}
	</div>
</section>

<style>
</style>
