<script lang="ts">
	import { onMount } from 'svelte';
	import { contracts, knownTokens, type Token } from '$lib';
	import { nodeClient } from '$lib/_shared';
	import algosdk from 'algosdk';
	import { getLastActivePair } from '$lib/config';
	import { lastActiveLimitOrderPair } from '$lib/stores';
	import { convertDecimals } from '$lib/numbers';
	import LimitOrder from '$lib/LimitOrder.svelte';
	import { limit } from 'firebase/firestore';

	let limitOrders: {
		orderId: number;
		name: Uint8Array;
		value: Uint8Array;
		maker: string;
		arc200Id: number;
		arc200Token: Token;
		algoAmount: number;
		arc200Amount: bigint;
		isDirectionFromArc200ToAlgo: number;
	}[] = [];
	let loading = false;

	async function fetchOrders() {
		try {
			const { boxes: boxesNames } = await nodeClient.getApplicationBoxes(contracts.orderbookLimitOrderApp).do();

			const boxes = await Promise.all(
				boxesNames.map((box) => nodeClient.getApplicationBoxByName(contracts.orderbookLimitOrderApp, box.name).do())
			);

			limitOrders = boxes
				.map((box) => {
					const [maker, arc200Id, algoAmount, arc200Amount, isDirectionFromArc200ToAlgo] = <
						[string, bigint, bigint, bigint, bigint]
					>algosdk.ABITupleType.from('(address,uint64,uint64,uint256,uint8)').decode(box.value);
					return {
						orderId: Number('0x' + Buffer.from(box.name).toString('hex')),
						name: box.name,
						value: box.value,
						maker,
						arc200Id: Number(arc200Id),
						arc200Token: <Token>$knownTokens.find((t) => t.id === Number(arc200Id)),
						algoAmount: Number(algoAmount),
						arc200Amount,
						isDirectionFromArc200ToAlgo: Number(isDirectionFromArc200ToAlgo),
					};
				})
				.filter((b) => b.arc200Token);
		} catch (e) {}
	}

	onMount(async () => {
		loading = true;
		fetchOrders().finally(() => {
			loading = false;
		});
		const timeout = setInterval(() => fetchOrders(), 15_000);
		return () => clearTimeout(timeout);
	});

	let selectedOrder: number | undefined;
	let amounts: Record<string, number> = {};

	let sortedLimitOrders: Record<
		string,
		{
			sellOrders: typeof limitOrders;
			buyOrders: typeof limitOrders;
		}
	> = {};

	$: sortedLimitOrders = ((limitOrders) => {
		const orders: typeof sortedLimitOrders = {};
		for (const order of limitOrders) {
			if (!orders[order.arc200Id]) {
				orders[order.arc200Id] = { sellOrders: [], buyOrders: [] };
			}
			if (order.isDirectionFromArc200ToAlgo) {
				orders[order.arc200Id].sellOrders = [...(orders[order.arc200Id].sellOrders ?? []), order];
			} else {
				orders[order.arc200Id].buyOrders = [...(orders[order.arc200Id].buyOrders ?? []), order];
			}
		}
		const getPrice = (o: (typeof limitOrders)[0]) =>
			Number(convertDecimals(o.arc200Amount, o.arc200Token.decimals, 6)) / o.algoAmount;

		for (const key in orders) {
			const sellOrders = orders[key].sellOrders.sort((a, b) => b.orderId - a.orderId);
			const buyOrders = orders[key].buyOrders.sort((a, b) => b.orderId - a.orderId);

			orders[key].sellOrders = sellOrders.sort((a, b) => getPrice(b) - getPrice(a));
			orders[key].buyOrders = buyOrders.sort((a, b) => getPrice(b) - getPrice(a));
		}
		return orders;
	})(limitOrders);

	function scrollIntoView(node: HTMLDivElement) {
		node.scrollIntoView();
	}
</script>

<section class="p-4">
	<br />
	<br />
	<div class="flex flex-col justify-center pt-6 max-w-[800px] mx-auto">
		<div class="flex justify-center">
			<h4 class="text-xl font-bold prose w-full mb-5">Limit Orders</h4>
			<a href="/limit-orders/create/{getLastActivePair($lastActiveLimitOrderPair)}" class="btn btn-sm">Create</a>
		</div>
		{#if loading}
			<div class="w-full min-h-44 flex justify-center items-center">
				<span class="loading text-primary" />
			</div>
		{:else}
			{#each Object.keys(sortedLimitOrders) as key}
				<div class="w-full flex flex-col p-2 px-4 bg-base-200 relative">
					<div class="pool rounded-btn flex flex-col gap-2 min-w-[100px] sm:min-w-[300px] w-full max-w-[800px]">
						<div class="flex justify-between cursor-pointer select-none font-bold" on:click={() => {}} on:keydown>
							<span class="name mb-0 flex justify-start items-center w-full gap-5">
								<span class="w-3">&nbsp;</span>
								<span class="w-24 hidden min-[500px]:inline">Maker</span>
								<span class="w-24">Price</span>
								<span class="w-24">Amount</span>
								<!-- <span class="hidden md:block flex-grow max-w-16" /> -->
							</span>
							<div class="w-12">&nbsp;</div>
						</div>
					</div>
				</div>
				{@const sellOrders = sortedLimitOrders[key].sellOrders}
				{@const buyOrders = sortedLimitOrders[key].buyOrders}
				<!-- <div class="h-[2px]" /> -->
				<div class="flex flex-col text-sm max-h-[700px]">
					<div class="half flex-grow flex flex-col py-1 bg-base-200 justify-start max-h-[340px] overflow-y-scroll">
						{#each buyOrders as limitOrder}
							<LimitOrder
								order={limitOrder}
								opened={selectedOrder === limitOrder.orderId}
								onSelect={() => {
									selectedOrder = selectedOrder === limitOrder.orderId ? undefined : limitOrder.orderId;
								}}
							/>
						{/each}
						<div use:scrollIntoView />
					</div>
					<!-- <div class="h-[2px]" /> -->
					<div class="half flex-grow flex flex-col py-1 bg-base-200 justify-start max-h-[340px] overflow-y-scroll">
						{#each sellOrders as limitOrder}
							<LimitOrder
								order={limitOrder}
								opened={selectedOrder === limitOrder.orderId}
								onSelect={() => {
									selectedOrder = selectedOrder === limitOrder.orderId ? undefined : limitOrder.orderId;
								}}
							/>
						{/each}
					</div>
				</div>
				<br />
			{/each}
		{/if}
	</div>
</section>

<style>
	/* .half::-webkit-scrollbar {
		-webkit-appearance: none;
		width: 7px;
	}
	.half::-webkit-scrollbar-thumb {
		border-radius: 4px;
		background-color: rgba(0, 0, 0, 0.5);
		-webkit-box-shadow: 0 0 1px rgba(255, 255, 255, 0.5);
	} */
	* {
		box-sizing: border-box;
	}
</style>
