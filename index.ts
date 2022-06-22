import { Currency, Liquidity, Percent, SPL_ACCOUNT_LAYOUT, Token, TokenAccount, TokenAmount } from "@raydium-io/raydium-sdk";
import { ASSOCIATED_TOKEN_PROGRAM_ID, NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { clusterApiUrl, Connection, Keypair, PublicKey, sendAndConfirmTransaction, Signer, Transaction, TransactionInstruction } from "@solana/web3.js"
import { fetchPoolKeys } from "./util_devnet";
import bs58 from "bs58";
import { Token as Tokens } from "@solana/spl-token";

const connection = new Connection(clusterApiUrl("devnet"));


const getAssociatedTokenAddress = async (owner: PublicKey, mint: PublicKey) => {
    return (await PublicKey.findProgramAddress(
        [
            owner.toBuffer(),
            TOKEN_PROGRAM_ID.toBuffer(),
            mint.toBuffer()
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
    ))[0];
}
const getTokenAccountsByOwner = async (connection: Connection, owner: PublicKey) => {
    const { context, value } = await connection.getTokenAccountsByOwner(owner,
        {
            programId: TOKEN_PROGRAM_ID
        })

    const accounts: TokenAccount[] = []

    for (const { pubkey, account } of value) {
        accounts.push({
            pubkey,
            accountInfo: SPL_ACCOUNT_LAYOUT.decode(account.data)
        })
    }
    return accounts;
}

const syncNative = async (ownerNativeMintAccount: PublicKey) => {
    const txn = new Transaction()
        .add(new TransactionInstruction({
            keys: [{ pubkey: ownerNativeMintAccount, isSigner: false, isWritable: true }],
            data: Buffer.from([17]),
            programId: TOKEN_PROGRAM_ID
        }));


    const signature = await sendAndConfirmTransaction(connection, txn, [ownerKeypair]);
    return signature;
}

const secretKey = bs58.decode('5iChpJ6MWNQpHK8fhz71YVn3YSC1VgWxUzsypCqRrJrqF9bnrdB6G9jvfAwH9FfjKPpigeEA7fWqjX47nGA5ByQ9');
const SOL_USDT = "384zMi9MbUKVUfkUdrnuMfWBwJR9gadSxYimuXeJ9DaJ"; // devnet
const SOL_USDC = "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2" // mainnet

const ownerKeypair = Keypair.fromSecretKey(secretKey);

(async () => {
    const owner = ownerKeypair.publicKey;
    const mint = new PublicKey("8FRFC6MoGGkMFQwngccyu69VnYbzykGeez7ignHVAFSN");

    // const ownerNativeMintAccount = await getAssociatedTokenAddress(owner, NATIVE_MINT);
    // const ownerTokenAccount = await getAssociatedTokenAddress(owner, mint);

    const mintInfo = (connection)
    const tokenAccounts = await getTokenAccountsByOwner(connection, owner);

    // console.log("ownerNativeMintAccount", ownerNativeMintAccount.toString());
    // console.log("ownerTokenAccount", ownerTokenAccount.toString());


    console.log("fetching pool keys")
    const poolKeys = await fetchPoolKeys(connection, new PublicKey(SOL_USDT))
    console.log(poolKeys.programId.toString());
    console.log(poolKeys.marketProgramId.toString());

    const poolInfo = await Liquidity.fetchInfo({ connection, poolKeys })
    // console.log(poolInfo);

    const amount = new TokenAmount(new Token(poolKeys.baseMint, poolInfo.baseDecimals), 0.1, false);
    const anotherCurrency = new Currency(poolInfo.quoteDecimals);

    const slippage = new Percent(5, 100)

    const {
        anotherAmount,
        maxAnotherAmount
    } = Liquidity.computeAnotherAmount({ poolKeys, poolInfo, amount, anotherCurrency, slippage, })

    console.log(`addLiquidity: ${poolKeys.id.toBase58()}, base amount: ${amount.toFixed()}, quote amount: ${anotherAmount.toFixed()}`,)

    const amountInB = new TokenAmount(new Token(poolKeys.quoteMint, poolInfo.quoteDecimals), maxAnotherAmount.toFixed(), false)
    const { transaction, signers } = await Liquidity.makeAddLiquidityTransaction({
        connection,
        poolKeys,
        userKeys: {
            tokenAccounts,
            owner,
        },
        amountInA: amount,
        amountInB,
        fixedSide: 'a'
    })
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    console.log(transaction);
    console.log(signers);
    transaction.feePayer = owner;
    transaction.sign(...[ownerKeypair, ...signers]);

    const sig = await connection.sendRawTransaction(transaction.serialize());

    console.log(sig);
    // const amountIn = new TokenAmount(new Token(poolKeys.baseMint, poolInfo.baseDecimals), 0.1, false)
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
})()
