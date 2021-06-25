import { StaticJsonRpcProvider, Web3Provider } from "@ethersproject/providers";
import { formatEther, parseEther } from "@ethersproject/units";
import WalletConnectProvider from "@walletconnect/web3-provider";
//import { Alert, Button, Col, Menu, Row } from "antd";
import { Alert, Button, Card, Col, Input, List, Menu, Row } from "antd";
import "antd/dist/antd.css";
import { useUserAddress } from "eth-hooks";
import React, { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Link, Route, Switch } from "react-router-dom";
import Web3Modal from "web3modal";
import "./App.css";
import { Account, Address, AddressInput, Contract, Faucet, GasGauge, Header, Minter, NFTViewer, Ramp, ThemeSwitch } from "./components";
import { INFURA_ID, NETWORK, NETWORKS } from "./constants";
import { Transactor } from "./helpers";
import {
  useBalance,
  useContractLoader,
  useContractReader,
  useEventListener,
  useExchangePrice,
  useExternalContractLoader,
  useGasPrice,
  useOnBlock,
  useUserProvider,
} from "./hooks";

const { BufferList } = require("bl");
// https://www.npmjs.com/package/ipfs-http-client
const ipfsAPI = require("ipfs-http-client");

//const { config, ethers } = require("hardhat");

const ipfs = ipfsAPI({ host: "ipfs.infura.io", port: "5001", protocol: "https" });

/// 📡 What chain are your contracts deployed to?
const targetNetwork = NETWORKS.testnet; // <------- select your target frontend network (localhost, rinkeby, xdai, mainnet)

// 😬 Sorry for all the console logging
const DEBUG = true;

//add
const getFromIPFS = async hashToGet => {
  for await (const file of ipfs.get(hashToGet)) {
    console.log(file.path);
    if (!file.content) continue;
    const content = new BufferList();
    for await (const chunk of file.content) {
      content.append(chunk);
    }
    console.log(content);
    return content;
  }
};

// 🛰 providers
if (DEBUG) console.log("📡 Connecting to Mainnet Ethereum");
// const mainnetProvider = getDefaultProvider("mainnet", { infura: INFURA_ID, etherscan: ETHERSCAN_KEY, quorum: 1 });
// const mainnetProvider = new InfuraProvider("mainnet",INFURA_ID);
//
// attempt to connect to our own scaffold eth rpc and if that fails fall back to infura...
// Using StaticJsonRpcProvider as the chainId won't change see https://github.com/ethers-io/ethers.js/issues/901
const scaffoldEthProvider = new StaticJsonRpcProvider("https://rpc.scaffoldeth.io:48544");
const mainnetInfura = new StaticJsonRpcProvider("https://mainnet.infura.io/v3/" + INFURA_ID);
// ( ⚠️ Getting "failed to meet quorum" errors? Check your INFURA_I

// 🏠 Your local provider is usually pointed at your local blockchain
const localProviderUrl = targetNetwork.rpcUrl;
// as you deploy to other networks you can set REACT_APP_PROVIDER=https://dai.poa.network in packages/react-app/.env
const localProviderUrlFromEnv = process.env.REACT_APP_PROVIDER ? process.env.REACT_APP_PROVIDER : localProviderUrl;
if (DEBUG) console.log("🏠 Connecting to provider:", localProviderUrlFromEnv);
const localProvider = new StaticJsonRpcProvider(localProviderUrlFromEnv);

// 🔭 block explorer URL
const blockExplorer = targetNetwork.blockExplorer;

/*
  Web3 modal helps us "connect" external wallets:
*/
const web3Modal = new Web3Modal({
  // network: "mainnet", // optional
  cacheProvider: true, // optional
  providerOptions: {
    walletconnect: {
      package: WalletConnectProvider, // required
      options: {
        infuraId: INFURA_ID,
      },
    },
  },
});

const logoutOfWeb3Modal = async () => {
  await web3Modal.clearCachedProvider();
  setTimeout(() => {
    window.location.reload();
  }, 1);
};

