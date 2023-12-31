import algosdk from 'algosdk';
import { CompiledTeal } from './app';
export interface AVMDebuggerSourceMapDict {
    'txn-group-sources': Array<{
        'sourcemap-location': string;
        hash: string;
    }>;
}
export declare class AVMDebuggerSourceMapEntry {
    location: string;
    programHash: string;
    constructor(location: string, programHash: string);
    equals(other: AVMDebuggerSourceMapEntry): boolean;
    toString(): string;
}
export declare class AVMDebuggerSourceMap {
    txnGroupSources: AVMDebuggerSourceMapEntry[];
    constructor(txnGroupSources: AVMDebuggerSourceMapEntry[]);
    static fromDict(data: AVMDebuggerSourceMapDict): AVMDebuggerSourceMap;
    toDict(): AVMDebuggerSourceMapDict;
}
/**
 * Class representing a debugger source maps input for persistence.
 *
 * Note: rawTeal and compiledTeal are mutually exclusive. Only one of them should be provided.
 */
export declare class PersistSourceMapInput {
    appName: string;
    compiledTeal?: CompiledTeal;
    private _fileName;
    private _rawTeal?;
    private constructor();
    static fromRawTeal(rawTeal: string, appName: string, fileName: string): PersistSourceMapInput;
    static fromCompiledTeal(compiledTeal: CompiledTeal, appName: string, fileName: string): PersistSourceMapInput;
    get rawTeal(): string;
    get fileName(): string;
    /**
     * Strips the '.teal' extension from a filename, if present.
     *
     * @param fileName - The filename to strip the extension from.
     * @returns The filename without the '.teal' extension.
     */
    private stripTealExtension;
}
export interface PersistSourceMapsParams {
    sources: PersistSourceMapInput[];
    projectRoot: string;
    client: algosdk.Algodv2;
    withSources?: boolean;
}
export interface SimulateAndPersistResponseParams {
    atc: algosdk.AtomicTransactionComposer;
    projectRoot: string;
    algod: algosdk.Algodv2;
    bufferSizeMb: number;
}
//# sourceMappingURL=debugging.d.ts.map