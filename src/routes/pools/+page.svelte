<script lang="ts">
	import { type Token, knownTokens } from '$lib';
	import { currentAppId } from '$lib/_deployed';
	import { balanceString, getArc200Balance, getBalance, viaAppId } from '$lib/_shared';
	import algosdk from 'algosdk';

	let pools: [Token, Token][] = [[knownTokens[0], knownTokens[1]]];

	async function loadLiq(): Promise<[number, number]> {
		const voiBalance = await getBalance(algosdk.getApplicationAddress(currentAppId));
		const viaBalance = await getArc200Balance(viaAppId, algosdk.getApplicationAddress(currentAppId));
		return [voiBalance, viaBalance];
	}
</script>

<div class="p-12 grid grid-cols-[repeat(auto-fit,minmax(350px,1fr))] justify-start items-stretch gap-2 pt-20">
	{#each pools as pool}
		<div class="grid min-h-20 card bg-base-300 text-base-content place-items-center rounded-btn max-w-[600px]">
			<div class="w-full flex justify-between items-center py-2 px-4">
				<span class="text-md font-[500]">{pool[0].ticker} / {pool[1].ticker}</span>
				<span class="text-sm hidden lg:inline-block">
					{#await balanceString(currentAppId, viaAppId)}
						<span class="loading w-[1rem]" />
					{:then str}
						{str}
					{/await}
				</span>
				<div class="flex gap-2">
					<a href="/swap/{pool[0].ticker}-{pool[1].ticker}" class="btn btn-ghost text-base-content btn-sm">Swap</a>
					<a href="/liquidity/{pool[0].ticker}-{pool[1].ticker}/add" class="btn btn-ghost text-base-content btn-sm">
						Add Liquidity
					</a>
				</div>
			</div>
		</div>
	{/each}
</div>
