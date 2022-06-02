import { JsonFileMetaData } from './common/json-file.js';

declare type LiquidityVersion = 4 | 5;
interface LiquidityPoolBaseInfo {
    readonly id: string;
    readonly lp: LpTokenInfo;
}
interface LiquidityPoolJsonInfo {
    readonly id: string;
    readonly baseMint: string;
    readonly quoteMint: string;
    readonly lpMint: string;
    readonly version: number;
    readonly programId: string;
    readonly authority: string;
    readonly baseVault: string;
    readonly quoteVault: string;
    readonly lpVault: string;
    readonly openOrders: string;
    readonly targetOrders: string;
    readonly withdrawQueue: string;
    readonly marketVersion: number;
    readonly marketProgramId: string;
    readonly marketId: string;
    readonly marketAuthority: string;
    readonly marketBaseVault: string;
    readonly marketQuoteVault: string;
    readonly marketBids: string;
    readonly marketAsks: string;
    readonly marketEventQueue: string;
}
interface LiquidityPoolsJsonFile extends JsonFileMetaData {
    readonly official: LiquidityPoolJsonInfo[];
    readonly unOfficial: LiquidityPoolJsonInfo[];
}

interface NativeTokenInfo {
    readonly symbol: string;
    readonly name: string;
    readonly decimals: number;
}
declare type ExtensionKey = "coingeckoId" | "website" | "whitepaper";
declare type Extensions = {
    [key in ExtensionKey]?: string;
};
interface SplTokenInfo extends NativeTokenInfo {
    readonly mint: string;
    readonly extensions: Extensions;
}
declare type SplTokens = {
    [Symbol.iterator](): IterableIterator<SplTokenInfo>;
} & {
    [T in string]: SplTokenInfo;
};
interface LpTokenInfo extends NativeTokenInfo {
    readonly mint: string;
    readonly base: SplTokenInfo;
    readonly quote: SplTokenInfo;
    readonly version: LiquidityVersion;
}
declare type LpTokens = {
    [Symbol.iterator](): IterableIterator<LpTokenInfo>;
} & {
    [T in string]: LpTokenInfo;
};
interface SplTokenJsonInfo {
    readonly symbol: string;
    readonly name: string;
    readonly mint: string;
    readonly decimals: number;
    readonly extensions: Extensions;
}
interface LpTokenJsonInfo {
    readonly symbol: string;
    readonly name: string;
    readonly mint: string;
    readonly base: string;
    readonly quote: string;
    readonly decimals: number;
    readonly version: LiquidityVersion;
}
declare type SplTokensJsonInfo = {
    [Symbol.iterator](): IterableIterator<SplTokenJsonInfo>;
} & {
    [T in string]: SplTokenJsonInfo;
};
declare type LpTokensJsonInfo = {
    [Symbol.iterator](): IterableIterator<LpTokenJsonInfo>;
} & {
    [T in string]: LpTokenJsonInfo;
};
interface TokensJsonFile extends JsonFileMetaData {
    readonly spl: SplTokensJsonInfo;
    readonly lp: LpTokensJsonInfo;
}

export { ExtensionKey as E, LiquidityVersion as L, NativeTokenInfo as N, SplTokenInfo as S, TokensJsonFile as T, LiquidityPoolBaseInfo as a, LiquidityPoolJsonInfo as b, LiquidityPoolsJsonFile as c, Extensions as d, SplTokens as e, LpTokenInfo as f, LpTokens as g, SplTokenJsonInfo as h, LpTokenJsonInfo as i, SplTokensJsonInfo as j, LpTokensJsonInfo as k };
