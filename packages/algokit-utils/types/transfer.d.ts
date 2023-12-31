import algosdk from 'algosdk';
import { SendTransactionResult } from './types/transaction';
import { AlgoRekeyParams, AlgoTransferParams, EnsureFundedParams, EnsureFundedReturnType, TransferAssetParams } from './types/transfer';
import Algodv2 = algosdk.Algodv2;
import Kmd = algosdk.Kmd;
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
export declare function transferAlgos(transfer: AlgoTransferParams, algod: Algodv2): Promise<SendTransactionResult>;
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
export declare function ensureFunded<T extends EnsureFundedParams>(funding: T, algod: Algodv2, kmd?: Kmd): Promise<EnsureFundedReturnType | undefined>;
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
export declare function transferAsset(transfer: TransferAssetParams, algod: Algodv2): Promise<SendTransactionResult>;
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
export declare function rekeyAccount(rekey: AlgoRekeyParams, algod: Algodv2): Promise<SendTransactionResult>;
//# sourceMappingURL=transfer.d.ts.map