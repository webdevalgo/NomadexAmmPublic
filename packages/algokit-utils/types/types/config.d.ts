import { Logger } from './logging';
/** The AlgoKit configuration type */
export interface Config {
    /** Logger */
    logger: Logger;
    /** Whether or not debug mode is enabled */
    debug: boolean;
    /** The path to the project root directory */
    projectRoot: string | null;
    /** Indicates whether to trace all operations */
    traceAll: boolean;
    /** The size of the trace buffer in megabytes */
    traceBufferSizeMb: number;
    /** The maximum depth to search for a specific file */
    maxSearchDepth: number;
}
/** Updatable AlgoKit config */
export declare class UpdatableConfig implements Readonly<Config> {
    private config;
    get logger(): Logger;
    get debug(): boolean;
    get projectRoot(): string | null;
    get traceAll(): boolean;
    get traceBufferSizeMb(): number;
    get maxSearchDepth(): number;
    /**
     * Returns the current logger, or the null logger if true is passed in to `returnNullLogger`
     * @param returnNullLogger Whether or not to return the null logger
     * @returns The requested logger
     */
    getLogger(returnNullLogger?: boolean): Logger;
    /**
     * Temporarily run with debug set to true.
     * @param lambda A lambda expression with code to run with debug config set to true
     */
    withDebug(lambda: () => unknown): void;
    constructor();
    /**
     * Configures the project root by searching for a specific file within a depth limit.
     * This is only supported in a Node environment.
     */
    private configureProjectRoot;
    /**
     * Update the AlgoKit configuration with your own configuration settings
     * @param newConfig Partial or complete config to replace
     */
    configure(newConfig: Partial<Config>): void;
}
//# sourceMappingURL=config.d.ts.map