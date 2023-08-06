const Axios = require('axios')
const { ethers } = require('ethers')
const { AxelarQueryAPI, Environment, EvmChain, GasToken } = require('@axelar-network/axelarjs-sdk')
const BananaAccount = require('../abi/BananaAccount.json')
const { getUSDCUSDTCurrentPrice } = require('../utils/priceFeed')

const maticTokenAddress = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const usdcTokenAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'

let swapProtocol = '';

const approveUrl = (chain) => `https://api.1inch.io/v5.0/${chain}/approve/transaction`;
const swapUrl = (chain) => `https://api.1inch.io/v5.0/${chain}/swap`;

const constructNormalSwapTransaction = async (swapData) => {
    let transactions = [];
    console.log('this is data ', swapData)
    const chain = swapData.chain;

    // swap transction
    let swapTransactionResp = await Axios.get(swapUrl(chain), {
      params: {
        fromTokenAddress: swapData.tokenAddress1,
        toTokenAddress: swapData.tokenAddress2,
        amount: ethers.utils
        .parseUnits(swapData.amount, 18)
        .toString(),
        fromAddress: swapData.userAddress,
        slippage: 5, // hardcoding it for now
        disableEstimate: true,
        destReceiver: swapData.userAddress
      }
    });
    console.log( swapTransactionResp.data.protocols[0]);
    swapProtocol = swapTransactionResp.data.protocols[0][0][0].name.toLowerCase();
    const swapTxn = {
      to: swapTransactionResp.data.tx.to,
      value: swapTransactionResp.data.tx.value,
      data: swapTransactionResp.data.tx.data,
      gasLimit: "0x55555"
    }
  
    transactions.push(swapTxn);
    console.log('thesre are txns ', transactions)
  
    return {
        transactions 
    };
  }


const getGasFee = async () => {
    const api = new AxelarQueryAPI({ environment: Environment.MAINNET });

    // Calculate how much gas to pay to Axelar to execute the transaction at the destination chain
    const gasFee = await api.estimateGasFee(
      EvmChain.POLYGON,
      EvmChain.CELO,
      GasToken.MATIC,
    );

    return gasFee;
}

// USDC on optimism 0x7F5c764cBc14f9669B88837ca1490cCa17c31607

const contructBridgeTransaction = async (bridgeData) => {
    const relayerFee = await getGasFee();

    console.log('usdc amount to be bridged ', ethers.utils.parseUnits(bridgeData.amount, 6))

    const crossChainTransactionData = new ethers.utils.Interface(BananaAccount.abi).encodeFunctionData(
        'crossChainTransact',
        ['USDC',
        'celo',
        bridgeData.userAddress,
        ethers.utils.parseUnits(bridgeData.amount, 6),
        '0x']
    );

    return {
        success: true,
        context: `This transaction will first bridge your amount of WMATIC token to Avalanche blockchain and then it will stake your token into Aave Staking contract which is avalaible on Avalanche as after research we found out it is currently giving max APY (5.69%) on staked assets.`,
        transaction: [
            {
                to: bridgeData.userAddress,
                value: relayerFee,
                data: crossChainTransactionData,
                gasLimit: '0x55555'
            }
        ]
    }
}

const constructBridgeAndSwapTransaction = async (intentData) => {

    // matic -> USDC
    // USDC -> bridge
    // USDC -> opt (just for contract dep)

    let txns = []
    console.log('intent data', intentData)

    const tokenAmount = intentData.amount;
    const userAddress = intentData.userAddress;

    const feedData = await getUSDCUSDTCurrentPrice()
    console.log('this is price ', feedData.price);

    console.log('for 1 USD', 1 / feedData.price)
    console.log('this is token amount ', typeof tokenAmount)

    const amount = String(((parseFloat(1 / feedData.price)) * Number(tokenAmount)).toFixed(6))
    console.log('final matic amount ', amount)

    const swapData = {
        tokenAddress1: maticTokenAddress,
        tokenAddress2: usdcTokenAddress,
        amount,
        userAddress,
        chain: 137
    }
    console.log('this is data ', swapData)

    const txn = await constructNormalSwapTransaction(swapData);
    console.log('thes4e are txns ', txn)

    txns = [...txn.transactions];

    swapData.amount = tokenAmount;

    const bridgeTxn = await contructBridgeTransaction(swapData);

    txns = [...txns, ...bridgeTxn.transaction];

    return {
        context: 'timepass',
        steps: [
            {
                type: 'swap',
                context: `Swap ${amount} MATIC token with USDC token on ${swapProtocol.slice(8).charAt(0).toUpperCase() + swapProtocol.slice(8).slice(1)}`,
                estimatedTime: 30
            },
            {
                type: 'bridge',
                context: `Bridge ${tokenAmount} USDC token to Celo using Axelar bridge`,
                estimatedTime: 120
            }
        ],
        transactions: txns
    };
}

module.exports = { constructBridgeAndSwapTransaction }