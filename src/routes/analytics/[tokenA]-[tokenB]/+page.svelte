<script lang="ts">
	import { onMount } from 'svelte';
	import { SwapEvents, type SwapTxn } from '$lib/events';
	import CandleChart, { type PriceCandleData } from '$lib/chart/CandleChart.svelte';
	import { browser } from '$app/environment';
	import { pageContentRefresh, timeAgo } from '$lib/utils';
	import { TokenType, knownPools, type Token, knownTokens, type Pool } from '$lib';
	import { getStores } from '$app/stores';
	import { goto } from '$app/navigation';
	import { convertDecimals } from '$lib/numbers';
	import MdArrowDropDown from 'svelte-star/dist/md/MdArrowDropDown.svelte';
	import { lastActiveAnalyticsPair } from '$lib/stores';
	import CurrencyNumber from '$lib/CurrencyNumber.svelte';

	const { page } = getStores();
	const tokenA = <Token>$knownTokens.find((token) => token.ticker === $page.params.tokenA);
	const tokenB = <Token>$knownTokens.find((token) => token.ticker === $page.params.tokenB);

	let voiToken: Token = <any>undefined;
	let arc200Token: Token = <any>undefined;
	let matchedPool: Pool = <any>undefined;
	let moreEvents = false;
	let eventsPageSize = 50;

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

	lastActiveAnalyticsPair.set(`${tokenA.ticker}-${tokenB.ticker}`);

	enum Timescale {
		'15m' = 15 * 60,
		'30m' = 30 * 60,
		'1hr' = 60 * 60,
		'4hr' = 4 * 60 * 60,
		'1d' = 24 * 60 * 60,
	}

	let swapEvents: {
		sender: string;
		fromAmount: number;
		toAmount: number;
		direction: number;
		poolBals: [bigint, bigint];
		txn: SwapTxn;
	}[] = [];
	let depositEvents: {
		sender: string;
		amts: [bigint, bigint];
		lpt: bigint;
		adding: boolean;
		poolBals: [bigint, bigint];
		txn: SwapTxn;
	}[] = [];
	let price = 0;
	let pricingDirection: string = `${tokenA.ticker}/${tokenB.ticker}`;
	let timescale = browser
		? JSON.parse(localStorage.getItem('timescale') ?? JSON.stringify(Timescale['15m']))
		: Timescale['15m'];
	let logarithmic = false;

	$: browser && localStorage.setItem('timescale', JSON.stringify(timescale));

	async function loadSwapEvents() {
		const eventSignature = 'Swap(address,(uint256,uint256),(uint256,uint256),(uint256,uint256))';
		const updatedEvents: typeof swapEvents = [];
		const txns = await SwapEvents.loadTxnsByEvent(matchedPool.poolId, eventSignature);
		for (const txn of txns) {
			const events = txn.events[eventSignature];
			if (events instanceof Array) {
				for (const event of events) {
					const [sender, inAmts, outAmts, poolBals] = <any[]>event;
					const direction = Number(inAmts[0]) === 0 ? 1 : 0;
					const fromAmount = inAmts[direction];
					const toAmount = outAmts[direction ? 0 : 1];
					updatedEvents.push({
						sender: sender,
						fromAmount: Number(fromAmount),
						toAmount: Number(toAmount),
						direction: direction,
						poolBals: poolBals,
						txn: txn,
					});
				}
			}
		}
		swapEvents = updatedEvents;
		generateDataByTime(pricingDirection, timescale);
	}

	async function loadDepositEvents() {
		const updatedEvents: typeof depositEvents = [];
		for (const eventSignature of [
			'Deposit(address,(uint256,uint256),uint256,(uint256,uint256))',
			'Withdraw(address,uint256,(uint256,uint256),(uint256,uint256))',
		]) {
			const txns = await SwapEvents.loadTxnsByEvent(matchedPool.poolId, eventSignature);
			for (const txn of txns) {
				const events = txn.events[eventSignature];
				if (events instanceof Array) {
					for (const event of events) {
						if (eventSignature.startsWith('Deposit')) {
							const [sender, inAmts, outLpt, poolBals] = <any[]>event;
							updatedEvents.push({
								sender: sender,
								amts: inAmts,
								lpt: outLpt,
								adding: true,
								poolBals: poolBals,
								txn: txn,
							});
						} else {
							const [sender, inLpt, outAmts, poolBals] = <any[]>event;
							updatedEvents.push({
								sender: sender,
								amts: outAmts,
								lpt: inLpt,
								adding: false,
								poolBals: poolBals,
								txn: txn,
							});
						}
					}
				}
			}
		}
		depositEvents = updatedEvents;
		generateDataByTime(pricingDirection, timescale);
	}

	onMount(() => {
		loadSwapEvents();
		loadDepositEvents();
		const interval = setInterval(() => {
			loadSwapEvents();
			loadDepositEvents();
		}, 10_000);
		return () => {
			clearInterval(interval);
		};
	});

	const getFromTokenFromEvent = (event: (typeof swapEvents)[0]) => {
		return event.direction === 0 ? voiToken : arc200Token;
	};

	const getToTokenFromEvent = (event: (typeof swapEvents)[0]) => {
		return event.direction === 0 ? arc200Token : voiToken;
	};

	let priceData: PriceCandleData[] = [];

	async function generateDataByTime(priceOf: string, duration = timescale) {
		const _priceData: PriceCandleData[] = [];
		const events = [...swapEvents].filter((e) => (e.direction === 0 ? e.fromAmount : e.toAmount) > 10);

		if (!events.length) return;

		let pricingCurrency = priceOf === `VOI/${arc200Token.ticker}` ? 0 : 1;

		const getTime = (event: (typeof events)[0]) => event.txn['round-time'];
		const getPrice = (event: (typeof events)[0]) => {
			let viaPrice =
				Number(convertDecimals(event.poolBals[0], 6, 6)) /
				Number(convertDecimals(event.poolBals[1], arc200Token.decimals, 6));
			viaPrice = viaPrice < 0.001 && arc200Token.ticker === 'VIA' ? 0 : viaPrice;

			if (viaPrice) {
				return pricingCurrency === 0 ? 1 / viaPrice : viaPrice;
			} else {
				const voiAmount = event.direction === 0 ? event.fromAmount : event.toAmount;
				const viaAmount = event.direction === 0 ? event.toAmount : event.fromAmount;

				return pricingCurrency === 0
					? viaAmount / arc200Token.unit / (voiAmount / voiToken.unit)
					: voiAmount / voiToken.unit / (viaAmount / arc200Token.unit);
			}
		};

		const getStartOfHour = (ms: number) => {
			let date = new Date(ms);
			while (date.getMinutes() !== 0 || date.getSeconds() !== 0 || date.getMilliseconds() !== 0) {
				date = new Date(--ms);
			}
			return ms;
		};

		let close = 1;

		for (
			let time = Math.floor(getStartOfHour(getTime(events[0]) * 1000) / 1000) + 0.1;
			time < Math.floor(Date.now() / 1000);
			time += duration
		) {
			const matchingEvents = events.filter((e) => getTime(e) >= time && getTime(e) < time + duration);
			if (matchingEvents.length) {
				for (const event of matchingEvents) {
					event['price'] = getPrice(event);
				}

				const _low = matchingEvents.reduce((l, e) => Math.min(l, getPrice(e)), Number.MAX_SAFE_INTEGER);
				const _high = matchingEvents.reduce((h, e) => Math.max(h, getPrice(e)), 0);
				const _open = close;
				const _close = getPrice(matchingEvents[matchingEvents.length - 1]);

				_priceData.push({
					x: time * 1000,
					o: _open,
					c: _close,
					h: _high,
					l: _low,
				});

				close = _close;
				price = _close;
			} else {
				_priceData.push({
					x: time * 1000,
					o: close,
					c: close,
					h: close,
					l: close,
				});
			}
		}

		const checksum1 = _priceData.map((d) => `${d.x}:${d.o}:${d.h}:${d.l}:${d.c}`).join(':');
		const checksum2 = priceData.map((d) => `${d.x}:${d.o}:${d.h}:${d.l}:${d.c}`).join(':');
		if (checksum1 !== checksum2) {
			priceData = _priceData;
		}
	}

	let innerWidth = browser ? window.innerWidth : 0;
	let chartWidth = 0;

	const getTargetPair = (arc200Symbol: string) => {
		if (tokenA.ticker === arc200Token.ticker) {
			return `${arc200Symbol}-VOI`;
		} else {
			return `VOI-${arc200Symbol}`;
		}
	};
