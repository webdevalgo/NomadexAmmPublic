<script lang="ts">
	type Option = { name: string; value: any };
	export let options: Option[] = [];
	export let firstSelected = true;
	export let selected: Option | undefined = firstSelected ? options[0] : undefined;
	export let selectedValue: any = selected?.value;
	export let displayPrefix = '';
	export let positon = 'bottom';
	export let onSelect = (value: any, option: Option) => {};
	let className = '';
	export { className as class };

	let dropdownElement: HTMLDetailsElement;

	$: selectedValue = selected?.value;

	function handleOptClick(opt: Option) {
		return () => {
			selected = { ...opt };
			dropdownElement.removeAttribute('open');
			onSelect(opt.value, opt);
		};
	}
</script>

<details class="dropdown dropdown-content dropdown-{positon} dropdown-end" bind:this={dropdownElement}>
	<summary class="m-1 btn {className}">{displayPrefix} {selected?.name || 'None'}</summary>
	{#if options?.length}
		<ul
			class="p-0 m-0 shadow menu dropdown-content z-[1] bg-base-100 rounded-box w-max border border-gray-500 list-none"
		>
			{#each options as opt}
				<li on:keydown={null} on:click={handleOptClick(opt)} class="border-b border-gray-500 w-full m-0 pl-0">
					<span>{opt.name}</span>
				</li>
			{/each}
		</ul>
	{/if}
</details>
