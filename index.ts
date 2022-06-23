import bs58 from "bs58";
import * as dotenv from "dotenv";

import {
  Currency,
  Farm,
  Liquidity,
  Percent,
  Token as Tk,
  TokenAmount,
} from "@raydium-io/raydium-sdk";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";

import { fetchAllFarmPoolKeys } from "./utils/raydium-utils/farm-utils";
import { fetchPoolKeys } from "./utils/raydium-utils/liquidity-utils";
import { getTokenAccountsByOwner } from "./utils/raydium-utils/token-utils";
import { getOrCreateAssociatedTokenAccount } from "./utils/token-utils";

// required to load env file
dotenv.config();

const connection = new Connection(clusterApiUrl("mainnet-beta"));

const secretKeyString = process.env.SECRET;
if (!secretKeyString)
  throw new Error(
    "Could not load env var. Try adding .env file at root dir with var SECRET=<secret key>"
  );
const secretKey = bs58.decode(secretKeyString);
const ownerKeypair = Keypair.fromSecretKey(secretKey);

const SOL_USDC = "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2"; // mainnet

(async () => {
  const owner = ownerKeypair.publicKey;

  console.log(owner);
  const tokenAccounts = await getTokenAccountsByOwner(connection, owner);

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
    new Tk(liquidityPoolKeys.baseMint, poolInfo.baseDecimals),
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
    new Tk(liquidityPoolKeys.quoteMint, poolInfo.quoteDecimals),
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

  const lpTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    ownerKeypair,
    new PublicKey(farmPoolKeys.lpMint.toString()),
    owner
  );

  let rewardMintsAtas = await Promise.all(
    farmPoolKeys.rewardMints.map(async (rewardMint) => {
      const rewardMintAta = await getOrCreateAssociatedTokenAccount(
        connection,
        ownerKeypair,
        rewardMint,
        owner
      );
      return rewardMintAta;
    })
  );

  const ledgerAddress = await Farm.getAssociatedLedgerAccount({
    programId: new PublicKey(farmPoolKeys.programId),
    poolId: new PublicKey(farmPoolKeys.id),
    owner,
  });

  let createLedgerAccountTxn = new Transaction();
  const ledgerAccountInfo = await connection.getAccountInfo(ledgerAddress);
  if (!ledgerAccountInfo) {
    createLedgerAccountTxn.add(
      Farm.makeCreateAssociatedLedgerAccountInstruction({
        poolKeys: farmPoolKeys,
        userKeys: {
          owner,
          ledger: ledgerAddress,
        },
      })
    );
  }
  createLedgerAccountTxn.recentBlockhash = (
    await connection.getLatestBlockhash()
  ).blockhash;
  createLedgerAccountTxn.feePayer = owner;
  createLedgerAccountTxn.sign(ownerKeypair);
  console.log(createLedgerAccountTxn);

  // const tokenAccountCreateSignature = connection.sendRawTransaction(
  //   createLedgerAccountTxn.serialize()
  // );

  // console.log(tokenAccountCreateSignature);

  // required to somehow get the amount of lp mint
  // program will fail here if no account is created
  const balanceReqRes = await connection.getTokenAccountBalance(lpTokenAccount);
  console.log(balanceReqRes.value.uiAmount);

  const lpMintAmount = new TokenAmount(
    new Tk(farmPoolKeys.lpMint, balanceReqRes.value.decimals),
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
  console.log(farmDepositTxn);

  // const farmDepositSignature = await connection.sendRawTransaction(
  //   txn.serialize()
  // );

  // console.log(farmDepositSignature);

  // // end famr
})();
