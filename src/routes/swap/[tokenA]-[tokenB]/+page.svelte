<script lang="ts">
	import { type Token, knownTokens, TokenType, knownPools, type Pool } from '$lib';
	import Dropdown from '$lib/Dropdown.svelte';
	import { getStores } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { calculateInTokens, calculateOutTokens } from '$lib/howMuch';
	import { connectedAccount } from '$lib/UseWallet.svelte';
	import { pageContentRefresh } from '$lib/utils';
	import { onNumberKeyPress } from '$lib/inputs';
	import MdSwapVert from 'svelte-star/dist/md/MdSwapVert.svelte';
	import { onChainStateWatcher, watchArc200Balance } from '$lib/stores/onchain';
	import algosdk from 'algosdk';
	import { AlgoArc200PoolConnector } from '$lib/AlgoArc200PoolConnector';
	import { convertDecimals } from '$lib/numbers';
	import { lastActiveSwapPair } from '$lib/stores';

	const { page } = getStores();
	const tokenA = <Token>$knownTokens.find((token) => token.ticker === $page.params.tokenA);
	const tokenB = <Token>$knownTokens.find((token) => token.ticker === $page.params.tokenB);

	let voiToken: Token = <any>undefined;
	let arc200Token: Token = <any>undefined;
	let matchedPool: Pool = <any>undefined;

	if (tokenA?.ticker === 'VOI' && tokenB?.type === TokenType.ARC200) {
		voiToken = tokenA;
		arc200Token = tokenB;
	} else if (tokenB?.ticker === 'VOI' && tokenA?.type === TokenType.ARC200) {
		voiToken = tokenB;
		arc200Token = tokenA;
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

	lastActiveSwapPair.set(`${tokenA.ticker}-${tokenB.ticker}`);

	let tokens: [Token, Token] | undefined = [tokenA, tokenB];

	let slippageOptions = [
		{ name: '0.25 %', value: 0.0025 },
		{ name: '0.5 %', value: 0.005 },
		{ name: '0.75 %', value: 0.0075 },
		{ name: '1.0 %', value: 0.01 },
		{ name: '2.5 %', value: 0.025 },
		{ name: '5.0 %', value: 0.05 },
		{ name: '10.0 %', value: 0.1 },
		{ name: '15.0 %', value: 0.15 },
		{ name: '20.0 %', value: 0.2 },
		{ name: '25.0 %', value: 0.25 },
		{ name: '35.0 %', value: 0.35 },
		{ name: '50.0 %', value: 0.5 },
		{ name: '75.0 %', value: 0.75 },
		{ name: '95.0 %', value: 0.95 },
	];

	let slippage = browser ? JSON.parse(localStorage.getItem('slippage') ?? '0.025') : 0.025;

	$: browser && localStorage.setItem('slippage', JSON.stringify(slippage));

	const connectedUserState = onChainStateWatcher.getAccountWatcher($connectedAccount);
	const currentPoolState = onChainStateWatcher.getAccountWatcher(algosdk.getApplicationAddress(matchedPool.poolId));

	const userArc200Balance = watchArc200Balance(arc200Token.id, $connectedAccount);
	const poolArc200Balance = watchArc200Balance(arc200Token.id, algosdk.getApplicationAddress(matchedPool.poolId));

	$: loaded = $poolArc200Balance && $currentPoolState.amount;

	function setSelectedToken(token: Token, index: number) {
		if (index === 0) {
			if (tokenA.ticker !== token.ticker) {
				updateRoute(token, tokenB);
			}
		} else {
			if (tokenB.ticker !== token.ticker) {
				updateRoute(tokenA, token);
			}
		}
	}

	function updateRoute(aToken: Token, bToken: Token) {
		if (aToken.ticker !== tokenA.ticker || bToken.ticker !== tokenB.ticker) {
			goto(`/swap/${aToken.ticker}-${bToken.ticker}`, { replaceState: true });
			pageContentRefresh(0);
		}
	}

	$: browser && tokens && tokenA && tokenB && updateRoute(tokenA, tokenB);

	let inputTokenA: number = 0;
	let inputTokenB: number = 0;
	let disabled = true;
	let loading = false;

	let timeout: NodeJS.Timeout;

	async function onInputTokenA() {
		if (!tokenA || !tokenB) return;
		clearTimeout(timeout);
		disabled = true;
		inputTokenB = 0;
		if (!inputTokenA || typeof inputTokenA !== 'number') return;
		let tm: NodeJS.Timeout | undefined;
		await new Promise((r) => {
			timeout = setTimeout(r, 500);
			tm = timeout;
		});
		loading = true;
		const poolVoiBalance = BigInt($currentPoolState.amount) - BigInt($currentPoolState['min-balance'] ?? 0n);
		const poolViaBalance = $poolArc200Balance ?? 0n;
		const ret = calculateOutTokens(
			BigInt(Math.floor(inputTokenA * tokenA.unit)),
			tokenA.ticker === 'VOI' ? poolVoiBalance : poolViaBalance,
			tokenA.ticker === 'VOI' ? poolViaBalance : poolVoiBalance,
			BigInt(matchedPool.swapFee)
		);
		loading = false;
		if (tm && tm === timeout) {
			inputTokenB = Number((Number(ret) / tokenB.unit).toFixed(6));
			disabled = !inputTokenB;
		}
	}

	async function onInputTokenB() {
		if (!tokenA || !tokenB) return;
		clearTimeout(timeout);
		disabled = true;
		inputTokenA = 0;
		if (!inputTokenB || typeof inputTokenB !== 'number') return;
		let tm: NodeJS.Timeout | undefined;
		await new Promise((r) => {
			timeout = setTimeout(r, 500);
			tm = timeout;
		});
		loading = true;
		const poolVoiBalance = BigInt($currentPoolState.amount) - BigInt($currentPoolState['min-balance'] ?? 0n);
		const poolViaBalance = $poolArc200Balance ?? 0n;
		const ret = calculateInTokens(
			BigInt(Math.floor(inputTokenB * tokenB.unit)),
			tokenA.ticker === 'VOI' ? poolVoiBalance : poolViaBalance,
			tokenA.ticker === 'VOI' ? poolViaBalance : poolVoiBalance,
			BigInt(matchedPool.swapFee)
		);
		loading = false;
		if (tm && tm === timeout) {
			inputTokenA = Number((Number(ret) / tokenA.unit).toFixed(6));
			disabled = !inputTokenB;
		}
	}

	async function swap() {
		if (!tokenA || !tokenB) return;
		const prev = disabled;
		disabled = true;

		const tokenAAmount = Math.floor(inputTokenA * tokenA.unit);
		const tokenBAmount = Math.floor(inputTokenB * tokenB.unit);
		const minOfTokenB = Math.floor(tokenBAmount - Math.round(tokenBAmount * slippage));

		const algoArc200PoolConnector = new AlgoArc200PoolConnector(matchedPool.arc200Asset.assetId, matchedPool.poolId);

		if (tokenA.ticker === voiToken.ticker && tokenB.ticker === arc200Token.ticker) {
			await algoArc200PoolConnector.invoke('swapVoiToArc200', BigInt(tokenAAmount), BigInt(minOfTokenB));
			pageContentRefresh(0);
		} else if (tokenA.ticker === arc200Token.ticker && tokenB.ticker === voiToken.ticker) {
			await algoArc200PoolConnector.invoke('swapArc200ToVoi', BigInt(tokenAAmount), BigInt(minOfTokenB));
			pageContentRefresh(0);
		}
		disabled = prev;
	}

	const getTokenSuggestions = (token: Token) => {
		if (token.type === TokenType.ARC200) {
			return $knownPools.map((pool) => ({
				name: pool.arc200Asset.symbol,
				value: $knownTokens.find((token) => token.id === pool.arc200Asset.assetId),
			}));
		}
	};
</script>

{#if voiToken && arc200Token}
	<div class="w-full h-full flex flex-col items-center justify-center p-12">
		<form on:submit|preventDefault class="flex flex-col gap-2 w-full max-w-[448px] prose">
			<h4 class="text-lg text-left prose">Swap {tokenA.ticker} for {tokenB.ticker}</h4>
			<label for="">
				{tokenA.ticker}
			</label>
			<div class="flex items-center relative">
				<input
					type="number"
					placeholder="{tokenA.ticker} amount"
					bind:value={inputTokenA}
					step={0.000001}
					on:keydown={(e) => !loaded && e.preventDefault()}
					on:keypress={onNumberKeyPress}
					on:keyup={onInputTokenA}
					required
					class="input input-primary border-r-0 rounded-r-none input-bordered w-full focus:outline-none"
				/>
				{#await tokenA.ticker === arc200Token.ticker ? $userArc200Balance : BigInt($connectedUserState.amount) then balance}
					<span
						class="absolute right-0 bottom-full cursor-pointer"
						on:click={() => {
							inputTokenA = Number(convertDecimals(balance, tokenA.decimals, 6)) / 1e6;
							onInputTokenA();
						}}
						on:keydown={null}
					>
						MAX {(Number(convertDecimals(balance ?? 0n, tokenA.decimals, 6)) / 1e6).toLocaleString('en')}
					</span>
				{/await}
				<Dropdown
					class="btn-ghost border-primary hover:border-primary border-l-0 rounded-l-none m-0 mx-0"
					options={getTokenSuggestions(tokenA)}
					selected={{ name: tokenA.ticker, value: tokenA }}
					onSelect={(value) => setSelectedToken(value, 0)}
				/>
			</div>
			<div class="flex justify-center px-1">
				<button
					type="reset"
					class="btn btn-ghost btn-link btn-sm opacity-30 text-base-content"
					on:click={() => {
						if (!tokens) return;
						updateRoute(tokenB, tokenA);
					}}
				>
					<span class="block h-6"><MdSwapVert /></span>
				</button>
			</div>
			<label for="">{tokenB.ticker}</label>
			<div class="flex items-center relative">
				<input
					type="number"
					placeholder="{tokenB.ticker} amount"
					bind:value={inputTokenB}
					step={0.000001}
					on:keydown={(e) => !loaded && e.preventDefault()}
					on:keypress={onNumberKeyPress}
					on:keyup={onInputTokenB}
					required
					class="input input-primary border-r-0 rounded-r-none input-bordered w-full focus:outline-none"
				/>
				{#await tokenB.ticker === arc200Token.ticker ? $userArc200Balance : $connectedUserState.amount then balance}
					<span class="absolute right-0 bottom-full cursor-pointer">
						{(Number(convertDecimals(balance ?? 0n, tokenB.decimals, 6)) / 1e6).toLocaleString('en')}
					</span>
				{/await}
				<Dropdown
					class="btn-ghost border-primary hover:border-primary border-l-0 rounded-l-none m-0 mx-0"
					options={getTokenSuggestions(tokenB)}
					selected={{ name: tokenB.ticker, value: tokenB }}
					onSelect={(value) => setSelectedToken(value, 1)}
				/>
			</div>

			<div class="flex flex-col gap-0">
				<span class="flex justify-between items-center">
					<span>
						Min Received = {(inputTokenB - inputTokenB * slippage).toLocaleString('en')}
						{tokenB.ticker}
						{#if loading}<span class="loading h-4 w-4" />{/if}
					</span>
				</span>

				<span class="flex justify-between">
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
					class="btn btn-primary w-full box-border {tokenA.ticker === tokenB.ticker || disabled
						? 'disabled btn-outline'
						: ''}"
					on:click={disabled ? () => {} : swap}
				>
					Swap
				</button>
			</div>
		</form>
		<br />
		<br />
		<br />
		<span class="flex justify-between">
			<span class="text-lg">
				<Dropdown
					class="btn-ghost btn-sm border-none hover:border-primary m-0 mx-0 text-base-content prose font-normal"
					options={slippageOptions}
					selected={slippageOptions.find((opt) => opt.value === slippage)}
					displayPrefix="slippage"
					positon={'top'}
					bind:selectedValue={slippage}
					onSelect={(value) => (slippage = value)}
				/>
			</span>
		</span>
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
