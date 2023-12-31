import algosdk from 'algosdk';
import { AssetBulkOptInOutParams, AssetOptInParams, AssetOptOutParams } from './types/asset';
import { SendTransactionResult } from './types/transaction';
import Algodv2 = algosdk.Algodv2;
/**
 * Opt-in an account to an asset.
 * @param optIn The opt-in definition
 * @param algod An algod client
 * @returns The transaction object and optionally the confirmation if it was sent to the chain (`skipSending` is `false` or unset)
 *
 * @example Usage example
 * ```typescript
 * await algokit.assetOptIn({ account, assetId }, algod)
 * ```
 */
export declare function assetOptIn(optIn: AssetOptInParams, algod: Algodv2): Promise<SendTransactionResult>;
/**
 * Opt-out an account from an asset.
 * @param optOut The opt-in definition
 * @param algod An algod client
 * @returns The transaction object and optionally the confirmation if it was sent to the chain (`skipSending` is `false` or unset)
 *
 * @example Usage example
 * ```typescript
 * await algokit.assetOptOut({ account, assetId, assetCreatorAddress }, algod)
 * ```
 */
export declare function assetOptOut(optOut: AssetOptOutParams, algod: Algodv2): Promise<SendTransactionResult>;
/**
 * Opt in to a list of assets on the Algorand blockchain.
 *
 * @param optIn - The bulk opt-in request.
 * @param algod - An instance of the Algodv2 class from the `algosdk` library.
 * @returns A record object where the keys are the asset IDs and the values are the corresponding transaction IDs for successful opt-ins.
 * @throws If there is an error during the opt-in process.
 * @example algokit.bulkOptIn({ account: account, assetIds: [12345, 67890] }, algod)
 */
export declare function assetBulkOptIn(optIn: AssetBulkOptInOutParams, algod: Algodv2): Promise<Record<number, string>>;
/**
 * Opt out of multiple assets in Algorand blockchain.
 *
 * @param optOut The bulk opt-out request.
 * @param algod - An instance of the Algodv2 client used to interact with the Algorand blockchain.
 * @returns A record object containing asset IDs as keys and their corresponding transaction IDs as values.
 * @throws If there is an error during the opt-out process.
 * @example algokit.bulkOptOut({ account: account, assetIds: [12345, 67890] }, algod)
 */
export declare function assetBulkOptOut(optOut: AssetBulkOptInOutParams, algod: Algodv2): Promise<Record<number, string>>;
//# sourceMappingURL=asset.d.ts.map