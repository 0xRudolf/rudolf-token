# $Rudolf Token Smart Contract

$Rudolf is the Xmas meme coin
<br/>

## $Rudolf tokenomics:
- Initial Supply: 4.2B $RUDOLF
- Controlled inflation: 1.2B $RUDOLF / year
- Innovative token emission model: 1.2B $RUDOLF airdrop to hodlers every Xmas! #XmasAirdrop
- Xmas Airdrop is linearly vested over 12 month to avoid supply choc
- 0% fees

## Security:
- Rudolf is an immutable contract, no update mechanism is implemented
- In case of emergency, the contract is pauseable, by the deployer only
- Deployer can renounce ownership to make it un-pauseable

## Dependencies

This project uses:

- [TypeScript](https://github.com/microsoft/TypeScript) 
- [HardHat](https://github.com/nomiclabs/hardhat) for development environment and deployment 
- [OpenZeppelin](https://github.com/OpenZeppelin/openzeppelin-contracts) for base contract implementation
- [TypeChain](https://github.com/dethcrypto/TypeChain/tree/master/packages/hardhat) for auto generated smartcontracts types
- [Chai](https://github.com/chaijs/chai) for testing
- [Prettier](https://github.com/prettier/prettier) for javascript and solidity code formatting
<br/><br/>

## Getting started

Follow these steps to compile and test Rudolf Token contract.  
<br/>
   
1. Install package dependencies
```
npm install
```

2. Run test suites
```
npm run test
```
<br/>

## Deployment

Follow these steps to deploy Rudolf on local network, BSC testnet or BSC mainnet.  
<br/>

### Local Network

1. Run local hardhat network on a separate tab
```
npx hardhat node
```

2. Deploy contracts to the local network
```
npx hardhat run --network localhost scripts/deploy.ts
```

3. Interact with the contract on local hardhat network
```
npx hardhat console --network localhost
>  ...
```

<br/>

### BSC Testnet

1. Generate a new testnet account
```
npm run accounts:generate
```

2. Copy the address output of the previous command `0x.......`

3. Open [BSC testnet faucet](https://testnet.binance.org/faucet-smart) to claim some testnet BNB for your address

4.  Deploy contracts to the BSC testnet
```
npx hardhat run --network bsc_testnet scripts/deploy.ts
```

<br/>

### BSC Mainnet

1. Put your account credentials in `secrets/accounts.mainnet.json`

```
{
  "mnemonics": "word1 word2 ...",
  "path: "m/44'/60'/0'/0"
}
```

2.  Deploy contracts to the BSC mainnet
```
npx hardhat run --network bsc_mainnet scripts/deploy.ts
```


## Verify Contract

Follow these steps to verify Rudolf on [BSCScan](https://bscscan.com/).  
<br/>


1. Request an [API KEY on BSCScan](https://bscscan.com/myapikey)

2. Copy your API KEY in `secrets/etherscan.json`
```
{
  "apiKey": "...YOUR_API_KEY...",
}
```

3. Run the following command with the address of your previously deployed contract:
```
npx hardhat  verify --network bsc_testnet "0x...."
```

To verify on mainnet, change `--network bsc_testnet` with `--network bsc_mainnet`