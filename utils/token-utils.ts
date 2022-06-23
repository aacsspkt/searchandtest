import {
  Commitment,
  ConfirmOptions,
  Connection,
  PublicKey,
  sendAndConfirmTransaction,
  Signer,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  MINT_SIZE,
  MintLayout,
  TOKEN_PROGRAM_ID,
  TokenOwnerOffCurveError,
} from "../node_modules/@solana/spl-token";

export async function getAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey,
  allowOwnerOffCurve = false,
  programId = TOKEN_PROGRAM_ID,
  associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  if (!allowOwnerOffCurve && !PublicKey.isOnCurve(owner.toBuffer()))
    throw new TokenOwnerOffCurveError();
  const [address] = await PublicKey.findProgramAddress(
    [owner.toBuffer(), programId.toBuffer(), mint.toBuffer()],
    associatedTokenProgramId
  );
  return address;
}

export async function getOrCreateAssociatedTokenAccount(
  connection: Connection,
  payer: Signer,
  mint: PublicKey,
  owner: PublicKey,
  allowOwnerOffCurve = false,
  commitment?: Commitment,
  confirmOptions?: ConfirmOptions,
  programId = TOKEN_PROGRAM_ID,
  associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  const associatedToken = await getAssociatedTokenAddress(
    mint,
    owner,
    allowOwnerOffCurve,
    programId,
    associatedTokenProgramId
  );

  const accountInfo = await connection.getAccountInfo(
    associatedToken,
    commitment
  );
  if (!accountInfo) {
    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        associatedToken,
        owner,
        mint,
        programId,
        associatedTokenProgramId
      )
    );
    await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer],
      confirmOptions
    );
  }
  return associatedToken;
}

export async function getMint(
  connection: Connection,
  address: PublicKey,
  commitment?: Commitment,
  programId = TOKEN_PROGRAM_ID
) {
  const info = await connection.getAccountInfo(address, commitment);
  if (!info) throw new Error("Token not found.");
  if (!info.owner.equals(programId))
    throw new Error("Mint is not owned by Token Program.");
  if (info.data.length != MINT_SIZE)
    throw new Error("Account size of mint is invalid.");

  const rawMint = MintLayout.decode(info.data);

  return {
    mintAuthority: rawMint.mintAuthorityOption ? rawMint.mintAuthority : null,
    supply: rawMint.supply,
    decimals: rawMint.decimals,
    isInitialized: rawMint.isInitialized,
    freezeAuthority: rawMint.freezeAuthorityOption
      ? rawMint.freezeAuthority
      : null,
  };
}

export async function syncNative(
  connection: Connection,
  payer: Signer,
  ownerNativeMintAccount: PublicKey
) {
  const txn = new Transaction().add(
    new TransactionInstruction({
      keys: [
        { pubkey: ownerNativeMintAccount, isSigner: false, isWritable: true },
      ],
      data: Buffer.from([17]),
      programId: TOKEN_PROGRAM_ID,
    })
  );

  const signature = await sendAndConfirmTransaction(connection, txn, [payer]);
  return signature;
}
