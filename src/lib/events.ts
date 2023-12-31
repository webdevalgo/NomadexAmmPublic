import { sha512_256 } from "js-sha512";
import { indexerClient } from "./_shared";
import algosdk from "algosdk";

export type SwapTxn = {
    "close-rewards": number,
    "closing-amount": number,
    "confirmed-round": number,
    "created-application-index": number,
    "fee": number,
    "id": string,
    "intra-round-offset": number,
    "receiver-rewards": number,
    "round-time": number,
    "sender": string,
    "sender-rewards": number,
    "signature": { "sig": string },
    "tx-type": string,
    logs?: string[]
}

interface CacheStructure {
    lastRound: number,
    txns: SwapTxn[],
}


export class SwapEvents {
    static setCache(update: CacheStructure, signature: string) {
        localStorage.setItem(signature, JSON.stringify(update));
    }

    static getCache(signature: string): CacheStructure {
        const cache = localStorage.getItem(signature);
        if (cache) {
            return <CacheStructure>JSON.parse(cache);
        }
        return { lastRound: 2000000, txns: [] };
    }


    static async loadTxnsByEvent(appId: number, event: string) {
        const signature = sha512_256(event).slice(0, 8);
        const cache = SwapEvents.getCache(signature);

        const LIMIT = 1000;
        let next: string | undefined;

        do {
            let req = await indexerClient
                .searchForTransactions()
                .applicationID(appId)
                .minRound(cache.lastRound + 1);

            if (LIMIT) req = req.limit(LIMIT);
            if (next) req = req.nextToken(next);

            const resp = await req.do();

            if (resp['transactions'] instanceof Array) {
                const batch: SwapTxn[] = resp['transactions'];
                const filteredTxns = batch
                    .filter(txn => !cache.txns.find(cTxn => cTxn.id === txn.id))
                    .filter(txn => txn.logs?.length && txn.logs.find(log => Buffer.from(log, 'base64').toString('hex').startsWith(signature)))
                cache.txns.push(...filteredTxns);
            }

            if (resp['transactions'].length < LIMIT) {
                next = undefined;
            } else {
                next = resp['next-token'];
            }
        } while (next);
        for (const txn of cache.txns) {
            if (typeof txn["confirmed-round"] === "number") {
                cache.lastRound = Math.max(cache.lastRound, txn["confirmed-round"]);
            }
        }

        SwapEvents.setCache(cache, signature);

        return cache.txns.map(txn => {
            const logs = (txn.logs ?? []).map(log => Buffer.from(log, 'base64').toString('hex'));
            const filteredLogs = logs.filter(log => log.startsWith(signature))
            try {
                const events = filteredLogs.map(log => {
                    const argsAbiType = algosdk.ABITupleType.from(event.replace(/^\w+/, ''));
                    return argsAbiType.decode(Uint8Array.from(Buffer.from(log.slice(8), 'hex')))
                });
                return { ...txn, events: { [event]: events } };
            } catch (error) {
                console.error((<Error>error).message);
            }
            return { ...txn, events: <Record<string, algosdk.ABIValue[]>>{} };
        });
    }
}