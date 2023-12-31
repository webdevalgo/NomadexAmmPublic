import algosdk from 'algosdk';
import { getDispenserAccount, microAlgos } from './index.js';
import { isTestNet } from './network-client.js';
import { encodeLease, encodeTransactionNote, getSenderAddress, getTransactionParams, sendTransaction } from './transaction.js';
import { TestNetDispenserApiClient } from './types/dispenser-client.js';
import { calculateFundAmount } from './util.js';
async function fundUsingDispenserApi(dispenserClient, addressToFund, fundAmount) {
    const response = await dispenserClient.fund(addressToFund, fundAmount);
    return { transactionId: response.txId, amount: response.amount };
}
async function fundUsingTransfer({ algod, addressToFund, funding, fundAmount, transactionParams, sendParams, note, kmd, }) {
    if (funding.fundingSource instanceof TestNetDispenserApiClient) {
        throw new Error('Dispenser API client is not supported in this context.');
    }
    const from = funding.fundingSource ?? (await getDispenserAccount(algod, kmd));
    const amount = microAlgos(Math.max(fundAmount, funding.minFundingIncrement?.microAlgos ?? 0));
    const response = await transferAlgos({
        from,
        to: addressToFund,
        note: note ?? 'Funding account to meet minimum requirement',
        amount: amount,
        transactionParams: transactionParams,
        lease: funding.lease,
        ...sendParams,
    }, algod);
    return {
        transactionId: response.transaction.txID(),
        amount: Number(response.transaction.amount),
    };
}
/**
 * Transfer ALGOs between two accounts.
 * @param transfer The transfer definition
 * @param algod An algod client
 * @returns The transaction object and optionally the confirmation if it was sent to the chain (`skipSending` is `false` or unset)
 *
 * @example Usage example
 * ```typescript
 * await algokit.transferAlgos({ from, to, amount: algokit.algos(1) }, algod)
 * ```
 */
export async function transferAlgos(transfer, algod) {
    const { from, to, amount, note, transactionParams, lease, ...sendParams } = transfer;
    const transaction = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: getSenderAddress(from),
        to: getSenderAddress(to),
        amount: amount.microAlgos,
        note: encodeTransactionNote(note),
        suggestedParams: await getTransactionParams(transactionParams, algod),
        closeRemainderTo: undefined,
        rekeyTo: undefined,
    });
    const encodedLease = encodeLease(lease);
    if (encodedLease) {
        transaction.addLease(encodedLease);
    }
    return sendTransaction({ transaction, from, sendParams }, algod);
}
/**
 * Funds a given account using a funding source such that it has a certain amount of algos free to spend (accounting for ALGOs locked in minimum balance requirement).
 *
 * https://developer.algorand.org/docs/get-details/accounts/#minimum-balance
 *
 * @param funding The funding configuration of type `EnsureFundedParams`, including the account to fund, minimum spending balance, and optional parameters. If you set `useDispenserApi` to true, you must also set `ALGOKIT_DISPENSER_ACCESS_TOKEN` in your environment variables.
 * @param algod An instance of the Algodv2 client.
 * @param kmd An optional instance of the Kmd client.
 * @returns
 * - `EnsureFundedReturnType` if funds were transferred.
 * - `undefined` if no funds were needed.
 */
export async function ensureFunded(funding, algod, kmd) {
    const { accountToFund, fundingSource, minSpendingBalance, minFundingIncrement, transactionParams, note, ...sendParams } = funding;
    const addressToFund = typeof accountToFund === 'string' ? accountToFund : getSenderAddress(accountToFund);
    const accountInfo = await algod.accountInformation(addressToFund).do();
    const balance = Number(accountInfo.amount);
    const minimumBalanceRequirement = microAlgos(Number(accountInfo['min-balance']));
    const currentSpendingBalance = microAlgos(balance - minimumBalanceRequirement.microAlgos);
    const fundAmount = calculateFundAmount(minSpendingBalance.microAlgos, currentSpendingBalance.microAlgos, minFundingIncrement?.microAlgos ?? 0);
    if (fundAmount !== null) {
        if ((await isTestNet(algod)) && fundingSource instanceof TestNetDispenserApiClient) {
            return await fundUsingDispenserApi(fundingSource, addressToFund, fundAmount);
        }
        else {
            return await fundUsingTransfer({
                algod,
                addressToFund,
                funding,
                fundAmount,
                transactionParams,
                sendParams,
                note,
                kmd,
            });
        }
    }
    return undefined;
}
/**
 * Transfer asset between two accounts.
 * @param transfer The transfer definition
 * @param algod An algod client
 * @returns The transaction object and optionally the confirmation if it was sent to the chain (`skipSending` is `false` or unset)
 *
 * @example Usage example
 * ```typescript
 * await algokit.transferAsset({ from, to, assetId, amount }, algod)
 * ```
 */
export async function transferAsset(transfer, algod) {
    const { from, to, assetId, amount, transactionParams, clawbackFrom, note, lease, ...sendParams } = transfer;
    const transaction = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: getSenderAddress(from),
        to: getSenderAddress(to),
        closeRemainderTo: undefined,
        revocationTarget: clawbackFrom ? getSenderAddress(clawbackFrom) : undefined,
        amount: amount,
        note: encodeTransactionNote(note),
        assetIndex: assetId,
        suggestedParams: await getTransactionParams(transactionParams, algod),
        rekeyTo: undefined,
    });
    const encodedLease = encodeLease(lease);
    if (encodedLease) {
        transaction.addLease(encodedLease);
    }
    return sendTransaction({ transaction, from, sendParams }, algod);
}
/**
 * Rekey an account to a new address.
 *
 * **Note:** Please be careful with this function and be sure to read the [official rekey guidance](https://developer.algorand.org/docs/get-details/accounts/rekey/).
 *
 * @param rekey The rekey definition
 * @param algod An algod client
 * @returns The transaction object and optionally the confirmation if it was sent to the chain (`skipSending` is `false` or unset)
 *
 * @example Usage example
 * ```typescript
 * await algokit.rekeyAccount({ from, rekeyTo }, algod)
 * ```
 */
export async function rekeyAccount(rekey, algod) {
    const { from, rekeyTo, note, transactionParams, lease, ...sendParams } = rekey;
    const transaction = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: getSenderAddress(from),
        to: getSenderAddress(from),
        rekeyTo: getSenderAddress(rekeyTo),
        amount: 0,
        note: encodeTransactionNote(note),
        suggestedParams: await getTransactionParams(transactionParams, algod),
        closeRemainderTo: undefined,
    });
    const encodedLease = encodeLease(lease);
    if (encodedLease) {
        transaction.addLease(encodedLease);
    }
    return sendTransaction({ transaction, from, sendParams }, algod);
}
//# sourceMappingURL=transfer.js.map