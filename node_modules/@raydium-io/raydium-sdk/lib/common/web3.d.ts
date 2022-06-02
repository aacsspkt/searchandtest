import { Commitment, Connection, PublicKey, AccountInfo, TransactionInstruction } from '@solana/web3.js';

interface GetMultipleAccountsInfoConfig {
    batchRequest?: boolean;
    commitment?: Commitment;
}
declare function getMultipleAccountsInfo(connection: Connection, publicKeys: PublicKey[], config?: GetMultipleAccountsInfoConfig): Promise<(AccountInfo<Buffer> | null)[]>;
declare function getMultipleAccountsInfoWithCustomFlags<T extends {
    pubkey: PublicKey;
}>(connection: Connection, publicKeysWithCustomFlag: T[], config?: GetMultipleAccountsInfoConfig): Promise<({
    accountInfo: AccountInfo<Buffer> | null;
} & T)[]>;
interface GetTokenAccountsByOwnerConfig {
    commitment?: Commitment;
}
/**
 * Forecast transaction size
 */
declare function forecastTransactionSize(instructions: TransactionInstruction[], signers: PublicKey[]): number;
/**
 * Simulates multiple instruction
 */
declare function simulateMultipleInstruction(connection: Connection, instructions: TransactionInstruction[], keyword: string): Promise<string[]>;
declare function parseSimulateLogToJson(log: string, keyword: string): string;
declare function parseSimulateValue(log: string, key: string): string;

export { GetMultipleAccountsInfoConfig, GetTokenAccountsByOwnerConfig, forecastTransactionSize, getMultipleAccountsInfo, getMultipleAccountsInfoWithCustomFlags, parseSimulateLogToJson, parseSimulateValue, simulateMultipleInstruction };
