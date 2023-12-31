<script lang="ts">
	import { type Token, knownTokens } from '$lib';
	import Dropdown from '$lib/Dropdown.svelte';
	import { getStores } from '$app/stores';
	import { browser } from '$app/environment';
	import { balanceString, getASABalance, getArc200Balance, getBalance, getClient, viaAppId } from '$lib/_shared';
	import { currentAppId, currentLptAssetId } from '$lib/_deployed';
	import algosdk from 'algosdk';
	import { connectedAccount } from '$lib/UseWallet.svelte';
	import { pageContentRefresh } from '$lib/utils';
	import { onNumberKeyPress } from '$lib/inputs';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import ContractMethods from '$lib/contractMethods';

	const { page } = getStores();

	$: action = $page.params.action;

	let tokens: [Token, Token] = [knownTokens[0], knownTokens[1]];

	function setSelectedToken(token: Token, index: number) {
		if (!tokens) return;
		const lastSelected = tokens[index];
		if (lastSelected.ticker !== token.ticker) {
			updateRoute(token, tokens[index]);
		}
	}

	function updateRoute(tokenA: Token, tokenB: Token) {
		if (!tokens) return;
		if (tokens[0].ticker !== tokenA.ticker || tokens[1].ticker !== tokenB.ticker) {
			location.href = `/swap/${tokenA.ticker}-${tokenB.ticker}`;
		}
	}

	$: browser && tokens && tokens[0] && tokens[1] && updateRoute(tokens[0], tokens[1]);

	let inputTokenLpt: number = 0;
	let inputTokenA: number = 0;
	let inputTokenB: number = 0;

	let disabled = true;
	let loading = false;

	let timeout: NodeJS.Timeout;

	let poolInitialized: boolean;

	onMount(async () => {
		const client = getClient(currentAppId);
		poolInitialized = Boolean((await client.getGlobalState()).initialized?.asByteArray()?.[0]);
		if (!poolInitialized) {
			disabled = false;
		}
	});

	async function onInputTokenLpt() {
		clearTimeout(timeout);
		disabled = true;
		inputTokenA = 0;
		inputTokenB = 0;
		if (!inputTokenLpt) return;
		await new Promise((r) => (timeout = setTimeout(r, 1000)));
		loading = true;
		const appLptBalance = await getASABalance(currentLptAssetId, algosdk.getApplicationAddress(currentAppId));

		const issued = BigInt(10_000_000_000) * BigInt(1e6) - BigInt(appLptBalance);

		const ratio = (BigInt(inputTokenLpt * 1e6) * BigInt(1e6)) / issued;
		const voiBalance = await getBalance(algosdk.getApplicationAddress(currentAppId));
		const viaBalance = await getArc200Balance(viaAppId, algosdk.getApplicationAddress(currentAppId));
		loading = false;

		inputTokenA = Number((BigInt(voiBalance) * ratio) / BigInt(1e6)) / 1e6;
		inputTokenB = Number((BigInt(viaBalance) * ratio) / BigInt(1e6)) / 1e6;

		disabled = !inputTokenB;
	}

	async function onInputTokenA() {
		if (!poolInitialized) return;
		clearTimeout(timeout);
		disabled = true;
		inputTokenB = 0;
		if (!inputTokenA) return;
		await new Promise((r) => (timeout = setTimeout(r, 1000)));
		loading = true;
		const voiBalance = (await getBalance(algosdk.getApplicationAddress(currentAppId), false)) - 1e6;
		const viaBalance = await getArc200Balance(viaAppId, algosdk.getApplicationAddress(currentAppId));
		loading = false;

		const ratio = viaBalance / voiBalance;
		if (ratio) {
			inputTokenB = Math.floor(inputTokenA * 1e6 * ratio) / 1e6;
			disabled = !inputTokenB;
		}
	}

	async function onInputTokenB() {
		if (!poolInitialized) return;
		clearTimeout(timeout);
		disabled = true;
		inputTokenA = 0;
		if (!inputTokenB) return;
		await new Promise((r) => (timeout = setTimeout(r, 1000)));
		loading = true;
		const voiBalance = (await getBalance(algosdk.getApplicationAddress(currentAppId))) - 1e6;
		const viaBalance = await getArc200Balance(viaAppId, algosdk.getApplicationAddress(currentAppId));
		loading = false;

		const ratio = voiBalance / viaBalance;

		if (ratio) {
			inputTokenA = Math.floor(inputTokenB * 1e6 * ratio) / 1e6;
			disabled = !inputTokenA;
		}
	}

	async function changeLiquidity() {
		const prev = disabled;
		disabled = true;
		if (action === 'add') {
			await ContractMethods.call('mint', inputTokenA, inputTokenB);
			pageContentRefresh(0);
		} else if (action === 'remove') {
			await ContractMethods.call('burn', inputTokenLpt);
			pageContentRefresh(0);
		}
		disabled = prev;
	}
</script>

