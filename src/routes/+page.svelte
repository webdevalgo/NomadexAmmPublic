<script lang="ts">
	import { knownPools } from '$lib';
	import PoolInfo from '$lib/PoolInfo.svelte';
	import PoolPosition from '$lib/PoolPosition.svelte';

	let hasPosition = false;
	let showMore = false;
</script>

<section class="p-4">
	<br />
	<br />
	<div class="flex flex-col justify-center items-center gap-2 pt-6">
		<h4 class="text-xl font-bold prose w-full mb-5">Liquidity Pools</h4>
		{#each $knownPools.slice(0, showMore ? 1_000 : 5) as pool}
			<PoolInfo {pool} />
		{/each}
		{#if !showMore}
			<button class="btn btn-ghost btn-sm" on:click={() => (showMore = !showMore)}>Show More</button>
		{/if}
	</div>
	<br />
	<div
		class="flex flex-col justify-center items-center gap-2 pt-6 transition-opacity duration-200"
		style={hasPosition ? 'opacity: 1;' : 'opacity: 0;margin-top:-3rem;height: 0 !important;overflow: 0;'}
	>
		<h4 class="text-xl font-bold prose w-full mb-5">Your Positions</h4>
		{#each $knownPools as pool}
			<PoolPosition {pool} exists={() => (hasPosition = true)} />
		{/each}
	</div>
</section>

<style lang="postcss">
	:global(html) {
		background-color: theme(colors.gray.100);
	}
</style>
