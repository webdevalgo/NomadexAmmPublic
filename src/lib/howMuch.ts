import type { Token } from "$lib";
import algosdk from "algosdk";
import { currentAppId } from "./_deployed";
import { getClient, getUnnamedResourcesAccessed, getUnnamedResourcesAccessedFromMethod } from "./_shared";
import { getTransactionSignerAccount } from "./UseWallet.svelte";

export async function simulateHowMuch(tokenA: Token, tokenB: Token, amount: bigint, simulateByOutAmount = false) {
    const client = getClient(currentAppId, getTransactionSignerAccount());

    let atc: algosdk.AtomicTransactionComposer | undefined = undefined;
    const compose = client.compose();

    if (tokenA.ticker === 'VOI' && tokenB.ticker === 'VIA') {
        if (simulateByOutAmount) {
            atc = await compose.computeSwapToArc200ByOutTokens(
                { arc200_amount: amount },
                await getUnnamedResourcesAccessedFromMethod(client, 'computeSwapToArc200ByOutTokens', { arc200_amount: amount })
            ).atc();
        } else {
            atc = await compose.computeSwapToArc200(
                { amount: amount },
                await getUnnamedResourcesAccessedFromMethod(client, 'computeSwapToArc200', { amount: amount })
            ).atc();
        }
    } else if (tokenA.ticker === 'VIA' && tokenB.ticker === 'VOI') {
        if (simulateByOutAmount) {
            atc = await compose.computeSwapFromArc200ByOutAmount(
                { amount: amount },
                await getUnnamedResourcesAccessedFromMethod(client, 'computeSwapFromArc200ByOutAmount', { amount: amount })
            ).atc();
        } else {
            atc = await compose.computeSwapFromArc200(
                { arc200_amount: amount },
                await getUnnamedResourcesAccessedFromMethod(client, 'computeSwapFromArc200', { arc200_amount: amount })
            ).atc();
        }
    }

    if (atc) {
        const txns = atc.buildGroup().map(({ txn }) => txn);

        const logs: any = (await getUnnamedResourcesAccessed(txns))
            .simulated
            .txnGroups
            .map(group => group.txnResults.map(txn => txn.txnResult.logs))
            ?.[0]
            ?.[0]
            ?.[0];

        if (logs) {
            return algosdk.ABIUintType.from('uint64').decode(logs.slice(-8));
        }
    }
    return 0
}