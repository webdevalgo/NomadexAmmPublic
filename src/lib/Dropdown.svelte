<script lang="ts">
	type Option = { name: string; value: any };
	export let options: Option[] = [];
	export let firstSelected = true;
	export let selected: Option | undefined = firstSelected ? options[0] : undefined;
	export let selectedValue: any = selected?.value;
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

<details class="dropdown dropdown-content dropdown-bottom dropdown-end" bind:this={dropdownElement}>
	<summary class="m-1 btn {className}">{selected?.name || 'None'}</summary>
	<ul class="p-2 shadow menu dropdown-content z-[1] bg-base-100 rounded-box w-52">
		{#each options as opt}
			<li on:keydown={null} on:click={handleOptClick(opt)}>
				<span>{opt.name}</span>
			</li>
		{/each}
	</ul>
</details>
