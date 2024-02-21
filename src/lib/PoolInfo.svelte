<script lang="ts">
	import type { Pool } from '$lib';
	import algosdk from 'algosdk';
	import { onChainStateWatcher, watchArc200Balance, watchPoolTotalSupply } from './stores/onchain';
	import { convertDecimals } from './numbers';

	export let pool: Pool;

	const poolState = onChainStateWatcher.getAccountWatcher(algosdk.getApplicationAddress(pool.poolId));
	const poolArc200Balance = watchArc200Balance(pool.arc200Asset.assetId, algosdk.getApplicationAddress(pool.poolId));
	const poolTotalSupply = watchPoolTotalSupply(pool.poolId);
</script>

<div class="pool bg-base-200 p-4 rounded-btn flex flex-col gap-2 min-w-[100px] sm:min-w-[300px] w-full max-w-[800px]">
	<div class="flex justify-between">
		<span class="name text-lg">VOI / {pool.arc200Asset.symbol}</span>
		<span class="">
			{#if ($poolTotalSupply ?? 0n) > 0n}
				{#if $poolArc200Balance}
					<span class="">
						{($poolState.amount / 1e6).toLocaleString('en')} VOI
					</span>
					/
					<span class="">
						{(Number(convertDecimals($poolArc200Balance, pool.arc200Asset.decimals, 6)) / 1e6).toLocaleString('en')}
						{pool.arc200Asset.symbol}
					</span>
				{:else}
					<span class="loading w-[1rem]" />
				{/if}
			{/if}
		</span>
	</div>
	<span class="flex flex-wrap justify-end">
		<a href="/swap/VOI-{pool.arc200Asset.symbol}" class="btn btn-ghost text-base-content btn-sm">Swap</a>
		<a href="/liquidity/VOI-{pool.arc200Asset.symbol}/add" class="btn btn-ghost text-base-content btn-sm"> Add Liq. </a>
		<a href="/liquidity/VOI-{pool.arc200Asset.symbol}/remove" class="btn btn-ghost text-base-content btn-sm">
			Remove Liq.
		</a>
	</span>
</div>
