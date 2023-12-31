<script lang="ts">
	import { goto } from '$app/navigation';
	import { knownTokens } from '$lib';
	import { onMount } from 'svelte';

	onMount(() => {
		goto(`/liquidity/${knownTokens[0].ticker}-${knownTokens[1].ticker}`, { replaceState: true });
	});
</script>
