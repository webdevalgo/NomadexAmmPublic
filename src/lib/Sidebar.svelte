<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import UseWallet from './UseWallet.svelte';
	import SwapIcon from 'svelte-star/dist/md/MdAutorenew.svelte';
	import AnalyticsIcon from 'svelte-star/dist/md/MdShowChart.svelte';
	import MdPeopleOutline from 'svelte-star/dist/md/MdPeopleOutline.svelte';
	import MdMenu from 'svelte-star/dist/md/MdMenu.svelte';
	import { isDarkTheme, lastActiveAnalyticsPair, lastActiveSwapPair } from './stores';
	import { onMount } from 'svelte';
	import { knownPools } from '$lib';
	import { page } from '$app/stores';
	import MdToll from 'svelte-star/dist/md/MdToll.svelte';
	import MdAddCircle from 'svelte-star/dist/md/MdToll.svelte';
	import IoMdSwap from 'svelte-star/dist/io/IoMdSwap.svelte';
	import MdLaunch from 'svelte-star/dist/md/MdLaunch.svelte';
	import { getLastActivePair } from './config';
	import Logo from './Logo.svelte';

	let sidebarWidth = 0;
	let innerWidth = browser ? window.innerWidth : 0;
	let isMobile = innerWidth < 700;

	$: isMobile = innerWidth < 700;

	let sidebarOpen = browser ? (isMobile ? false : JSON.parse(localStorage.getItem('sidebar_open') ?? 'true')) : true;
	$: browser && localStorage.setItem('sidebar_open', sidebarOpen);

	let scrollY = 0;
	let init = false;

	onMount(() => {
		setTimeout(() => {
			init = true;
		});
	});
</script>

<svelte:window bind:scrollY bind:innerWidth />

<div
	class="sidebar drawer drawer-open max-w-min absolute md:relative bg-black"
	class:init
	bind:clientWidth={sidebarWidth}
	style="margin-left: -{sidebarOpen ? 0 : sidebarWidth}px;"
>
	<input id="my-drawer" type="checkbox" class="drawer-toggle" bind:checked={sidebarOpen} />
	<div class="drawer-content" />
	<label
		for="my-drawer"
		class="switch-drawer bg-base-300 border-none drawer-button flex"
		style="opacity: {(window.innerHeight * 0.5 - scrollY) / (window.innerHeight * 0.5)};"
		class:theme-dark={$isDarkTheme}
		class:open={sidebarOpen}
	>
		<span class="w-5 text-base-content scale-125 rotate-90"> <MdMenu /></span>
	</label>
	<div class="drawer-side">
		<label for="my-drawer" aria-label="close sidebar" class="drawer-overlay" />
		<ul class="menu p-4 w-72 min-h-full bg-base-300 text-base-content">
			<div
				class="h-32 mx-auto mb-5 cursor-pointer transition-all relative flex justify-center items-center opacity-80"
				on:click={() => goto('/')}
				on:click={() => isMobile && (sidebarOpen = false)}
				on:keydown
			>
				<div class="w-24 text-accent">
					<Logo />
				</div>
			</div>
			{#if $knownPools.length}
				<li class="pl-0 sm:block" class:active={$page.url.pathname === '/'}>
					<a class="flex justify-between" href="/" on:click={() => isMobile && (sidebarOpen = false)} tabindex="0">
						<span class="flex pt-[1px] justify-start items-end flex-grow w-full">POOLS</span>
						<span class="h-5 w-5"><MdToll /></span>
					</a>
				</li>
				<li class="pl-0" class:is-open={$page.url.pathname.startsWith('/swap/')}>
					<a
						class="flex justify-between items-center"
						href="/swap/{getLastActivePair($lastActiveSwapPair)}"
						tabindex="0"
					>
						<span class="flex pt-[1px] justify-start items-end w-full">SWAP</span>
						<span class="h-5 w-5"><SwapIcon /></span>
					</a>
				</li>
			{/if}
			<li class="pl-0 sm:block" class:active={$page.url.pathname.startsWith('/tokens')}>
				<a class="flex justify-between" href="/tokens/" on:click={() => isMobile && (sidebarOpen = false)} tabindex="0">
					<span class="flex pt-[1px] justify-start items-end flex-grow w-full">TOKENS</span>
					<span class="h-5 w-5 block rotate-[135deg]"><MdAddCircle /></span>
				</a>
			</li>
			<li class="pl-0 sm:block" class:active={$page.url.pathname.startsWith('/limit-orders')}>
				<a
					class="flex justify-between"
					href="/limit-orders/"
					on:click={() => isMobile && (sidebarOpen = false)}
					tabindex="0"
				>
					<span class="flex pt-[1px] justify-start items-end flex-grow w-full">LIMIT ORDERS</span>
					<span class="h-5 w-5"><IoMdSwap /></span>
				</a>
			</li>
			{#if $knownPools.length}
				<li class="pl-0 sm:block" class:is-open={$page.url.pathname.startsWith('/analytics/')}>
					<a class="flex justify-between" href="/analytics/{getLastActivePair($lastActiveAnalyticsPair)}" tabindex="0">
						<span class="flex pt-[1px] justify-start items-end flex-grow w-full">ANALYTICS</span>
						<span class="h-5 w-5"><AnalyticsIcon /></span>
					</a>
				</li>
			{/if}
			{#if $knownPools.length}
				<li class="pl-0 sm:block" class:is-open={$page.url.pathname.startsWith('/accounts')}>
					<a class="flex justify-between" href="/accounts" tabindex="0">
						<span class="flex pt-[1px] justify-start items-end flex-grow w-full">ACCOUNTS</span>
						<span class="h-5 w-5"><MdPeopleOutline /></span>
					</a>
				</li>
			{/if}
			{#if $knownPools.length}
				<li class="pl-0 sm:block">
					<a class="flex justify-between" href="https://v01.nomadex.app" target="_blank" tabindex="0">
						<span class="flex pt-[1px] justify-start items-end flex-grow w-full">NOMADEX v0.1</span>
						<span class="h-5 w-5"><MdLaunch /></span>
					</a>
				</li>
			{/if}
			<div class="h-full flex flex-col grow">&nbsp;</div>
			<UseWallet />
		</ul>
	</div>
</div>

<style lang="postcss">
	.sidebar {
		z-index: 10000;
	}
	.sidebar.init {
		transition: margin-left 400ms ease-in-out;
	}

	.switch-drawer {
		width: 2rem;
		height: 6rem;
		position: absolute;
		top: calc(50vh - 3rem);
		left: 18rem;
		border-top-right-radius: 1rem;
		border-bottom-right-radius: 1rem;
		display: flex;
		justify-content: center;
		align-items: center;
		cursor: pointer;
		@apply text-base-content;
	}

	li.active > a {
		background: var(--fallback-bc, oklch(var(--bc) / 0.1));
		font-weight: bold;
	}
	li.is-open > a {
		font-weight: bold;
	}
</style>
