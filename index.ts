import bs58 from 'bs58';
import * as dotenv from 'dotenv';

import {
  Currency,
  Farm,
  Liquidity,
  Percent,
  SPL_ACCOUNT_LAYOUT,
  Token,
  TokenAccount,
  TokenAmount,
} from '@raydium-io/raydium-sdk';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token as TokenProgram,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

import { fetchAllFarmPoolKeys } from './farm_mainnet_utils';
import { fetchPoolKeys } from './util_mainnet';

dotenv.config();

const connection = new Connection(clusterApiUrl("mainnet-beta"));

const getAssociatedTokenAddress = async (owner: PublicKey, mint: PublicKey) => {
  return (
    await PublicKey.findProgramAddress(
      [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  )[0];
};
const getTokenAccountsByOwner = async (
  connection: Connection,
  owner: PublicKey
) => {
  const { context, value } = await connection.getTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  const accounts: TokenAccount[] = [];

  for (const { pubkey, account } of value) {
    accounts.push({
      pubkey,
      accountInfo: SPL_ACCOUNT_LAYOUT.decode(account.data),
    });
  }
  return accounts;
};

const syncNative = async (ownerNativeMintAccount: PublicKey) => {
  const txn = new Transaction().add(
    new TransactionInstruction({
      keys: [
        { pubkey: ownerNativeMintAccount, isSigner: false, isWritable: true },
      ],
      data: Buffer.from([17]),
      programId: TOKEN_PROGRAM_ID,
    })
  );

  const signature = await sendAndConfirmTransaction(connection, txn, [
    ownerKeypair,
  ]);
  return signature;
};

const secretKeyString = process.env.SECRET;
if (!secretKeyString)
  throw new Error(
    "Could not load env var. Try adding .env file at root dir with var SECRET=<secret key>"
  );
const secretKey = bs58.decode(secretKeyString);
const ownerKeypair = Keypair.fromSecretKey(secretKey);

const SOL_USDT = "384zMi9MbUKVUfkUdrnuMfWBwJR9gadSxYimuXeJ9DaJ"; // devnet
const SOL_USDC = "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2"; // mainnet

(async () => {
  const owner = ownerKeypair.publicKey;
  console.log(owner);
  // const mint = new PublicKey("8FRFC6MoGGkMFQwngccyu69VnYbzykGeez7ignHVAFSN");

  // const ownerNativeMintAccount = await getAssociatedTokenAddress(owner, NATIVE_MINT);
  // const ownerTokenAccount = await getAssociatedTokenAddress(owner, mint);

  // const mintInfo = (connection)
  const tokenAccounts = await getTokenAccountsByOwner(connection, owner);

  // console.log("ownerNativeMintAccount", ownerNativeMintAccount.toString());
  // console.log("ownerTokenAccount", ownerTokenAccount.toString());

  // add liquidity
  console.log("fetching liquidity pool keys");
  const liquidityPoolKeys = await fetchPoolKeys(
    connection,
    new PublicKey(SOL_USDC)
  );

  console.log("fetching pool info");
  const poolInfo = await Liquidity.fetchInfo({
    connection,
    poolKeys: liquidityPoolKeys,
  });
  // console.log(poolInfo);

  const amount = new TokenAmount(
    new Token(liquidityPoolKeys.baseMint, poolInfo.baseDecimals),
    0.001,
    false
  );
  const anotherCurrency = new Currency(poolInfo.quoteDecimals);

  const slippage = new Percent(5, 100);

  const { anotherAmount, maxAnotherAmount } = Liquidity.computeAnotherAmount({
    poolKeys: liquidityPoolKeys,
    poolInfo,
    amount,
    anotherCurrency,
    slippage,
  });

  console.log(
    `addLiquidity: ${liquidityPoolKeys.id.toBase58()}, base amount: ${amount.toFixed()}, quote amount: ${anotherAmount.toFixed()}`
  );

  const amountInB = new TokenAmount(
    new Token(liquidityPoolKeys.quoteMint, poolInfo.quoteDecimals),
    maxAnotherAmount.toFixed(),
    false
  );
  const { transaction, signers } = await Liquidity.makeAddLiquidityTransaction({
    connection,
    poolKeys: liquidityPoolKeys,
    userKeys: {
      tokenAccounts,
      owner,
    },
    amountInA: amount,
    amountInB,
    fixedSide: "a",
  });
  transaction.recentBlockhash = (
    await connection.getLatestBlockhash()
  ).blockhash;
  transaction.feePayer = owner;
  transaction.sign(...[ownerKeypair, ...signers]);

  // const sig = await connection.sendRawTransaction(transaction.serialize());

  // console.log(sig);
  // end add liquidity

  // // swap
  // const amountIn = new TokenAmount(new Token(liquidityPoolKeys.baseMint, poolInfo.baseDecimals), 0.1, false)
  // console.log(amountIn);

  // const slippage = new Percent(5, 100)
  // console.log(slippage);

  // const {
  //     amountOut,
  //     minAmountOut,
  //     currentPrice,
  //     executionPrice,
  //     priceImpact,
  //     fee,
  // } = await
  //         Liquidity.computeAmountOut({ poolKeys, poolInfo, amountIn, currencyOut, slippage, })
  // console.log(`amountOut: ${JSON.stringify(amountOut)},
  //             minAmountOut: ${minAmountOut},
  //             currentPrice: ${currentPrice},
  //             executionPrice: ${executionPrice},
  //             priceImpact: ${priceImpact},
  //             fee: ${fee}`);

  // const { transaction, signers } = await Liquidity.makeSwapTransaction({
  //     connection,
  //     poolKeys,
  //     userKeys: {
  //         tokenAccounts,
  //         owner,
  //     },
  //     amountIn,
  //     amountOut: minAmountOut,
  //     fixedSide: "in"
  // })

  // transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  // const txnSigners: Array<Signer> = [ownerKeypair, ...signers];
  // transaction.sign(...txnSigners)

  // console.log("\n")
  // console.log("itxn length: ", transaction.instructions.length);

  // console.log()

  // const rawTxn = transaction.serialize()

  // const signature = await connection.sendRawTransaction(rawTxn, {
  //     skipPreflight: false,
  //     preflightCommitment: "confirmed"
  // })

  // console.log(signature);

  // // end swap

  // // add farm
  console.log("fetching farm pool keys");
  const list = await fetchAllFarmPoolKeys();
  // console.log(poolKeys)
  const farmPoolKeys = list.find(
    (keys) => keys.lpMint.toString() === liquidityPoolKeys.lpMint.toString()
  );
  console.log(farmPoolKeys);

  if (!farmPoolKeys) throw new Error("Farm pool keys not found.");
  // required to somehow figure out lpmint of the

  // const lpmintAccounts =  await connection.getTokenAccountsByOwner(owner, {
  //    mint: farmPoolKeys.lpMint,
  //    programId: farmPoolKeys.programId
  // });
  let txn = new Transaction();

  const lpTokenAccount = await getAssociatedTokenAddress(
    owner,
    new PublicKey(farmPoolKeys.lpMint)
  );
  const lpTokenAccountInfo = await connection.getAccountInfo(lpTokenAccount);
  if (!lpTokenAccountInfo) {
    txn.add(
      await TokenProgram.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        new PublicKey(farmPoolKeys.lpMint),
        lpTokenAccount,
        owner,
        owner
      )
    );
  }

  let rewardMintsAtas: PublicKey[] = await Promise.all(
    farmPoolKeys.rewardMints.map(async (rewardMint) => {
      const rewardMintAta = await getAssociatedTokenAddress(owner, rewardMint);
      const rewaredMintAtaInfo = await connection.getAccountInfo(rewardMintAta);
      if (!rewardMintAta) {
        txn.add(
          await TokenProgram.createAssociatedTokenAccountInstruction(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            rewardMint,
            rewardMintAta,
            owner,
            owner
          )
        );
      }
      return rewardMintAta;
    })
  );

  const ledgerAddress = await Farm.getAssociatedLedgerAccount({
    programId: new PublicKey(farmPoolKeys.programId),
    poolId: new PublicKey(farmPoolKeys.id),
    owner,
  });
  const ledgerAccountInfo = await connection.getAccountInfo(ledgerAddress);
  if (!ledgerAccountInfo) {
    txn.add(
      await Farm.makeCreateAssociatedLedgerAccountInstruction({
        poolKeys: farmPoolKeys,
        userKeys: {
          owner,
          ledger: ledgerAddress,
        },
      })
    );
  }

  txn.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  txn.feePayer = owner;
  txn.sign(ownerKeypair);

  const tokenAccountCreateSignature = connection.sendRawTransaction(
    txn.serialize()
  );

  console.log(tokenAccountCreateSignature);

  // required to somehow get the amount of lp mint
  // program will fail here if no account is created
  const balanceReqRes = await connection.getTokenAccountBalance(lpTokenAccount);
  console.log(balanceReqRes.value.uiAmount);
  const lpMintAmount = new TokenAmount(
    new Token(farmPoolKeys.lpMint, balanceReqRes.value.decimals),
    balanceReqRes.value.uiAmount,
    false
  );

  let farmDepositTxn = new Transaction();
  farmDepositTxn.add(
    Farm.makeDepositInstruction({
      poolKeys: farmPoolKeys,
      userKeys: {
        ledger: ledgerAddress,
        lpTokenAccount: lpTokenAccount,
        owner: owner,
        rewardTokenAccounts: rewardMintsAtas,
      },
      amount: lpMintAmount.raw,
    })
  );

  farmDepositTxn.recentBlockhash = (
    await connection.getLatestBlockhash()
  ).blockhash;
  farmDepositTxn.feePayer = owner;
  farmDepositTxn.sign(ownerKeypair);

  const farmDepositSignature = await connection.sendRawTransaction(
    txn.serialize()
  );

  console.log(farmDepositSignature);

  // // end famr
})();
