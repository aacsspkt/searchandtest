import { Connection, PublicKey, Commitment } from "@solana/web3.js";
import { MintInfo, MintLayout, TOKEN_PROGRAM_ID, } from "@solana/spl-token";
import { MINT_SIZE } from "@solana/spl-token";


/**
 * Retreive mint information
 * @param {Connection} connection 
 * @param {PublicKey} address 
 * @param {Commitment} commitment 
 * @param {PublicKey} programId 
 * @returns {MintInfo} Mint Information
 */
export async function getMint(
    connection: Connection,
    address: PublicKey,
    commitment?: Commitment,
    programId = TOKEN_PROGRAM_ID
) {
    const info = await connection.getAccountInfo(address, commitment);
    if (!info) throw new Error("Token not found.");
    if (!info.owner.equals(programId)) throw new Error("Mint is not owned by Token Program.");
    if (info.data.length != MINT_SIZE) throw new Error("Account size of mint is invalid.");

    const rawMint = MintLayout.decode(info.data);

    return {
        mintAuthority: rawMint.mintAuthorityOption ? rawMint.mintAuthority : null,
        supply: rawMint.supply,
        decimals: rawMint.decimals,
        isInitialized: rawMint.isInitialized,
        freezeAuthority: rawMint.freezeAuthorityOption ? rawMint.freezeAuthority : null,
    };
}