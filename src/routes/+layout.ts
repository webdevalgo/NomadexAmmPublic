import { browser } from '$app/environment';
import { Buffer } from 'buffer';
if (browser) {
    globalThis.global = globalThis;
    globalThis.Buffer = Buffer as unknown as typeof globalThis.Buffer;
}
export const prerender = false;
export const ssr = false;
