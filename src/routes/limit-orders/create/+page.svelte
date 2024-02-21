<script lang="ts">
	import { onMount } from 'svelte';
	import { contracts, knownTokens, type Token } from '$lib';
	import type { AccountState } from '$lib/stores/onchain';
	import { getUnnamedResourcesAccessedFromComposer, indexerClient, nodeClient } from '$lib/_shared';
	import { writable } from 'svelte/store';
	import algosdk from 'algosdk';
	import { connectedAccount, getTransactionSignerAccount, signAndSendTransections } from '$lib/UseWallet.svelte';
	import Contract from 'arc200js';
	import { LimitOrders001Client } from '../../../contracts/clients/LimitOrders001Client';

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
	const poolsState: Record<string, AccountState> = {};

	onMount(async () => {
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
	});
	let selcetdOrder: number | undefined;
	let amount = 0;

	async function sell(amount: number, limitOrder: (typeof limitOrders)[0]) {
		const client = new LimitOrders001Client(
			{
				resolveBy: 'id',
				id: contracts.orderbookLimitOrderApp,
				sender: getTransactionSignerAccount(),
			},
			nodeClient
		);

		const suggestedParams = await nodeClient.getTransactionParams().do();

		if (limitOrder.isDirectionFromArc200ToAlgo) {
			client.fillArc200ToAlgoOrder({
				orderId: limitOrder.orderId,
				algoPayTxn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
					from: $connectedAccount,
					to: algosdk.getApplicationAddress(contracts.orderbookLimitOrderApp),
					amount: Math.floor(amount * 1e6),
					suggestedParams: suggestedParams,
				}),
			});
		} else {
			const amnt = Math.floor(amount * limitOrder.arc200Token.unit);
			const contract = new Contract(limitOrder.arc200Id, nodeClient, indexerClient, {
				simulate: true,
				acc: { addr: $connectedAccount, sk: new Uint8Array() },
			});
			const result = await contract.arc200_approve(
				algosdk.getApplicationAddress(contracts.orderbookLimitOrderApp),
				BigInt(amnt),
				true,
				false
			);
			if (result.success) {
				const txns = result.txns.map((txn) =>
					algosdk.decodeUnsignedTransaction(Uint8Array.from(Buffer.from(txn, 'base64')))
				);
				const atc = await client
					.compose()
					.fillAlgoToArc200Order({
						orderId: limitOrder.orderId,
						arc200Amount: amnt,
					})
					.atc();
				const resources = await getUnnamedResourcesAccessedFromComposer(atc);
				console.log(resources);
				const atc2 = await client
					.compose()
					.fillAlgoToArc200Order(
						{
							orderId: limitOrder.orderId,
							arc200Amount: amnt,
						},
						{
							...resources,
						}
					)
					.atc();
				await signAndSendTransections(nodeClient, [txns, atc2.buildGroup().map((t) => t.txn)]);
				console.log('done');
			}
		}
	}

	const isValid = (amount: number, limitOrder: (typeof limitOrders)[0]) =>
		amount &&
		amount <=
			Number(limitOrder.isDirectionFromArc200ToAlgo ? limitOrder.algoAmount : limitOrder.arc200Amount) /
				Number(limitOrder.isDirectionFromArc200ToAlgo ? BigInt(1e6) : limitOrder.arc200Token.unit);
</script>

<section class="p-4">
	<br />
	<br />
	<div class="flex flex-col justify-center gap-2 pt-6 max-w-[800px] mx-auto">
		<h4 class="text-xl font-bold prose w-full mb-5">Create a limit Order</h4>
		{#each limitOrders as limitOrder}
			<div class="w-full flex flex-col pt-6 p-4 bg-base-300">
				<div class="pool rounded-btn flex flex-col gap-2 min-w-[100px] sm:min-w-[300px] w-full max-w-[800px]">
					<div
						class="flex justify-between cursor-pointer select-none"
						on:click={() => (selcetdOrder = selcetdOrder === limitOrder.orderId ? undefined : limitOrder.orderId)}
						on:keydown
					>
						<span class="name text-lg font-bold text-bold mb-0">
							Listed
							{#if limitOrder.isDirectionFromArc200ToAlgo}
								{Number(limitOrder.arc200Amount) / limitOrder.arc200Token.unit}
								{limitOrder.arc200Token.ticker} for {(Number(limitOrder.algoAmount) / 1e6).toLocaleString('en')} VOI
							{:else}
								{(Number(limitOrder.algoAmount) / 1e6).toLocaleString('en')} VOI for {Number(limitOrder.arc200Amount) /
									limitOrder.arc200Token.unit}
								{limitOrder.arc200Token.ticker}
							{/if}
						</span>
					</div>
					<span class="flex flex-wrap justify-end" />
				</div>
				<div
					class="pool rounded-btn flex flex-col items-center overflow-hidden gap-2 min-w-[100px] sm:min-w-[300px] w-full max-w-[800px] transition-all duration-200"
					style="height: {selcetdOrder === Number(limitOrder.orderId) ? '200' : '0'}px;"
				>
					<div class="flex flex-col pt-4 gap-2 w-full max-w-[448px]">
						<label for=""
							>Enter {limitOrder.isDirectionFromArc200ToAlgo ? 'VOI' : limitOrder.arc200Token.ticker} amount</label
						>
						<input
							type="number"
							placeholder="Enter {limitOrder.isDirectionFromArc200ToAlgo
								? 'VOI'
								: limitOrder.arc200Token.ticker} amount"
							bind:value={amount}
							step={0.000001}
							required
							class="input input-primary input-bordered w-full focus:outline-none"
						/>
						<div class="flex justify-center mt-2 pr-0">
							<button
								class="btn btn-primary w-full box-border"
								disabled={!isValid(amount, limitOrder)}
								class:btn-outline={!isValid(amount, limitOrder)}
								on:click={() => sell(amount, limitOrder)}
							>
								SELL
							</button>
						</div>

						{#if isValid(amount, limitOrder)}
							<div class="text-right">
								You will receive {Number(
									limitOrder.isDirectionFromArc200ToAlgo
										? (amount * Number(limitOrder.arc200Amount)) / Number(limitOrder.algoAmount)
										: (amount * Number(limitOrder.algoAmount)) / Number(limitOrder.arc200Amount)
								).toLocaleString('en')}
								{limitOrder.isDirectionFromArc200ToAlgo ? limitOrder.arc200Token.ticker : 'VOI'}
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>
</section>

<style lang="postcss">
	:global(html) {
		background-color: theme(colors.gray.100);
	}
</style>
