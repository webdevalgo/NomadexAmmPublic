import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export const isDarkTheme = writable<boolean>(browser ? localStorage.getItem('theme') === 'dark' : false);

isDarkTheme.subscribe((isDark) => {
	if (browser) {
		document.body?.setAttribute('data-theme', isDark ? 'dark' : 'light');
	}
});

export const lastActiveSwapPair = writable<string>();
export const lastActiveLimitOrderPair = writable<string>();
export const lastActiveAnalyticsPair = writable<string>();

lastActiveSwapPair.subscribe((state) => {
	if (state) {
		localStorage.setItem('LAST_ACTIVE_SWAP_PAIR', state);
	} else {
		const config = localStorage.getItem('LAST_ACTIVE_SWAP_PAIR');
		if (config) {
			lastActiveSwapPair.set(config);
		}
	}
});

lastActiveLimitOrderPair.subscribe((state) => {
	if (state) {
		localStorage.setItem('LAST_ACTIVE_LIMIT_ORDER_PAIR', state);
	} else {
		const config = localStorage.getItem('LAST_ACTIVE_LIMIT_ORDER_PAIR');
		if (config) {
			lastActiveLimitOrderPair.set(config);
		}
	}
});

lastActiveAnalyticsPair.subscribe((state) => {
	if (state) {
		localStorage.setItem('LAST_ACTIVE_ANALYTICS_PAIR', state);
	} else {
		const config = localStorage.getItem('LAST_ACTIVE_ANALYTICS_PAIR');
		if (config) {
			lastActiveAnalyticsPair.set(config);
		}
	}
});
