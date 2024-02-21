<script lang="ts">
	import { type Token, knownTokens, knownPools, TokenType, type Pool } from '$lib';
	import Dropdown from '$lib/Dropdown.svelte';
	import { getStores } from '$app/stores';
	import { browser } from '$app/environment';
	import { getBalance } from '$lib/_shared';
	import algosdk from 'algosdk';
	import { connectedAccount } from '$lib/UseWallet.svelte';
	import { pageContentRefresh } from '$lib/utils';
	import { onNumberKeyPress } from '$lib/inputs';
	import { goto } from '$app/navigation';
	import { onChainStateWatcher, watchArc200Balance, watchPoolTotalSupply } from '$lib/stores/onchain';
	import { AlgoArc200PoolConnector } from '$lib/AlgoArc200PoolConnector';
	import { convertDecimals } from '$lib/numbers';

	$: action = $page.params.action;

	const { page } = getStores();
	const tokenA = <Token>$knownTokens.find((token) => token.ticker === $page.params.tokenA);
	const tokenB = <Token>$knownTokens.find((token) => token.ticker === $page.params.tokenB);

	let voiToken: Token = <any>undefined;
	let arc200Token: Token = <any>undefined;
	let matchedPool: Pool = <any>undefined;

	if (tokenA?.ticker === 'VOI' && tokenB?.type === TokenType.ARC200) {
		voiToken = tokenA;
		arc200Token = tokenB;
	} else if (browser) {
		goto(`/`);
	}

	if (voiToken && arc200Token) {
		const match = $knownPools.find((pool) => pool.arc200Asset.assetId === arc200Token.id);
		if (match) matchedPool = match;
	}

	if (!matchedPool) {
		throw Error('pool not found');
	}

	const connectedUserState = onChainStateWatcher.getAccountWatcher($connectedAccount);
	const currentPoolState = onChainStateWatcher.getAccountWatcher(algosdk.getApplicationAddress(matchedPool.poolId));

	const userLptBalance = watchArc200Balance(matchedPool.poolId, $connectedAccount);
	const poolIssuedTokens = watchPoolTotalSupply(matchedPool.poolId);
	const poolArc200Balance = watchArc200Balance(arc200Token.id, algosdk.getApplicationAddress(matchedPool.poolId));
	const userArc200Balance = watchArc200Balance(arc200Token.id, $connectedAccount);

	let inputTokenLpt: number = 0;
	let inputTokenA: number = 0;
	let inputTokenB: number = 0;

	let disabled = true;
	let loading = false;

	let timeout: NodeJS.Timeout;

	$: if (typeof $poolIssuedTokens === 'bigint' && !$poolIssuedTokens) {
		disabled = false;
	}

	async function onInputTokenLpt() {
		clearTimeout(timeout);
		disabled = true;
		inputTokenA = 0;
		inputTokenB = 0;
		if (!inputTokenLpt) return;
		await new Promise((r) => (timeout = setTimeout(r, 500)));
		loading = true;

		const SCALE = 100_000_000_000_000;

		const ratio = (BigInt(inputTokenLpt * 1e6) * BigInt(SCALE)) / $poolIssuedTokens;
		const voiBalance = $currentPoolState.amount - ($currentPoolState['min-balance'] ?? 100_000);
		const viaBalance = $poolArc200Balance;
		loading = false;

		inputTokenA = Number((Number(BigInt(voiBalance) * ratio) / voiToken.unit / SCALE).toFixed(6));
		inputTokenB = Number((Number(BigInt(viaBalance) * ratio) / arc200Token.unit / SCALE).toFixed(6));

		disabled = !inputTokenB;
	}

	async function onInputTokenA() {
		if (!$poolIssuedTokens) return;
		clearTimeout(timeout);
		disabled = true;
		inputTokenB = 0;
		if (!inputTokenA) return;
		await new Promise((r) => (timeout = setTimeout(r, 500)));
		loading = true;
		const voiBalance = $currentPoolState.amount - ($currentPoolState['min-balance'] ?? 100_000);
		const viaBalance = $poolArc200Balance;
		loading = false;

		const ratio = Number(convertDecimals(viaBalance, arc200Token.decimals, 6)) / 1e6 / (voiBalance / voiToken.unit);

		const SCALE = 100_000_000_000_000;

		if (ratio) {
			inputTokenB = Number((Math.floor(inputTokenA * SCALE * ratio) / SCALE).toFixed(6));
			disabled = !inputTokenB;
		}
	}

	async function onInputTokenB() {
		if (!$poolIssuedTokens) return;
		clearTimeout(timeout);
		disabled = true;
		inputTokenA = 0;
		if (!inputTokenB) return;
		await new Promise((r) => (timeout = setTimeout(r, 500)));
		loading = true;
		const voiBalance = $currentPoolState.amount - ($currentPoolState['min-balance'] ?? 100_000);
		const viaBalance = $poolArc200Balance;
		loading = false;

		const ratio = voiBalance / voiToken.unit / (Number(convertDecimals(viaBalance, arc200Token.decimals, 6)) / 1e6);

		const SCALE = 100_000_000_000_000;

		if (ratio) {
			inputTokenA = Number((Math.floor(inputTokenB * SCALE * ratio) / SCALE).toFixed(6));
			disabled = !inputTokenA;
		}
	}

	async function changeLiquidity() {
		const prev = disabled;
		disabled = true;
		const algoArc200PoolConnector = new AlgoArc200PoolConnector(matchedPool.arc200Asset.assetId, matchedPool.poolId);
		if (action === 'add') {
			await algoArc200PoolConnector.invoke(
				'mint',
				BigInt(Math.floor(inputTokenA * tokenA.unit)),
				BigInt(Math.floor(inputTokenB * tokenB.unit))
			);
			pageContentRefresh(0);
		} else if (action === 'remove') {
			await algoArc200PoolConnector.invoke('burn', BigInt(Math.floor(inputTokenLpt * 1e6)));
			pageContentRefresh(0);
		}
		disabled = prev;
	}

	$: maxLptBalanceError = Number(inputTokenLpt) > algosdk.microalgosToAlgos(Number($userLptBalance ?? 0));
	$: maxBalanceError = Number(inputTokenA) > Math.floor($connectedUserState.amount / tokenA.unit);
	$: maxArc200BalanceError =
		Number(inputTokenB) > Number(convertDecimals($userArc200Balance ?? 0n, tokenB.decimals, 6)) / 1e6;

	$: maxError = action === 'remove' ? maxLptBalanceError : maxBalanceError || maxArc200BalanceError;
