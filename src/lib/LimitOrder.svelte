<script lang="ts">
	import { contracts, contractsConstants, type Token } from '$lib';
	import { LimitOrders001ClientConnector, LimitOrderType } from './LimitOrderConnector';
	import { connectedAccount } from './UseWallet.svelte';
	import { pageContentRefresh } from './utils';

	export let order: {
		orderId: number;
		name: Uint8Array;
		value: Uint8Array;
		maker: string;
		arc200Id: number;
		arc200Token: Token;
		algoAmount: number;
		arc200Amount: bigint;
		isDirectionFromArc200ToAlgo: number;
	};
	export let opened = false;
	export let onSelect = () => {};

	let amount = 0;

	const isValid = (amount: number, limitOrder: typeof order) =>
		amount &&
		amount <=
			Number(limitOrder.isDirectionFromArc200ToAlgo ? limitOrder.algoAmount : limitOrder.arc200Amount) /
				Number(limitOrder.isDirectionFromArc200ToAlgo ? BigInt(1e6) : limitOrder.arc200Token.unit);

	function amountAfterFee(amount: number, percentFee: number) {
		return (amount * (100 - percentFee)) / 100;
	}

	async function sell(amount: number, limitOrder: typeof order) {
		const connector = new LimitOrders001ClientConnector(contracts.orderbookLimitOrderApp);

		if (limitOrder.isDirectionFromArc200ToAlgo) {
			await connector.invoke(
				'fillOrder',
				LimitOrderType.SELL_ARC200_FOR_ALGO,
				limitOrder.orderId,
				limitOrder.maker,
				limitOrder.arc200Id,
				BigInt(amount * 1e6)
			);
		} else {
			const amnt = Math.floor(amount * limitOrder.arc200Token.unit);
			await connector.invoke(
				'fillOrder',
				LimitOrderType.SELL_ALGO_FOR_ARC200,
				limitOrder.orderId,
				limitOrder.maker,
				limitOrder.arc200Id,
				BigInt(amnt)
			);
		}
		pageContentRefresh(0);
	}

	async function cancelLimitOrder(e: MouseEvent, limitOrder: typeof order) {
		e.stopPropagation();
		const connector = new LimitOrders001ClientConnector(contracts.orderbookLimitOrderApp);

		if (limitOrder.maker === $connectedAccount) {
			await connector.invoke('deleteLimitOrder', limitOrder.orderId);
		}
		pageContentRefresh(0);
	}

	$: arc200TokenAmount = Number(order.arc200Amount) / order.arc200Token.unit;
	$: algoTokenAmouunt = Number(order.algoAmount) / 1e6;
</script>

<div class="w-full flex flex-col p-2 px-4 bg-base-200 relative">
	<div class="pool rounded-btn flex flex-col min-w-[100px] sm:min-w-[300px] w-full max-w-[800px]">
		<div class="flex justify-between cursor-pointer select-none" on:click={() => onSelect()} on:keydown>
			<span class="name mb-0 flex justify-start items-center w-full gap-5">
				<span class="w-3 flex justify-center items-center">
					{#if order.isDirectionFromArc200ToAlgo}
						<span class="block rounded-full w-3 h-3 bg-green-500">&nbsp;</span>
					{:else}
						<span class="block rounded-full w-3 h-3 bg-red-500">&nbsp;</span>
					{/if}
				</span>

				<a
					href="https://voi.observer/explorer/account/{order.maker}"
					target="_blank"
					referrerpolicy="no-referrer"
					class="w-24 hidden min-[500px]:inline"
					on:click={(e) => e.stopPropagation()}
				>
					{order.maker.slice(0, 3)}...{order.maker.slice(-3)}
				</a>

				<span class="w-24 text-nowrap">
					{(arc200TokenAmount / algoTokenAmouunt).toLocaleString('en')}
					{order.arc200Token.ticker}
				</span>

				<span class="w-24 text-nowrap">
					{algoTokenAmouunt.toLocaleString('en')}
					VOI
				</span>

				<span class="hidden md:block flex-grow" />
			</span>
			<div class="w-6">
				{#if order.maker === $connectedAccount}
					<button class="btn btn-sm btn-ghost absolute" on:click|stopPropagation={(e) => cancelLimitOrder(e, order)}
						>x</button
					>
				{:else}
					&nbsp;
				{/if}
			</div>
		</div>
	</div>
	<div
		class="pool rounded-btn flex flex-col items-center overflow-hidden gap-2 min-w-[100px] sm:min-w-[300px] w-full max-w-[800px] transition-all duration-200"
		style="height: {opened ? 150 : 0}px;"
	>
		<div class="flex flex-col pt-4 gap-2 w-full max-w-[448px]">
			<label for=""> Enter {order.isDirectionFromArc200ToAlgo ? 'VOI' : order.arc200Token.ticker} amount</label>
			<input
				type="number"
				placeholder="Enter {order.isDirectionFromArc200ToAlgo ? 'VOI' : order.arc200Token.ticker} amount"
				bind:value={amount}
				step={0.000001}
				required
				class="input input-sm input-primary input-bordered w-full focus:outline-none"
			/>
			<div class="flex justify-center mt-2 pr-0">
				<button
					class="btn btn-sm btn-primary w-full box-border"
					disabled={!isValid(amount, order)}
					class:btn-outline={!isValid(amount, order)}
					on:click={() => sell(amount, order)}
				>
					{#if order.isDirectionFromArc200ToAlgo}
						SELL
					{:else}
						BUY
					{/if}
				</button>
			</div>

			{#if isValid(amount, order)}
				<div class="text-right">
					You will receive {amountAfterFee(
						Number(
							amount *
								(order.isDirectionFromArc200ToAlgo
									? arc200TokenAmount / algoTokenAmouunt
									: algoTokenAmouunt / arc200TokenAmount)
						),
						contractsConstants.orderbookLimitOrderAppFeePercent
					).toLocaleString('en')}
					{order.isDirectionFromArc200ToAlgo ? order.arc200Token.ticker : 'VOI'}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	* {
		box-sizing: border-box;
	}
</style>
