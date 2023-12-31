<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(async () => {
		let timeout: NodeJS.Timeout;
		const searchParams = new URLSearchParams(location.search);
		if (searchParams.has('from') && searchParams.has('at')) {
			const from = searchParams.get('from');
			const at = Number(searchParams.get('at') ?? '0');
			if (from && at && Date.now() - at > 1000) {
				goto(from, { replaceState: true });
			}
		}
	});
</script>

<section class="flex justify-center items-center h-full">
	<span class="loading text-primary" />
</section>