</script>

{#if voiToken && arc200Token}
	<div class="w-full h-full flex flex-col items-center justify-center p-12">
		<div class="flex flex-col items-end gap-2 w-full max-w-[448px] prose mt-[-50px]">
			<span class="text-sm">
				My Shares:
				{algosdk.microalgosToAlgos(Number($userLptBalance ?? 0)).toLocaleString('en')} LPT
			</span>
			<span class="text-sm">
				Total Shares:
				{algosdk.microalgosToAlgos(Number($poolIssuedTokens ?? 0)).toLocaleString('en')} LPT
			</span>
		</div>
		<br />
		<form on:submit|preventDefault class="flex flex-col gap-2 w-full max-w-[448px] prose">
			<h4 class="text-left">
				{action === 'remove' ? 'Remove' : 'Add'} Liquidity
			</h4>
			{#if action === 'remove'}
				<div class="flex items-center relative">
					<input
						type="number"
						placeholder="{tokenA.ticker} amount"
						bind:value={inputTokenLpt}
						step={0.000001}
						on:keypress={onNumberKeyPress}
						required
						on:keyup={onInputTokenLpt}
						class="input input-primary border-r-0 rounded-r-none input-bordered w-full focus:outline-none"
					/>
					<span
						class="absolute right-0 bottom-full z-10 cursor-pointer"
						on:click={() => {
							inputTokenLpt = Number($userLptBalance ?? 0) / 1e6;
							onInputTokenLpt();
						}}
						on:keydown={null}>MAX {(Number($userLptBalance ?? 0) / 1e6).toLocaleString('en')}</span
					>
					<Dropdown
						class="btn-ghost border-primary hover:border-primary border-l-0 rounded-l-none m-0 mx-0"
						options={[{ name: 'LPT', value: 'LPT' }]}
						selected={{ name: 'LPT', value: 'LPT' }}
					/>
				</div>
			{/if}
			<label for="">
				{tokenA.ticker}
				{#if tokenA.type}({tokenA.type}){/if}
			</label>
			<div class="flex items-center relative">
				<input
					type="number"
					placeholder="{tokenA.ticker} amount"
					bind:value={inputTokenA}
					step={0.000001}
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
								inputTokenA = balance / tokenA.unit;
								onInputTokenA();
							}}
							on:keydown={null}>MAX {(balance / tokenA.unit).toLocaleString('en')}</span
						>
					{/await}
				{/if}
				{#if action === 'add'}
					<Dropdown
						class="btn-ghost border-primary hover:border-primary border-l-0 rounded-l-none m-0 mx-0"
						options={[{ name: tokenA.ticker, value: tokenA }]}
						selected={{ name: tokenA.ticker, value: tokenA }}
					/>
				{/if}
			</div>
			<label for="">{tokenB.ticker}</label>
			<div class="flex items-center relative">
				<input
					type="number"
					placeholder="{tokenB.ticker} amount"
					bind:value={inputTokenB}
					step={0.000001}
					on:keypress={onNumberKeyPress}
					required
					on:keyup={onInputTokenB}
					disabled={action === 'remove'}
					class="input input-primary border-r-0 input-bordered w-full focus:outline-none"
					class:rounded-r-none={action === 'add'}
				/>
				{#if action === 'add'}
					<span
						class="absolute right-0 bottom-full z-10 cursor-pointer"
						on:click={() => {
							inputTokenB = Number(convertDecimals($userArc200Balance ?? 0n, tokenB.decimals, 6)) / 1e6;
							onInputTokenB();
						}}
						on:keydown={null}
						>MAX {(Number(convertDecimals($userArc200Balance ?? 0n, tokenB.decimals, 6)) / 1e6).toLocaleString(
							'en'
						)}</span
					>
				{/if}
				{#if action === 'add'}
					<Dropdown
						class="btn-ghost border-primary hover:border-primary border-l-0 rounded-l-none m-0 mx-0"
						options={[{ name: tokenB.ticker, value: tokenB }]}
						selected={{ name: tokenB.ticker, value: tokenB }}
					/>
				{/if}
			</div>

			<div class="flex flex-col gap-0">
				<span class="flex justify-between items-center">
					{#if typeof $poolArc200Balance === 'bigint'}
						<span class="flex gap-4">
							Liquidity =
							{(($currentPoolState.amount - ($currentPoolState['min-balance'] ?? 0)) / voiToken.unit).toLocaleString(
								'en'
							)} VOI /
							{(Number($poolArc200Balance) / matchedPool.arc200Asset.unit).toLocaleString('en')}
							{matchedPool.arc200Asset.symbol}
						</span>
					{:else}
						<span class="flex gap-4">Liquidity = 0 VOI / 0 {matchedPool.arc200Asset.symbol}</span>
						<span class="loading h-4 w-4" />
					{/if}
				</span>
			</div>

			<div class="flex justify-center mt-2 pr-0">
				<button
					class="btn btn-primary w-full box-border {tokenA.ticker === tokenB.ticker || disabled || maxError
						? 'disabled btn-outline'
						: ''}"
					on:click={disabled || maxError ? () => {} : changeLiquidity}
				>
					{action === 'remove' ? 'Remove' : 'Add'} Liquidity
				</button>
			</div>
			<div class="flex justify-center mt-2 pr-0">
				<a
					on:click|preventDefault={() => {
						goto(`/liquidity/VOI-${matchedPool.arc200Asset.symbol}/${action === 'remove' ? 'add' : 'remove'}`);
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

<style>
	.disabled {
		pointer-events: none;
	}
	form {
		opacity: 0;
		animation: fadein 1s forwards;
	}
	@keyframes fadein {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>