{#if tokens}
	<div class="w-full h-full flex flex-col items-center p-12">
		<form on:submit|preventDefault class="flex flex-col gap-2 w-full max-w-[448px] mt-40 prose">
			<h4 class="text-left">
				{action === 'remove' ? 'Remove' : 'Add'} Liquidity {tokens[0].ticker} for {tokens[1].ticker}
			</h4>
			{#if action === 'remove'}
				<div class="flex items-center relative">
					<input
						type="number"
						placeholder="{tokens[0].ticker} amount"
						bind:value={inputTokenLpt}
						step={1 / 1e6}
						on:keypress={onNumberKeyPress}
						required
						on:keyup={onInputTokenLpt}
						class="input input-primary border-r-0 rounded-r-none input-bordered w-full focus:outline-none"
					/>
					{#await getASABalance(currentLptAssetId, $connectedAccount) then balance}
						<span
							class="absolute right-0 bottom-full z-10 cursor-pointer"
							on:click={() => {
								inputTokenLpt = balance / 1e6;
								onInputTokenLpt();
							}}
							on:keydown={null}>MAX {(balance / 1e6).toFixed(2)}</span
						>
					{/await}
					<Dropdown
						class="btn-ghost border-primary hover:border-primary border-l-0 rounded-l-none m-0 mx-0"
						options={[{ name: 'LPT', value: 'LPT' }]}
						selected={{ name: 'LPT', value: 'LPT' }}
						onSelect={(value) => setSelectedToken(value, 0)}
					/>
				</div>
			{/if}
			<label for="">
				{tokens[0].ticker}
				{#if tokens[0].type}({tokens[0].type}){/if}
			</label>
			<div class="flex items-center relative">
				<input
					type="number"
					placeholder="{tokens[0].ticker} amount"
					bind:value={inputTokenA}
					step={1 / 1e6}
					on:keypress={onNumberKeyPress}
					required
					on:keyup={onInputTokenA}
					disabled={action === 'remove'}
					class="input input-primary border-r-0 input-bordered w-full focus:outline-none"
					class:rounded-r-none={action === 'add'}
				/>
				{#if action === 'add'}
					{#await getBalance($connectedAccount) then balance}
						<span
							class="absolute right-0 bottom-full z-10 cursor-pointer"
							on:click={() => {
								inputTokenA = balance / 1e6;
								onInputTokenA();
							}}
							on:keydown={null}>MAX {(balance / 1e6).toFixed(2)}</span
						>
					{/await}
				{/if}
				{#if action === 'add'}
					<Dropdown
						class="btn-ghost border-primary hover:border-primary border-l-0 rounded-l-none m-0 mx-0"
						options={[{ name: tokens[0].ticker, value: tokens[0] }]}
						selected={{ name: tokens[0].ticker, value: tokens[0] }}
						onSelect={(value) => setSelectedToken(value, 0)}
					/>
				{/if}
			</div>
			<label for=""
				>{tokens[1].ticker}
				{#if tokens[1].type}({tokens[1].type}){/if}</label
			>
			<div class="flex items-center relative">
				<input
					type="number"
					placeholder="{tokens[1].ticker} amount"
					bind:value={inputTokenB}
					step={1 / 1e6}
					on:keypress={onNumberKeyPress}
					required
					on:keyup={onInputTokenB}
					disabled={action === 'remove'}
					class="input input-primary border-r-0 input-bordered w-full focus:outline-none"
					class:rounded-r-none={action === 'add'}
				/>
				{#if action === 'add'}
					{#await getArc200Balance(viaAppId, $connectedAccount) then balance}
						<span
							class="absolute right-0 bottom-full z-10 cursor-pointer"
							on:click={() => {
								inputTokenB = balance / 1e6;
								onInputTokenB();
							}}
							on:keydown={null}>MAX {(balance / 1e6).toFixed(2)}</span
						>
					{/await}
				{/if}
				{#if action === 'add'}
					<Dropdown
						class="btn-ghost border-primary hover:border-primary border-l-0 rounded-l-none m-0 mx-0"
						options={[{ name: tokens[1].ticker, value: tokens[1] }]}
						selected={{ name: tokens[1].ticker, value: tokens[1] }}
						onSelect={(value) => setSelectedToken(value, 1)}
					/>
				{/if}
			</div>

			<!-- Min Received = {inputTokenB - inputTokenB * slippage}
			{tokenB.ticker} -->

			<div class="flex flex-col gap-0">
				<span class="flex justify-between items-center">
					{#await balanceString(currentAppId, viaAppId)}
						<span class="flex gap-4">Liquidity = 0 VOI / 0 VIA</span>
					{:then balance}
						Liquidity = {balance}
					{:catch}
						<span class="flex gap-4">Liquidity = 0 VOI / 0 VIA</span>
					{/await}
					{#if loading}<span class="loading h-4 w-4" />{/if}
				</span>
			</div>

			<!-- <br />
			Fee: {0.5}% -->

			<div class="flex justify-center mt-2 pr-0">
				<button
					class="btn btn-primary w-full box-border"
					class:disabled={tokens[0].ticker === tokens[1].ticker || disabled}
					{disabled}
					on:click={changeLiquidity}
				>
					{action === 'remove' ? 'Remove' : 'Add'} Liquidity
				</button>
			</div>
			<div class="flex justify-center mt-2 pr-0">
				<a
					on:click|preventDefault={() => {
						goto(`/liquidity/VOI-VIA/${action === 'remove' ? 'add' : 'remove'}`);
						pageContentRefresh(0);
					}}
					href={null}
					class="btn btn-ghost w-full box-border"
				>
					{action === 'remove' ? 'Add' : 'Remove'} Liquidity
				</a>
			</div>
		</form>
	</div>
{/if}

<style lang="postcss">
	.disabled {
		@apply btn-outline;
		pointer-events: none;
	}
</style>
