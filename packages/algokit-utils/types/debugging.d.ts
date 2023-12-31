import algosdk from 'algosdk';
import { PersistSourceMapsParams, SimulateAndPersistResponseParams } from './types/debugging';
/**
 * This function persists the source maps for the given sources.
 *
 * @param sources An array of PersistSourceMapInput objects. Each object can either contain rawTeal, in which case the function will execute a compile to obtain byte code, or it can accept an object of type CompiledTeal provided by algokit, which is used for source codes that have already been compiled and contain the traces.
 * @param projectRoot The root directory of the project.
 * @param client An Algodv2 client to perform the compilation.
 * @param withSources A boolean indicating whether to include the source files in the output.
 *
 * @returns A promise that resolves when the source maps have been persisted.
 */
export declare function persistSourceMaps({ sources, projectRoot, client, withSources }: PersistSourceMapsParams): Promise<void>;
/**
 * This function simulates the atomic transactions using the provided `AtomicTransactionComposer` object and `Algodv2` object,
 * and persists the simulation response to an AlgoKit AVM Debugger compliant JSON file.
 *
 * @param atc The AtomicTransactionComposer with transaction(s) loaded.
 * @param algod An Algod client to perform the simulation.
 * @param projectRoot The root directory of the project.
 * @param bufferSizeMb The buffer size in megabytes.
 *
 * @returns The simulation result, which includes various details about how the transactions would be processed.
 *
 * @example
 * const atc = new AtomicTransactionComposer();
 * const algod = new algosdk.Algodv2(token, server, port);
 * const projectRoot = '/path/to/project';
 * const bufferSizeMb = 10;
 *
 * const result = await simulateAndPersistResponse({ atc, projectRoot, algod, bufferSizeMb });
 * console.log(result);
 */
export declare function simulateAndPersistResponse({ atc, projectRoot, algod, bufferSizeMb }: SimulateAndPersistResponseParams): Promise<algosdk.modelsv2.SimulateResponse>;
//# sourceMappingURL=debugging.d.ts.map