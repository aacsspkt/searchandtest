import { PublicKey, Connection, TransactionInstruction, Signer, Transaction } from '@solana/web3.js';
import { BigNumberish } from '../entity/bignumber.js';
import { SplAccount } from '../spl/layout.js';
import 'bn.js';
import '../marshmallow/index.js';
import '../marshmallow/buffer-layout.js';

interface TokenAccount {
    pubkey: PublicKey;
    accountInfo: SplAccount;
}
interface SelectTokenAccountParams {
    tokenAccounts: TokenAccount[];
    mint: PublicKey;
    owner: PublicKey;
    config?: {
        associatedOnly?: boolean;
    };
}
interface HandleTokenAccountParams {
    connection: Connection;
    side: "in" | "out";
    amount: BigNumberish;
    mint: PublicKey;
    tokenAccount: PublicKey | null;
    owner: PublicKey;
    payer?: PublicKey;
    frontInstructions: TransactionInstruction[];
    endInstructions?: TransactionInstruction[];
    signers: Signer[];
    bypassAssociatedCheck: boolean;
}
interface UnsignedTransactionAndSigners {
    transaction: Transaction;
    signers: Signer[];
}
declare class Base {
    static _selectTokenAccount(params: SelectTokenAccountParams): Promise<PublicKey | null>;
    static _handleTokenAccount(params: HandleTokenAccountParams): Promise<PublicKey>;
}

export { Base, HandleTokenAccountParams, SelectTokenAccountParams, TokenAccount, UnsignedTransactionAndSigners };
