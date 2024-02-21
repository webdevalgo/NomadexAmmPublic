<script lang="ts">
	import type { Pool } from '$lib';
	import { connectedAccount } from './UseWallet.svelte';
	import { watchArc200Balance, watchPoolTotalSupply } from './stores/onchain';

	export let pool: Pool;
	export let exists = () => {};

	const balance = watchArc200Balance(pool.poolId, $connectedAccount);
	const totalSupply = watchPoolTotalSupply(pool.poolId);

	$: $balance && $totalSupply && exists();
</script>

{#if $balance && $totalSupply}
	<div class="pool bg-base-200 p-4 rounded-btn flex flex-col gap-2 min-w-[100px] sm:min-w-[300px] w-full max-w-[800px]">
		<div class="flex justify-between">
			<span class="name text-lg">VOI / {pool.arc200Asset.symbol}</span>
			<span class="" />
			<span>
				{(Number(($balance * BigInt(10_000)) / $totalSupply) / 100).toLocaleString('en')}% Share
			</span>
		</div>
		<span class="flex flex-wrap justify-end">
			<a href="/liquidity/VOI-{pool.arc200Asset.symbol}/add" class="btn btn-ghost text-base-content btn-sm">
				Add Liq.
			</a>
			<a href="/liquidity/VOI-{pool.arc200Asset.symbol}/remove" class="btn btn-ghost text-base-content btn-sm">
				Remove Liq.
			</a>
		</span>
	</div>
{/if}
