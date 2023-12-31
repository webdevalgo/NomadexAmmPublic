export enum TokenType {
    Default = '',
    ASA = 'asa',
    ARC200 = 'arc200'
}

export type Token = {
    ticker: string;
    id: number,
    type: TokenType;
};

export const knownTokens: Token[] = [
    { ticker: 'VOI', id: 0, type: TokenType.Default },
    { ticker: 'VIA', id: 6779767, type: TokenType.ARC200 },
    // { ticker: 'VRC200', id: 6778021, type: TokenType.ARC200 },
    // { ticker: 'Voice', id: 23218271, type: TokenType.ARC200 },
];

export const knownPools = [];