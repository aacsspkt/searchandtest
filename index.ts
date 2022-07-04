import bs58 from 'bs58';
import * as dotenv from 'dotenv';

import {
  Currency,
  Farm,
  Liquidity,
  Percent,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk';
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from '@solana/web3.js';

import { fetchAllFarmPoolKeys } from './utils/raydium-utils/farm-utils';
import {
  fetchAllPoolKeys,
  fetchPoolKeys,
} from './utils/raydium-utils/liquidity-utils';
import { getTokenAccountsByOwner } from './utils/raydium-utils/token-utils';
import { getOrCreateAssociatedTokenAccount } from './utils/token-utils';

// required to load env file
dotenv.config();

const connection = new Connection(clusterApiUrl("mainnet-beta"));

const secretKeyString = process.env.SECRET;
if (!secretKeyString)
	throw new Error("Could not load env var. Try adding .env file at root dir with var SECRET=<secret key>");
const secretKey = bs58.decode(secretKeyString);
const ownerKeypair = Keypair.fromSecretKey(secretKey);

const SOL_USDC = "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2"; // mainnet
const SOL_USDT = "7XawhbbxtsRcQA8KTkHT9f9nc6d69UwqCDh6U5EEbEmX"; // mainnet
const baseMInt = "G9tt98aYSznRk7jWsfuz9FnTdokxS6Brohdo9hSmjTRB";
const quoteMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

(async () => {
	const owner = ownerKeypair.publicKey;
	console.log("owner address", owner.toString());

	console.log("getting all token accounts owned by owner");
	const tokenAccounts = await getTokenAccountsByOwner(connection, owner);

	console.log("fetching pool keys list");
	const lpPoolKeysList = await fetchAllPoolKeys();
	console.log(lpPoolKeysList);

	console.log("searching zbc-usdc poolkeys");
	const lPoolKeys = lpPoolKeysList.find(
		(keys) => keys.baseMint.toString() == baseMInt && keys.quoteMint.toString() == quoteMint,
	);
	if (!lPoolKeys) {
		throw new Error("Pool not found");
	}
	console.log("pool", lPoolKeys);

	// add liquidity
	console.log("fetching liquidity pool keys");
	const liquidityPoolKeys = await fetchPoolKeys(connection, new PublicKey(lPoolKeys.id));

	console.log("fetching pool info");
	const poolInfo = await Liquidity.fetchInfo({
		connection,
		poolKeys: liquidityPoolKeys,
	});
	// console.log(poolInfo);

	const amountInA = new TokenAmount(new Token(liquidityPoolKeys.baseMint, poolInfo.baseDecimals), 0.00001, false);
	const anotherCurrency = new Currency(poolInfo.quoteDecimals);

	const slippage = new Percent(1, 100);

	const { anotherAmount, maxAnotherAmount } = Liquidity.computeAnotherAmount({
		poolKeys: liquidityPoolKeys,
		poolInfo,
		amount: amountInA,
		anotherCurrency,
		slippage,
	});

	console.log(
		`addLiquidity summary: ${liquidityPoolKeys.id.toBase58()}, base amount: ${amountInA.toFixed()}, quote amount: ${anotherAmount.toFixed()}`,
	);

	const amountInB = new TokenAmount(
		new Token(liquidityPoolKeys.quoteMint, poolInfo.quoteDecimals),
		maxAnotherAmount.toFixed(),
		false,
	);

	console.log("adding liquidity");
	const { transaction, signers } = await Liquidity.makeAddLiquidityTransaction({
		connection,
		poolKeys: liquidityPoolKeys,
		userKeys: {
			tokenAccounts,
			owner,
		},
		amountInA,
		amountInB,
		fixedSide: "a",
	});
	const lbh = await connection.getLatestBlockhash();
	transaction.recentBlockhash = lbh.blockhash;
	transaction.lastValidBlockHeight = lbh.lastValidBlockHeight;
	transaction.feePayer = owner;
	console.log("signers", signers);
	transaction.sign(...[ownerKeypair, ...signers]);

	// const addLiquiditySignature = await connection.sendRawTransaction(transaction.serialize());
	// await connection.confirmTransaction(
	// 	{
	// 		signature: addLiquiditySignature,
	// 		blockhash: lbh.blockhash,
	// 		lastValidBlockHeight: lbh.lastValidBlockHeight,
	// 	},
	// 	"finalized",
	// );
	// console.log(`https://solscan.io/tx/${addLiquiditySignature} \n`);

	// end add liquidity

	// // add farm
	console.log("fetching farm pool keys");
	const list = await fetchAllFarmPoolKeys();
	// console.log(poolKeys)

	// find farm where lp mint obtained from after adding lp.
	const farmPoolKeys = list.find((keys) => keys.lpMint.toString() === liquidityPoolKeys.lpMint.toString());
	console.log(farmPoolKeys?.id.toString());
	if (!farmPoolKeys) throw new Error("Farm pool keys not found.");

	// get associated token account of owner with lp mint
	console.log("get or create associated token account of owner with lpmint");
	const lpTokenAccount = await getOrCreateAssociatedTokenAccount(
		connection,
		ownerKeypair,
		new PublicKey(farmPoolKeys.lpMint.toString()),
		owner,
	);

	// get associated token account of owner with reward mint which at first time owner may not have so create
	console.log("get or create assciated token account of owner with rewared");

	let rewardMintsAtas = await Promise.all(
		farmPoolKeys.rewardInfos.map(async ({ rewardMint }) => {
			const rewardMintAta = await getOrCreateAssociatedTokenAccount(
				connection,
				ownerKeypair,
				new PublicKey(rewardMint.toString()),
				owner,
			);
			return rewardMintAta;
		}),
	);

	// get associated ledger account of owner
	console.log("get associated ledger account of owner");
	const ledgerAddress = await Farm.getAssociatedLedgerAccount({
		programId: new PublicKey(farmPoolKeys.programId),
		poolId: new PublicKey(farmPoolKeys.id),
		owner,
	});

	// checking if account is created in chain
	console.log("checking if owner have farm ledger account");
	const ledgerAccountInfo = await connection.getAccountInfo(ledgerAddress);
	if (!ledgerAccountInfo) {
		// if not created, create
		console.log("hit here");
		console.log("crearing ledger account of owner");
		let createLedgerAccountTxn = new Transaction();
		createLedgerAccountTxn.add(
			Farm.makeCreateAssociatedLedgerAccountInstruction({
				poolKeys: farmPoolKeys,
				userKeys: {
					owner,
					ledger: ledgerAddress,
				},
			}),
		);
		const lbh1 = await connection.getLatestBlockhash();
		createLedgerAccountTxn.recentBlockhash = lbh1.blockhash;
		createLedgerAccountTxn.lastValidBlockHeight = lbh1.lastValidBlockHeight;
		createLedgerAccountTxn.instructions.map((ixn) => {
			console.log(ixn.programId.toString());
			console.log(
				ixn.keys.map((keys) => {
					return {
						pubkey: keys.pubkey.toString(),
						isSigner: keys.isSigner,
						isWritable: keys.isWritable,
					};
				}),
			);
		});
		createLedgerAccountTxn.feePayer = owner;
		createLedgerAccountTxn.sign(ownerKeypair);

		// const tokenAccountCreateSignature = await connection.sendRawTransaction(createLedgerAccountTxn.serialize());
		// await connection.confirmTransaction(
		// 	{
		// 		signature: tokenAccountCreateSignature,
		// 		blockhash: lbh1.blockhash,
		// 		lastValidBlockHeight: lbh1.lastValidBlockHeight,
		// 	},
		// 	"finalized",
		// );
		// // ledger account created
		// console.log(`https://solscan.io/tx/${tokenAccountCreateSignature}`);
	}

	// use just for test
	// no need to implement in real application
	async function sleep(msec: number) {
		return new Promise((resolve) => setTimeout(resolve, msec));
	}

	await sleep(5000);

	console.log(`checking lpmint balance of ${lpTokenAccount.toString()}`);
	const balanceReqRes = await connection.getTokenAccountBalance(lpTokenAccount);
	console.log(balanceReqRes.value.uiAmount);

	const lpMintAmount = new TokenAmount(
		new Token(farmPoolKeys.lpMint, balanceReqRes.value.decimals),
		balanceReqRes.value.uiAmount,
		false,
	);
	console.log("staking amount", lpMintAmount.toFixed());

	console.log("staking lpmint");
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
		}),
	);
	const lbh2 = await connection.getLatestBlockhash();
	farmDepositTxn.recentBlockhash = lbh2.blockhash;
	farmDepositTxn.lastValidBlockHeight = lbh2.lastValidBlockHeight;
	farmDepositTxn.feePayer = owner;
	farmDepositTxn.sign(ownerKeypair);

	// const farmDepositSignature = await connection.sendRawTransaction(farmDepositTxn.serialize());
	// await connection.confirmTransaction(
	// 	{
	// 		signature: farmDepositSignature,
	// 		blockhash: lbh2.blockhash,
	// 		lastValidBlockHeight: lbh2.lastValidBlockHeight,
	// 	},
	// 	"finalized",
	// );
	// console.log(`https://solscan.io/tx/${farmDepositSignature}`);

	// end farm

	// withdraw rewards
	console.log("harvesting rewards");
	const withdrawRewardTxn = new Transaction().add(
		Farm.makeWithdrawInstruction({
			poolKeys: farmPoolKeys,
			userKeys: {
				ledger: ledgerAddress,
				lpTokenAccount,
				owner,
				rewardTokenAccounts: rewardMintsAtas,
			},
			amount: 0,
		}),
	);
	const lbh3 = await connection.getLatestBlockhash();
	withdrawRewardTxn.recentBlockhash = lbh3.blockhash;
	withdrawRewardTxn.lastValidBlockHeight = lbh3.lastValidBlockHeight;
	withdrawRewardTxn.feePayer = owner;
	withdrawRewardTxn.sign(ownerKeypair);

	// const withdrawRewardSignature = await connection.sendRawTransaction(withdrawRewardTxn.serialize());
	// await connection.confirmTransaction(
	// 	{
	// 		signature: withdrawRewardSignature,
	// 		blockhash: lbh3.blockhash,
	// 		lastValidBlockHeight: lbh3.lastValidBlockHeight,
	// 	},
	// 	"finalized",
	// );
	// console.log(`https://solscan.io/tx/${withdrawRewardSignature}`);

	// end withdraw rewards

	// withdraw staked lp mints from farm
	console.log("withdrawing staked amounts");
	const withdrawStakedLpTxn = new Transaction().add(
		Farm.makeWithdrawInstruction({
			poolKeys: farmPoolKeys,
			userKeys: {
				ledger: ledgerAddress,
				lpTokenAccount,
				owner,
				rewardTokenAccounts: rewardMintsAtas,
			},
			amount: lpMintAmount.raw, // I am assuming deposited lp mint amount and withdraw amount should be same.
		}),
	);

	const lbh4 = await connection.getLatestBlockhash();
	withdrawStakedLpTxn.recentBlockhash = lbh4.blockhash;
	withdrawStakedLpTxn.lastValidBlockHeight = lbh4.lastValidBlockHeight;
	withdrawStakedLpTxn.feePayer = owner;
	withdrawStakedLpTxn.sign(ownerKeypair);

	const withdrawStakedLpSignature = await connection.sendRawTransaction(withdrawStakedLpTxn.serialize());
	await connection.confirmTransaction(
		{
			signature: withdrawStakedLpSignature,
			blockhash: lbh4.blockhash,
			lastValidBlockHeight: lbh4.lastValidBlockHeight,
		},
		"finalized",
	);
	console.log(`https://solscan.io/tx/${withdrawStakedLpSignature}`);

	// end withdraw lp mints
})();
