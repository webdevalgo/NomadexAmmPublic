<script lang="ts">
	import { connectedAccount, getTransactionSignerAccount } from '$lib/UseWallet.svelte';
	import { nodeClient } from '$lib/_shared';
	import algosdk from 'algosdk';
	import { Arc200TokenClient } from '../../../contracts/clients/Arc200TokenClient';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Contract from 'arc200js';
	import { goto } from '$app/navigation';
	import { knownPools, knownTokens, saveArc200TokenToList } from '$lib';

	let appId = Number($page.params.tokenId);
	let currentManager = '';
	let manager = '';
	let name = '';
	let symbol = '';
	let decimals = 0;
	let totalSupply = 0;
	let loading = false;

	onMount(async () => {
		loading = true;
		try {
			const client = new Arc200TokenClient(
				{
					id: appId,
					resolveBy: 'id',
					sender: getTransactionSignerAccount(),
				},
				nodeClient
			);

			const contract = new Contract(appId, nodeClient, undefined);

			const arc200_name = await contract.arc200_name();
			name = arc200_name.success ? arc200_name.returnValue : '';

			const arc200_symbol = await contract.arc200_symbol();
			symbol = arc200_symbol.success ? arc200_symbol.returnValue : '';

			const arc200_decimals = await contract.arc200_decimals();
			decimals = arc200_decimals.success ? Number(arc200_decimals.returnValue) : 0;

			const arc200_totalSupply = await contract.arc200_totalSupply();
			totalSupply = arc200_totalSupply.success ? Number(arc200_totalSupply.returnValue / 10n ** BigInt(decimals)) : 0;

			const state = await client.getGlobalState();
			if (state.manager) {
				manager = algosdk.encodeAddress(state.manager.asByteArray());
				currentManager = manager;
			}
		} catch (e) {
			console.error(e);
		} finally {
			loading = false;
		}
	});

	async function createVoiPool() {
		const token = $knownTokens.find((tok) => tok.id === appId);
		if (!token) {
			await saveArc200TokenToList(symbol, appId, decimals);
		}
		goto(`/pools/VOI-${symbol}`);
	}
</script>

<section class="pt-12 p-4 h-full flex flex-row justify-evenly items-center gap-3">
	<div class="h-full flex flex-col justify-start items-center gap-3 w-full">
		<br /><br />
		<div class="w-full max-w-[610px] flex flex-col justify-center">
			<div>Arc200 Token Id:</div>
			<input
				class="input input-primary"
				on:keypress|preventDefault
				on:paste|preventDefault
				type="number"
				value={appId}
			/>
		</div>

		<div class="w-full max-w-[610px] flex flex-col justify-center">
			<div>Token Name:</div>
			<input class="input input-primary" type="text" bind:value={name} />
		</div>

		<div class="w-full max-w-[610px] flex flex-col justify-center">
			<div>Token Symbol:</div>
			<input class="input input-primary" type="text" bind:value={symbol} />
		</div>

		<div class="w-full max-w-[610px] flex flex-col justify-center">
			<div>Decimals:</div>
			<input class="input input-primary" type="number" bind:value={decimals} />
		</div>

		<div class="w-full max-w-[610px] flex flex-col justify-center">
			<div>Total Supply:</div>
			<input class="input input-primary" type="number" bind:value={totalSupply} />
		</div>

		{#if currentManager}
			<div class="w-full max-w-[610px] flex flex-col justify-center">
				<div>Manager Adress:</div>
				<input class="input input-primary" type="text" bind:value={manager} />
			</div>
			{#if algosdk.isValidAddress(manager) && manager !== currentManager}
				<div class="w-full max-w-[610px] flex flex-col justify-center">
					<button class="btn btn-primary btn-sm" on:click={() => (manager = $connectedAccount)}>Change Manager</button>
				</div>
			{/if}
		{/if}

		{#if symbol}
			<div class="w-full max-w-[610px] flex flex-col justify-center">
				<button class="btn btn-primary" class:btn-outline={loading} disabled={loading} on:click={createVoiPool}>
					{#if $knownPools.find((pool) => pool.arc200Asset.assetId === appId)}
						Configure
					{:else}
						Create
					{/if}
					VOI/{symbol} Pool
				</button>
			</div>
		{/if}
	</div>
</section>

<style>
</style>
