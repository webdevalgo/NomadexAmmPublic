import { knownPools } from "$lib";
import { get } from "svelte/store";

export function getLastActivePair(pair: string) {
    const defaultPair = `VOI-${get(knownPools)[0].arc200Asset.symbol}`;
    if (!pair) {
        return defaultPair;
    }
    const pools = pair
        .split('-')
        .map((sym) => get(knownPools).find((pool) => pool.arc200Asset.symbol === sym))
        .filter((pool) => pool);
    if (pools.length) {
        return pair;
    }
    return defaultPair;
}