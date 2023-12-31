import algosdk from "algosdk";
import { currentAppId, currentLptAssetId } from "./_deployed";
import { getASABalance, getBoxName, getClient, getUnnamedResourcesAccessedFromMethod, nodeClient, viaAppId } from "./_shared";
import { get } from "svelte/store";
import { connectedAccount, signAndSendTransections } from "./UseWallet.svelte";
import { ChainInterface } from "./utils";
import { addNotification } from "./Notify.svelte";

export default class ContractMethods {
    async swapVoiToVia(voiAmount: number, minViaAmount: number) {
        const suggestedParams = await nodeClient.getTransactionParams().do();
        const client = getClient(currentAppId);

        const swapArgs = () => ({
            pay_txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                amount: voiAmount,
                from: get(connectedAccount),
                to: algosdk.getApplicationAddress(currentAppId),
                suggestedParams: suggestedParams,
            }),
            min_amount: minViaAmount
        });

        const composer = client.compose();
        const atc = await composer
            .swapToArc200(swapArgs(), await getUnnamedResourcesAccessedFromMethod(client, 'swapToArc200', swapArgs()))
            .atc();

        const swapTxns = atc.buildGroup().map(({ txn }) => txn);

        await signAndSendTransections(nodeClient, [swapTxns]);
        console.log({ success: true });
    }

    async swapViaToVoi(viaAmount: number, minVoiAmount: number) {
        const client = getClient(currentAppId);

        const approveTxns = await ChainInterface.arc200_approve(
            viaAppId,
            get(connectedAccount),
            algosdk.getApplicationAddress(currentAppId),
            BigInt(viaAmount)
        );

        const swapArgs = () => ({
            arc200_amount: viaAmount,
            min_amount: minVoiAmount,
        });
        const composer = client.compose();

        const opts = await getUnnamedResourcesAccessedFromMethod(client, 'swapFromArc200', swapArgs());

        const atc = await composer
            .swapFromArc200(swapArgs(), {
                ...opts,
                boxes: [
                    ...opts.boxes,
                    {
                        appId: viaAppId,
                        name: getBoxName(algosdk.getApplicationAddress(currentAppId)),
                    },
                ],
            })
            .atc();

        const swapTxns = atc.buildGroup().map(({ txn }) => txn);

        await signAndSendTransections(nodeClient, [approveTxns, swapTxns]);
        console.log({ success: true });
    }


    async mint(amountA: number, amountB: number) {
        const suggestedParams = await nodeClient.getTransactionParams().do();
        const client = getClient(currentAppId);
        const voiAmount = Math.floor(amountA * 1e6);
        const viaAmount = Math.floor(amountB * 1e6);

        const lptBalance = await getASABalance(currentLptAssetId, get(connectedAccount));
        console.log({ lptBalance });

        const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
            from: get(connectedAccount),
            to: get(connectedAccount),
            amount: 0,
            assetIndex: currentLptAssetId,
            suggestedParams,
        });

        const approveTxns = await ChainInterface.arc200_approve(
            viaAppId,
            get(connectedAccount),
            algosdk.getApplicationAddress(currentAppId),
            BigInt(viaAmount)
        );

        const mintArgs = () => ({
            pay_txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                amount: voiAmount,
                from: get(connectedAccount),
                to: algosdk.getApplicationAddress(currentAppId),
                suggestedParams: suggestedParams,
            }),
            arc200_amount: viaAmount,
            pool_token: currentLptAssetId,
        });
        const composer = client.compose();

        const opts = await getUnnamedResourcesAccessedFromMethod(client, 'mint', mintArgs());

        const atc = await composer
            .mint(mintArgs(), {
                ...opts,
                boxes: [
                    ...opts.boxes,
                    {
                        appId: viaAppId,
                        name: getBoxName(algosdk.getApplicationAddress(currentAppId)),
                    },
                ],
            })
            .atc();

        const mintTxns = atc.buildGroup().map(({ txn }) => txn);

        await signAndSendTransections(nodeClient, [...(lptBalance === -1 ? [[optInTxn]] : []), approveTxns, mintTxns]);

        console.log({ success: true });
    }

    async burn(amount: number) {
        const suggestedParams = await nodeClient.getTransactionParams().do();
        const client = getClient(currentAppId);

        const lptAmount = Math.floor(amount * 1e6);

        const removeLiqArgs = () => ({
            lpt_pay_txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                assetIndex: currentLptAssetId,
                amount: lptAmount,
                from: get(connectedAccount),
                to: algosdk.getApplicationAddress(currentAppId),
                suggestedParams: suggestedParams,
            }),
        });

        const composer = client.compose();

        const atc = await composer
            .burn(removeLiqArgs(), await getUnnamedResourcesAccessedFromMethod(client, 'burn', removeLiqArgs()))
            .atc();

        const burnTxns = atc.buildGroup().map(({ txn }) => txn);

        await signAndSendTransections(nodeClient, [burnTxns]);
        console.log({ success: true });
    }

    static async call<M extends keyof ContractMethods>(functionName: M, ...args: Parameters<ContractMethods[M]>) {
        const removeNot = addNotification('pending', `Txn in progress`)
        const instance = new ContractMethods();
        try {
            const resp = await instance[<string>functionName](...args);
            addNotification('success', `Success`, 3000);
            removeNot();
            return resp;
        } catch (error) {
            console.error((<Error>error).message);
            addNotification('error', (<Error>error).message, 10000);
        }
        removeNot();
    }
}