</script>

<svelte:window bind:innerWidth />

<section class="p-4 flex flex-col items-center gap-2">
	<br />
	<br />
	<div class="flex flex-wrap gap-4 justify-between items-center w-full max-w-[900px]">
		<div
			class="cursor-pointer"
			on:click={() => {
				goto(`/analytics/${tokenB.ticker}-${tokenA.ticker}`);
				pageContentRefresh(0);
				generateDataByTime(pricingDirection);
			}}
			on:keydown
		>
			<span class="">
				<span class="">1</span>
				{pricingDirection.split('/')[0]} ≈
			</span>
			<span class="">
				{price < 0.1 ? Number(price.toFixed(10)) : price.toLocaleString('en')}
				{pricingDirection.split('/')[1]}
				<div class="inline-flex w-10 absolute ml-0 -mt-2">
					<details class="dropdown dropdown-content dropdown-end">
						<summary class="m-1 btn btn-sm btn-ghost btn-square scale-75" on:click|stopPropagation>
							<span class="scale-150"><MdArrowDropDown /></span>
						</summary>
						<ul
							class="p-0 m-0 shadow menu dropdown-content z-[1] bg-base-100 rounded-box max-w-20 border border-gray-500 list-none max-h-64 overflow-auto block"
						>
							{#each $knownPools as pool}
								<li
									on:click|stopPropagation={async () => {
										await goto(`/analytics/${getTargetPair(pool.arc200Asset.symbol)}`);
										pageContentRefresh();
									}}
									on:keydown
									class="border-b border-gray-500 w-full m-0 pl-0"
								>
									<span>{pool.arc200Asset.symbol}</span>
								</li>
							{/each}
						</ul>
					</details>
				</div>
			</span>
			<span />
		</div>
		<div>
			<button
				class="btn btn-sm"
				on:click={() => {
					logarithmic = !logarithmic;
					generateDataByTime(pricingDirection);
				}}>{logarithmic ? 'linear' : 'log'}</button
			>
			<button
				class="btn btn-sm"
				class:btn-primary={timescale === Timescale['15m']}
				on:click={() => {
					timescale = Timescale['15m'];
					generateDataByTime(pricingDirection);
				}}>15m</button
			>
			<button
				class="btn btn-sm"
				class:btn-primary={timescale === Timescale['30m']}
				on:click={() => {
					timescale = Timescale['30m'];
					generateDataByTime(pricingDirection);
				}}>30m</button
			>
			<button
				class="btn btn-sm"
				class:btn-primary={timescale === Timescale['1hr']}
				on:click={() => {
					timescale = Timescale['1hr'];
					generateDataByTime(pricingDirection);
				}}>1hr</button
			>
			<button
				class="btn btn-sm"
				class:btn-primary={timescale === Timescale['4hr']}
				on:click={() => {
					timescale = Timescale['4hr'];
					generateDataByTime(pricingDirection);
				}}>4hr</button
			>
			<button
				class="btn btn-sm"
				class:btn-primary={timescale === Timescale['1d']}
				on:click={() => {
					timescale = Timescale['1d'];
					generateDataByTime(pricingDirection);
				}}>1d</button
			>
		</div>
	</div>
	<div
		class="chart-container min-w-[350px] overflow-hidden"
		bind:clientWidth={chartWidth}
		style="min-height: {chartWidth / 2.6}px;"
	>
		<CandleChart
			label={`Price of ${pricingDirection.split('/').join(' in ')}`}
			{logarithmic}
			data={priceData.slice(-80)}
		/>
	</div>
	<div class="events flex flex-col gap-0 justify-center items-center w-full sm:w-[calc(100vw-400px)]">
		{#if swapEvents?.length}
			<div class="w-full event font-bold p-3 px-0 rounded-btn flex justify-start items-center gap-1 max-w-[800px]">
				<h4 class="text-lg text-left w-full mb-2 max-w-[724px]">Recent Txns</h4>
				<span class="flex-grow" />
			</div>
			<div
				class="w-full event bg-base-200 font-bold p-3 px-6 rounded-btn flex justify-start items-center gap-1 max-w-[800px]"
			>
				<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28"> TxId </span>
				<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden lg:flex">Time</span>
				<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden lg:flex">Round</span>
				<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden min-[380px]:flex"> Sender </span>
				<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-20 sm:w-28 text-left">From Amt.</span>
				<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-20 sm:w-28 text-left">To Amt.</span>
			</div>
			{#each [...swapEvents]
				.sort((a, b) => b.txn['confirmed-round'] - a.txn['confirmed-round'])
				.slice(0, moreEvents ? 1_000_000 : eventsPageSize) as event}
				{@const fromAmount = Number(event.fromAmount / getFromTokenFromEvent(event).unit)}
				{@const toAmount = Number(event.toAmount / getToTokenFromEvent(event).unit)}
				<div
					class="w-full event bg-base-200 hover:invert-[10%] p-2 px-6 rounded-btn flex justify-start items-center gap-1 max-w-[800px]"
				>
					<a
						class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28"
						href="https://voi.observer/explorer/transaction/{event.txn.id}"
						target="_blank"
						referrerpolicy="no-referrer"
					>
						{event.txn.id.slice(0, 3)}...{event.txn.id.slice(-3)}
					</a>
					<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden lg:flex">
						{timeAgo(event.txn['round-time'] * 1000)}
					</span>
					<a
						href="https://voi.observer/explorer/block/{event.txn['confirmed-round']}"
						target="_blank"
						referrerpolicy="no-referrer"
						class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden lg:flex"
					>
						{event.txn['confirmed-round']}
					</a>
					<a
						class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden min-[380px]:flex"
						href="https://voi.observer/explorer/account/{event.sender}"
						target="_blank"
						referrerpolicy="no-referrer"
					>
						{event.sender.slice(0, 3)}...{event.sender.slice(-3)}
					</a>
					<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-20 sm:w-28 text-justify">
						<CurrencyNumber amount={fromAmount} />
						{event.direction ? arc200Token.ticker : 'VOI'}
					</span>
					<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-20 sm:w-28 text-justify">
						<CurrencyNumber amount={toAmount} />
						{event.direction ? 'VOI' : arc200Token.ticker}
					</span>
				</div>
			{/each}

			{#if !moreEvents && swapEvents.length > eventsPageSize}
				<button class="btn btn-sm btn-ghost mt-4" on:click={() => (moreEvents = true)}>Show More</button>
			{/if}
		{/if}
	</div>

	<div class="events flex flex-col gap-0 justify-center items-center w-full sm:w-[calc(100vw-400px)]">
		{#if depositEvents?.length}
			<div class="w-full event font-bold p-3 px-0 rounded-btn flex justify-start items-center gap-1 max-w-[800px]">
				<h4 class="text-lg text-left w-full mb-2 max-w-[724px]">Add/Remove Liquidity</h4>
				<span class="flex-grow" />
			</div>
			<div
				class="w-full event bg-base-200 font-bold p-3 px-6 rounded-btn flex justify-start items-center gap-1 max-w-[800px]"
			>
				<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28"> TxId </span>
				<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden lg:flex">Time</span>
				<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden lg:flex">Round</span>
				<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden min-[380px]:flex"> Sender </span>
				<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-20 sm:w-28 text-left">Amt.</span>
				<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-20 sm:w-28 text-left">Amt.</span>
			</div>
			{#each [...depositEvents]
				.sort((a, b) => b.txn['confirmed-round'] - a.txn['confirmed-round'])
				.slice(0, moreEvents ? 1_000_000 : eventsPageSize) as event}
				{@const voiAmount = Number(convertDecimals(event.amts[0], 6, 6)) / 1e6}
				{@const arc200Amount = Number(convertDecimals(event.amts[1], arc200Token.decimals, 6)) / 1e6}
				{@const changeSign = event.adding ? '+' : '-'}
				<div
					class="w-full event bg-base-200 hover:invert-[10%] p-2 px-6 rounded-btn flex justify-start items-center gap-1 max-w-[800px]"
				>
					<a
						class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28"
						href="https://voi.observer/explorer/transaction/{event.txn.id}"
						target="_blank"
						referrerpolicy="no-referrer"
					>
						{event.txn.id.slice(0, 3)}...{event.txn.id.slice(-3)}
					</a>
					<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden lg:flex">
						{timeAgo(event.txn['round-time'] * 1000)}
					</span>
					<a
						href="https://voi.observer/explorer/block/{event.txn['confirmed-round']}"
						target="_blank"
						referrerpolicy="no-referrer"
						class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden lg:flex"
					>
						{event.txn['confirmed-round']}
					</a>
					<a
						class="flex-grow text-[0.8rem] sm:text-[1rem] w-16 sm:w-28 hidden min-[380px]:flex"
						href="https://voi.observer/explorer/account/{event.sender}"
						target="_blank"
						referrerpolicy="no-referrer"
					>
						{event.sender.slice(0, 3)}...{event.sender.slice(-3)}
					</a>
					<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-20 sm:w-28 text-justify">
						{changeSign}<CurrencyNumber amount={voiAmount} />
						VOI
					</span>
					<span class="flex-grow text-[0.8rem] sm:text-[1rem] w-20 sm:w-28 text-justify">
						{changeSign}<CurrencyNumber amount={arc200Amount} />
						{arc200Token.ticker}
					</span>
				</div>
			{/each}

			{#if !moreEvents && depositEvents.length > eventsPageSize}
				<button class="btn btn-sm btn-ghost mt-4" on:click={() => (moreEvents = true)}>Show More</button>
			{/if}
		{/if}
	</div>
	<br />
	<br />
	<br />
</section>

<style>
	.chart-container {
		width: 100%;
		display: flex;
		justify-content: center;
		max-height: 500px;
		max-width: calc(100vw - 400px);
	}
	.event * {
		text-wrap: nowrap;
		cursor: default;
	}

	.event a {
		cursor: pointer;
	}
</style>
