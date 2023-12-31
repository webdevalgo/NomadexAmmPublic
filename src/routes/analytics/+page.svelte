<script lang="ts">
	import { currentAppId } from '$lib/_deployed';
	import { onMount } from 'svelte';
	import algosdk from 'algosdk';
	import { SwapEvents, type SwapTxn } from '$lib/events';
	import CandleChart, { type PriceCandleData } from '$lib/chart/CandleChart.svelte';

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
		txn: SwapTxn;
	}[] = [];
	let pricingDirection: 'VOI/VIA' | 'VIA/VOI' = 'VOI/VIA';
	let timescale = Timescale['15m'];
	let logarithmic = false;

	onMount(async () => {
		const txns = await SwapEvents.loadTxnsByEvent(currentAppId, 'Swap(address,uint64,uint64,uint8)');
		for (const txn of txns) {
			const events = txn.events['Swap(address,uint64,uint64,uint8)'];
			if (events instanceof Array) {
				for (const event of events) {
					swapEvents.push({
						sender: event[0],
						fromAmount: Number(event[1]),
						toAmount: Number(event[2]),
						direction: Number(event[3]),
						txn: txn,
					});
				}
			}
		}
		swapEvents = swapEvents;

		generateDataByTime(pricingDirection, timescale);
	});

	let priceData: PriceCandleData[] = [];

	let tooltip = [0, 0];

	// function generateData(priceOf: 'VOI/VIA' | 'VIA/VOI') {
	// 	priceData = [];
	// 	const events = [...swapEvents];

	// 	let lowest = Number.MAX_SAFE_INTEGER;
	// 	let highest = 0;
	// 	let c = 1;

	// 	for (let i = 0; i < events.length; i++) {
	// 		const event = events[i];
	// 		const voiAmount = event.direction === 0 ? event.fromAmount : event.toAmount;
	// 		const viaAmount = event.direction === 0 ? event.toAmount : event.fromAmount;

	// 		const price = priceOf === 'VOI/VIA' ? viaAmount / voiAmount : voiAmount / viaAmount;

	// 		lowest = Math.min(lowest, price);
	// 		highest = Math.max(highest, price);

	// 		priceData.push({
	// 			x: event.txn['round-time'] * 1000,
	// 			o: c,
	// 			c: price,
	// 			h: Math.max(c, price),
	// 			l: Math.min(c, price),
	// 		});
	// 		c = price;
	// 	}
	// 	priceData = priceData;

	// 	priceData[0].l = lowest * 0.75;
	// 	priceData[0].h = highest * 1.25;

	// 	console.log({ priceData });
	// }

	function generateDataByTime(priceOf: 'VOI/VIA' | 'VIA/VOI', duration = timescale) {
		priceData = [];
		const events = [...swapEvents];

		let pricingCurrency = priceOf === 'VOI/VIA' ? 0 : 1;

		const getTime = (event: (typeof events)[0]) => event.txn['round-time'];
		const getPrice = (event: (typeof events)[0]) => {
			const voiAmount = event.direction === 0 ? event.fromAmount : event.toAmount;
			const viaAmount = event.direction === 0 ? event.toAmount : event.fromAmount;
			return pricingCurrency === 0 ? viaAmount / voiAmount : voiAmount / viaAmount;
		};

		let close = 1;

		// getTime(events[events.length - 1])

		for (let time = getTime(events[0]); time < Math.floor(Date.now() / 1000); time += duration) {
			const matchingEvents = events.filter((e) => getTime(e) >= time && getTime(e) < time + duration);
			if (matchingEvents.length) {
				for (const event of matchingEvents) {
					event['price'] = getPrice(event);
				}

				const _low = matchingEvents.reduce((l, e) => Math.min(l, getPrice(e)), Number.MAX_SAFE_INTEGER);
				const _high = matchingEvents.reduce((h, e) => Math.max(h, getPrice(e)), 0);
				const _open = close;
				const _close = getPrice(matchingEvents[matchingEvents.length - 1]);

				priceData.push({
					x: time * 1000,
					o: _open,
					c: _close,
					h: _high,
					l: _low,
				});

				close = _close;
			} else {
				priceData.push({
					x: time * 1000,
					o: close,
					c: close,
					h: close,
					l: close,
				});
			}
		}
		priceData = priceData;
	}
</script>

<section class="p-4 flex flex-col items-center gap-2">
	<br />
	<br />
	<div class="flex justify-between w-full max-w-[900px]">
		<!-- <span class="flex-grow"></span> -->
		<div
			class="cursor-pointer font-bold text-lg btn btn-sm"
			on:click={() => {
				pricingDirection = pricingDirection === 'VOI/VIA' ? 'VIA/VOI' : 'VOI/VIA';
				generateDataByTime(pricingDirection);
			}}
			on:keydown
		>
			{pricingDirection}
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
				on:click={() => {
					timescale = Timescale['15m'];
					generateDataByTime(pricingDirection);
				}}>15m</button
			>
			<button
				class="btn btn-sm"
				on:click={() => {
					timescale = Timescale['30m'];
					generateDataByTime(pricingDirection);
				}}>30m</button
			>
			<button
				class="btn btn-sm"
				on:click={() => {
					timescale = Timescale['1hr'];
					generateDataByTime(pricingDirection);
				}}>1hr</button
			>
			<button
				class="btn btn-sm"
				on:click={() => {
					timescale = Timescale['4hr'];
					generateDataByTime(pricingDirection);
				}}>4hr</button
			>
			<button
				class="btn btn-sm"
				on:click={() => {
					timescale = Timescale['1d'];
					generateDataByTime(pricingDirection);
				}}>1d</button
			>
		</div>
	</div>
	<div class="chart-container">
		<CandleChart label={pricingDirection} {logarithmic} data={priceData.slice(-80)} />
	</div>
	<div class="events flex flex-col gap-2 justify-center items-center">
		<h4 class="text-lg font-semibold text-left w-full">Recent Swaps</h4>
		{#if swapEvents?.length}
			<div class="event bg-base-300 p-2 px-5 rounded-btn flex justify-start items-center gap-1 max-w-[800px] font-bold">
				<span class="w-28"> TxId </span>
				<span class="w-28 hidden lg:flex">Round</span>
				<span class="w-28 hidden lg:flex"> Sender </span>
				<span class="w-32 flex-grow text-right">From Amount</span>
				<span class="w-32 flex-grow text-right"> To Amount </span>
			</div>
			{#each [...swapEvents].sort((a, b) => b.txn['confirmed-round'] - a.txn['confirmed-round']) as event}
				<div class="event bg-base-300 p-2 px-5 rounded-btn flex justify-start items-center gap-1 max-w-[800px]">
					<a class="w-28" href="https://voi.observer/explorer/transaction/{event.txn.id}" target="_blank">
						{event.txn.id.slice(0, 3)}...{event.txn.id.slice(-3)}
					</a>
					<span class="w-28 hidden lg:flex">{event.txn['confirmed-round']}</span>
					<a class="w-28 hidden lg:flex" href="https://voi.observer/explorer/account/{event.sender}" target="_blank">
						{event.sender.slice(0, 3)}...{event.sender.slice(-3)}
					</a>
					<span class="w-32 flex-grow text-right"
						>{Number(algosdk.microalgosToAlgos(event.fromAmount).toFixed(3))} {event.direction ? 'VIA' : 'VOI'}</span
					>
					<span class="w-32 flex-grow text-right"
						>{Number(algosdk.microalgosToAlgos(event.toAmount).toFixed(3))} {event.direction ? 'VOI' : 'VIA'}</span
					>
				</div>
			{/each}
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
</style>