function App(props) {
  const mainnetProvider = scaffoldEthProvider && scaffoldEthProvider._network ? scaffoldEthProvider : mainnetInfura;

  const [injectedProvider, setInjectedProvider] = useState();
  /* 💵 This hook will get the price of ETH from 🦄 Uniswap: */
  const price = useExchangePrice(targetNetwork, mainnetProvider);

  /* 🔥 This hook will get the price of Gas from ⛽️ EtherGasStation */
  const gasPrice = useGasPrice(targetNetwork, "fast");
  // Use your injected provider from 🦊 Metamask or if you don't have it then instantly generate a 🔥 burner wallet.
  const userProvider = useUserProvider(injectedProvider, localProvider);
  const address = useUserAddress(userProvider);

  // You can warn the user if you would like them to be on a specific network
  const localChainId = localProvider && localProvider._network && localProvider._network.chainId;
  const selectedChainId = userProvider && userProvider._network && userProvider._network.chainId;

  // For more hooks, check out 🔗eth-hooks at: https://www.npmjs.com/package/eth-hooks

  // The transactor wraps transactions and provides notificiations
  const tx = Transactor(userProvider, gasPrice);

  // Faucet Tx can be used to send funds from the faucet
  const faucetTx = Transactor(localProvider, gasPrice);

  // 🏗 scaffold-eth is full of handy hooks like this one to get your balance:
  const yourLocalBalance = useBalance(localProvider, address);

  // Just plug in different 🛰 providers to get your balance on different chains:
  const yourMainnetBalance = useBalance(mainnetProvider, address);

  // Load in your local 📝 contract and read a value from it:
  const readContracts = useContractLoader(localProvider);

  // If you want to make 🔐 write transactions to your contracts, use the userProvider:
  const writeContracts = useContractLoader(userProvider);


//add
useOnBlock(mainnetProvider, () => {
    console.log(`⛓ A new mainnet block is here: ${mainnetProvider._lastBlockNumber}`);
  });

const balance = useContractReader(readContracts, "NFTMinter", "balanceOf", [address]);
  console.log("🤗 balance:", balance);

  const transferEvents = useEventListener(readContracts, "NFTMinter", "Transfer", localProvider, 1);
    console.log("📟 Transfer events:", transferEvents);

    const yourBalance = balance && balance.toNumber && balance.toNumber();
      const [yourCollectibles, setYourCollectibles] = useState();

      useEffect(() => {
        const updateYourCollectibles = async () => {
          const collectibleUpdate = [];
          for (let tokenIndex = 0; tokenIndex < balance; tokenIndex++) {
            try {
              console.log("GEtting token index", tokenIndex);
              const tokenId = await readContracts.NFTMinter.tokenOfOwnerByIndex(address, tokenIndex);
              console.log("tokenId", tokenId);
              const metadataURI = await readContracts.NFTMinter.tokenURI(tokenId);
              console.log("tokenURI", metadataURI);

              const ipfsHash = metadataURI.replace(/^ipfs:\/\//, "");
              console.log("ipfsHash", ipfsHash);

              const jsonManifestBuffer = await getFromIPFS(ipfsHash);

              try {
                const jsonManifest = JSON.parse(jsonManifestBuffer.toString());
                console.log("jsonManifest", jsonManifest);
                collectibleUpdate.push({ id: tokenId, uri: metadataURI, owner: address, ...jsonManifest });
              } catch (e) {
                console.log(e);
              }
            } catch (e) {
              console.log(e);
            }
          }
          setYourCollectibles(collectibleUpdate);
        };
        updateYourCollectibles();
      }, [address, yourBalance]);

  /*
  const addressFromENS = useResolveName(mainnetProvider, "austingriffith.eth");
  console.log("🏷 Resolved austingriffith.eth as:",addressFromENS)
  */

  //
  // 🧫 DEBUG 👨🏻‍🔬
  //
  useEffect(() => {
    if (
      DEBUG &&
      mainnetProvider &&
      address &&
      selectedChainId &&
      yourLocalBalance &&
      yourMainnetBalance &&
      readContracts &&
      writeContracts
    ) {
      console.log("_____________________________________ 🏗 scaffold-eth _____________________________________");
      console.log("🌎 mainnetProvider", mainnetProvider);
      console.log("🏠 localChainId", localChainId);
      console.log("👩‍💼 selected address:", address);
      console.log("🕵🏻‍♂️ selectedChainId:", selectedChainId);
      console.log("💵 yourLocalBalance", yourLocalBalance ? formatEther(yourLocalBalance) : "...");
      console.log("💵 yourMainnetBalance", yourMainnetBalance ? formatEther(yourMainnetBalance) : "...");
      console.log("📝 readContracts", readContracts);
      console.log("🔐 writeContracts", writeContracts);
    }
  }, [
    mainnetProvider,
    address,
    selectedChainId,
    yourLocalBalance,
    yourMainnetBalance,
    readContracts,
    writeContracts,
  ]);

  let networkDisplay = "";
  if (localChainId && selectedChainId && localChainId !== selectedChainId) {
    const networkSelected = NETWORK(selectedChainId);
    const networkLocal = NETWORK(localChainId);
    if (selectedChainId === 1337 && localChainId === 31337) {
      networkDisplay = (
        <div style={{ zIndex: 2, position: "absolute", right: 0, top: 60, padding: 16 }}>
          <Alert
            message="⚠️ Wrong Network ID"
            description={
              <div>
                You have <b>chain id 1337</b> for localhost and you need to change it to <b>31337</b> to work with
                HardHat.
                <div>(MetaMask -&gt; Settings -&gt; Networks -&gt; Chain ID -&gt; 31337)</div>
              </div>
            }
            type="error"
            closable={false}
          />
        </div>
      );
    } else {
      networkDisplay = (
        <div style={{ zIndex: 2, position: "absolute", right: 0, top: 60, padding: 16 }}>
          <Alert
            message="⚠️ Wrong Network"
            description={
              <div>
                You have <b>{networkSelected && networkSelected.name}</b> selected and you need to be on{" "}
                <b>{networkLocal && networkLocal.name}</b>.
              </div>
            }
            type="error"
            closable={false}
          />
        </div>
      );
    }
  } else {
    networkDisplay = (
      <div style={{ zIndex: -1, position: "absolute", right: 154, top: 28, padding: 16, color: targetNetwork.color }}>
        {targetNetwork.name}
      </div>
    );
  }

  const loadWeb3Modal = useCallback(async () => {
    const provider = await web3Modal.connect();
    setInjectedProvider(new Web3Provider(provider));
  }, [setInjectedProvider]);

  useEffect(() => {
    if (web3Modal.cachedProvider) {
      loadWeb3Modal();
    }
  }, [loadWeb3Modal]);

  const [route, setRoute] = useState();
  useEffect(() => {
    setRoute(window.location.pathname);
  }, [setRoute]);

  let faucetHint = "";
  const faucetAvailable = localProvider && localProvider.connection && targetNetwork.name === "localhost";

  if (faucetAvailable) {
    faucetHint = (
      <div style={{ padding: 16 }}>
        <Button
          type="primary"
          onClick={() => {
            faucetTx({
              to: address,
              value: parseEther("0.01"),
            });
          }}
        >
          💰 Grab funds from the faucet ⛽️
        </Button>
      </div>
    );
  }

  const [transferToAddresses, setTransferToAddresses] = useState({});

  return (
    <div className="App">
      <Header />
      {networkDisplay}
      <BrowserRouter>
        <Menu style={{ textAlign: "center" }} selectedKeys={[route]} mode="horizontal">
        <Menu.Item key="/">
                    <Link
                      onClick={() => {
                        setRoute("/");
                      }}
                      to="/"
                    >
                      YourCollectibles
                    </Link>
                  </Menu.Item>
        <Menu.Item key="/Minter">
            <Link
              onClick={() => {
                setRoute("/Minter");
              }}
              to="/Minter"
            >
              Mint an NFT
            </Link>
          </Menu.Item>
          <Menu.Item key="/transfers">
                      <Link
                        onClick={() => {
                          setRoute("/transfers");
                        }}
                        to="/transfers"
                      >
                        Transfers
                      </Link>
                    </Menu.Item>
          <Menu.Item key="/view">
            <Link
              onClick={() => { setRoute("/view"); }}
              to="/view">View an NFT</Link>
          </Menu.Item>
          <Menu.Item key="/contract">
            <Link
              onClick={() => {
                setRoute("/contract");
              }}
              to="/contract"
            >
              NFTMinter Contract
            </Link>
          </Menu.Item>
        </Menu>

        <Switch>
          <Route exact path="/">
          <div style={{ width: 640, margin: "auto", marginTop: 32, paddingBottom: 32 }}>
                        <List
                          bordered
                          dataSource={yourCollectibles}
                          renderItem={item => {
                            const id = item.id.toNumber();
                            return (
                              <List.Item key={id + "_" + item.uri + "_" + item.owner}>
                                <Card
                                  title={
                                    <div>
                                      <span style={{ fontSize: 16, marginRight: 8 }}>#{id}</span> {item.name}
                                    </div>
                                  }
                                >
                                  <div>
                                    <img src={item.image} style={{ maxWidth: 150 }} />
                                  </div>
                                  <div>{item.description}</div>
                                </Card>

                                <div>
                                  owner:{" "}
                                  <Address
                                    address={item.owner}
                                    ensProvider={mainnetProvider}
                                    blockExplorer={blockExplorer}
                                    fontSize={16}
                                  />
                                  <AddressInput
                                    ensProvider={mainnetProvider}
                                    placeholder="transfer to address"
                                    value={transferToAddresses[id]}
                                    onChange={newValue => {
                                      const update = {};
                                      update[id] = newValue;
                                      setTransferToAddresses({ ...transferToAddresses, ...update });
                                    }}
                                  />
                                  <Button
                                    onClick={() => {
                                      console.log("writeContracts", writeContracts);
                                      tx(writeContracts.NFTMinter.transferFrom(address, transferToAddresses[id], id));
                                    }}
                                  >
                                    Transfer
                                  </Button>
                                </div>
                              </List.Item>
                            );
                          }}
                        />
                      </div>
                    </Route>

          <Route path="/Minter">
            <Minter
              signer={userProvider.getSigner()}
              provider={localProvider}
              address={address}
              blockExplorer={blockExplorer}
              />
          </Route>

          <Route path="/transfers">
                      <div style={{ width: 600, margin: "auto", marginTop: 32, paddingBottom: 32 }}>
                        <List
                          bordered
                          dataSource={transferEvents}
                          renderItem={item => {
                            return (
                              <List.Item key={item[0] + "_" + item[1] + "_" + item.blockNumber + "_" + item[2].toNumber()}>
                                <span style={{ fontSize: 16, marginRight: 8 }}>#{item[2].toNumber()}</span>
                                <Address address={item[0]} ensProvider={mainnetProvider} fontSize={16} /> =&gt;
                                <Address address={item[1]} ensProvider={mainnetProvider} fontSize={16} />
                              </List.Item>
                            );
                          }}
                        />
                      </div>
                    </Route>

          <Route path="/view">
              <NFTViewer
                provider={localProvider}
                address={address}
                blockExplorer={blockExplorer}
              />
          </Route>

          <Route exact path="/contract">
            <Contract
              name="NFTMinter"
              signer={userProvider.getSigner()}
              provider={localProvider}
              address={address}
              blockExplorer={blockExplorer}
            />
          </Route>
        </Switch>
      </BrowserRouter>

      <ThemeSwitch />

      {/* 👨‍💼 Your account is in the top right with a wallet at connect options */}
      <div style={{ position: "fixed", textAlign: "right", right: 0, top: 0, padding: 10 }}>
        <Account
          address={address}
          localProvider={localProvider}
          userProvider={userProvider}
          mainnetProvider={mainnetProvider}
          price={price}
          web3Modal={web3Modal}
          loadWeb3Modal={loadWeb3Modal}
          logoutOfWeb3Modal={logoutOfWeb3Modal}
          blockExplorer={blockExplorer}
        />
        {faucetHint}
      </div>


    </div>
  );
}

/* eslint-disable */
window.ethereum &&
  window.ethereum.on("chainChanged", chainId => {
    web3Modal.cachedProvider &&
      setTimeout(() => {
        window.location.reload();
      }, 1);
  });

window.ethereum &&
  window.ethereum.on("accountsChanged", accounts => {
    web3Modal.cachedProvider &&
      setTimeout(() => {
        window.location.reload();
      }, 1);
  });
/* eslint-enable */

export default App;
