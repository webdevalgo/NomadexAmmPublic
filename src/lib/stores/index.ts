import { browser } from "$app/environment";
import { writable } from "svelte/store";

export const isDarkTheme = writable<boolean>(browser ? localStorage.getItem('theme') === 'dark' : false);

isDarkTheme.subscribe(isDark => {
    if (browser) {
        document.body?.setAttribute('data-theme', isDark ? 'dark' : 'light');
    }
});