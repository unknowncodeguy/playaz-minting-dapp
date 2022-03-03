import { useEffect, useState } from "react";
import styled from "styled-components";
import confetti from "canvas-confetti";
import * as anchor from "@project-serum/anchor";
import { LAMPORTS_PER_SOL, PublicKey, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-material-ui";
import { GatewayProvider } from '@civic/solana-gateway-react';
import Countdown from "react-countdown";
import { Snackbar, Paper, LinearProgress, Chip, Typography } from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";
import { toDate, AlertState, getAtaForMint, getAllCollectibles } from './utils';
import { MintButton } from './MintButton';
import {
    CandyMachine,
    awaitTransactionSignatureConfirmation,
    getCandyMachineState,
    mintOneToken,
    CANDY_MACHINE_PROGRAM,
    getCandy
} from "./candy-machine";
import {
    TWITTER_URL,
    DISCORD_URL,
    WAITING,
    REACT_TOKEN_NAME,
    REACT_NFT_AUTORITY
} from './config'

const cluster = process.env.REACT_APP_SOLANA_NETWORK!.toString();
const decimals = process.env.REACT_APP_SPL_TOKEN_DECIMALS ? +process.env.REACT_APP_SPL_TOKEN_DECIMALS!.toString() : 9;
const splTokenName = process.env.REACT_APP_SPL_TOKEN_NAME ? process.env.REACT_APP_SPL_TOKEN_NAME.toString() : "TOKEN";

const WalletContainer = styled.div`
  display: flex;
  justify-content: space-between;
  margin:0 auto;
`;
const NFT = styled(Paper)`
  min-width: 400px;
  padding: 5px 20px 20px 20px;
  flex: 1 1 auto;
`;
const Des = styled(NFT)`
  text-align: left;
  padding-top: 0px;
`;

const Card = styled(Paper)`
  display: inline-block;
  background-color: var(--card-background-lighter-color) !important;
  margin: 5px;
  padding: 24px;
`;

const Footer = styled.div`
  height:60px;
  background-color: #002454;
  color: white;
  @media only screen and (min-width: 1800px) {
    height:80px;
  }
  @media only screen and (min-width: 1800px) {
    height:100px;
  }
  @media only screen and (min-width: 1800px) {
    height:120px;
  }
`

const ConnectButton = styled(WalletMultiButton)`
  height: 30px;
  background-color: white;
`;

const Wallet = styled.ul`
  flex: 0 0 auto;
  float: right;
  margin: 0;
  padding: 0;
`;
const MainContainer = styled.div`
  display: flex;
  width: 100%;
  flex-direction: column;
  text-align: center;
  justify-content: center;
`;

const HeaderWrapper = styled.div`
    width: 1000px;
`;

const MintContainer = styled.div`
  display: flex;
  flex-direction: row;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items:  center;
  justify-content: space-between;
`;

const DesContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: right;
`;

const Price = styled.div`
  position: relative;
    font-weight: bold;
    font-size: 1.8em !important;
    color: #002454;
    margin: 20px 0;
`;

const Image = styled.img`
  height: 400px;
  width: auto;
  border-radius: 20px;
  @media only screen and (min-width: 1400px) {
    height: 460px;
  }
  @media only screen and (min-width: 1600px) {
    height: 580px;
  }
  @media only screen and (min-width: 1800px) {
    height: 700px;
  }
`;

export interface HomeProps {
    candyMachineId: anchor.web3.PublicKey;
    connection: anchor.web3.Connection;
    txTimeout: number;
    rpcHost: string;
}

const Home = (props: HomeProps) => {
    const [page, setPage] = useState<string>('home')
    const [balance, setBalance] = useState<number>();
    const [isMinting, setIsMinting] = useState(false); // true when user got to press MINT
    const [isActive, setIsActive] = useState(false); // true when countdown completes or whitelisted
    // const [solanaExplorerLink, setSolanaExplorerLink] = useState<string>("");
    const [itemsAvailable, setItemsAvailable] = useState(0);
    const [itemsRedeemed, setItemsRedeemed] = useState(0);
    const [itemsRemaining, setItemsRemaining] = useState(0);
    const [progress, setProgress] = useState(0);
    const [isSoldOut, setIsSoldOut] = useState(false);
    const [payWithSplToken, setPayWithSplToken] = useState(false);
    const [price, setPrice] = useState(0);
    const [priceLabel, setPriceLabel] = useState<string>("SOL");
    const [whitelistPrice, setWhitelistPrice] = useState(0);
    const [whitelistEnabled, setWhitelistEnabled] = useState(false);
    const [whitelistTokenBalance, setWhitelistTokenBalance] = useState(0);

    const [intervalId, setIntervalId] = useState(0);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [mintable, setMintalbe] = useState<boolean>(false);
    const [tooManyTokens, setTooManyTokens] = useState<number>(0);
    const [alertState, setAlertState] = useState<AlertState>({
        open: false,
        message: "",
        severity: undefined,
    });

    const goToHome = () => {
        setPage('home')
    }

    const goToMint = () => {
        setPage('mint')
    }

    const wallet = useAnchorWallet();
    const [candyMachine, setCandyMachine] = useState<CandyMachine>();

    const rpcUrl = props.rpcHost;

    const refreshCandyMachineState =  async () => {
            let candy;
            if(!wallet) {
                candy = await getCandy(
                    props.candyMachineId,
                    props.connection
                );
            }
            else {
                candy = await getCandyMachineState(
                    wallet as anchor.Wallet,
                    props.candyMachineId,
                    props.connection
                );
            }

            setCandyMachine(candy);
            setItemsAvailable(candy.state.itemsAvailable);
            setItemsRemaining(candy.state.itemsRemaining);
            setItemsRedeemed(candy.state.itemsRedeemed);
            setProgress(Math.round(28 * candy.state.itemsRemaining / candy.state.itemsAvailable));

            var divider = 1;
            if (decimals) {
                divider = +('1' + new Array(decimals).join('0').slice() + '0');
            }

            // detect if using spl-token to mint
            if (candy.state.tokenMint) {
                setPayWithSplToken(true);
                // Customize your SPL-TOKEN Label HERE
                // TODO: get spl-token metadata name
                setPriceLabel(splTokenName);
                setPrice(candy.state.price.toNumber() / divider);
                setWhitelistPrice(candy.state.price.toNumber() / divider);
            } else {
                setPrice(candy.state.price.toNumber() / LAMPORTS_PER_SOL);
                setWhitelistPrice(candy.state.price.toNumber() / LAMPORTS_PER_SOL);
            }

            if (candy.state.whitelistMintSettings) {
                setWhitelistEnabled(true);
                if (candy.state.whitelistMintSettings.discountPrice !== null && candy.state.whitelistMintSettings.discountPrice !== candy.state.price) {
                    if (candy.state.tokenMint) {
                        setWhitelistPrice(candy.state.whitelistMintSettings.discountPrice?.toNumber() / divider);
                    } else {
                        setWhitelistPrice(candy.state.whitelistMintSettings.discountPrice?.toNumber() / LAMPORTS_PER_SOL);
                    }
                }
            }
            else {
                setWhitelistEnabled(false);
            }

            if(wallet) {
                const cndy = await getCandyMachineState(
                    wallet as anchor.Wallet,
                    props.candyMachineId,
                    props.connection
                );
                if (cndy.state.whitelistMintSettings) {
                    let balance = 0;
                    try {
                        const tokenBalance =
                            await props.connection.getTokenAccountBalance(
                                (
                                    await getAtaForMint(
                                        cndy.state.whitelistMintSettings.mint,
                                        wallet.publicKey,
                                    )
                                )[0],
                            );
    
                        balance = tokenBalance?.value?.uiAmount || 0;
                    } catch (e) {
                        console.error(e);
                        balance = 0;
                    }
                    setWhitelistTokenBalance(balance);
                    setIsActive(balance > 0);
                }
            }

            // fetch whitelist token balance

        
    };

    const renderCounter = ({ days, hours, minutes, seconds }: any) => {
        return (    
            <div className="counter">
                <div className="each-unit">
                    <div>{days}</div>
                    <div>Days</div>
                </div>
                <div className="each-unit">
                    <div>{hours}</div>
                    <div>Hours</div>
                </div><div className="each-unit">
                    <div>{minutes}</div>
                    <div>Mins</div>
                </div><div className="each-unit">
                    <div>{seconds}</div>
                    <div>Secs</div>
                </div>
            </div>
        );
    };

    function displaySuccess(mintPublicKey: any): void {
        let remaining = itemsRemaining - 1;
        setItemsRemaining(remaining);
        setProgress(Math.round(28 * itemsRemaining / itemsAvailable))
        setIsSoldOut(remaining === 0);
        if (whitelistTokenBalance && whitelistTokenBalance > 0) {
            let balance = whitelistTokenBalance - 1;
            setWhitelistTokenBalance(balance);
            setIsActive(balance > 0);
        }
        setItemsRedeemed(itemsRedeemed + 1);
        const solFeesEstimation = 0.012; // approx
        if (!payWithSplToken && balance && balance > 0) {
            setBalance(balance - (whitelistEnabled ? whitelistPrice : price) - solFeesEstimation);
        }
        // setSolanaExplorerLink(cluster === "devnet" || cluster === "testnet"
        //     ? ("https://explorer.solana.com/address/" + mintPublicKey + "?cluster=" + cluster)
        //     : ("https://explorer.solana.com/address/" + mintPublicKey));
        throwConfetti();
    };

    function throwConfetti(): void {
        confetti({
            particleCount: 400,
            spread: 70,
            origin: { y: 0.6 },
        });
    }

    const setLastMintTime = () => {
        if(wallet) {
            const now = new Date().getTime();
            localStorage.lastMintTime = new Date().getTime();
            localStorage.lastMintAccount =  wallet.publicKey.toString();
        }
    }

    const onMint = async () => {
        try {
            
            setIsMinting(true);
            setIsLoading(true);
            
            document.getElementById('#identity')?.click();
            if (wallet && candyMachine?.program && wallet.publicKey) {
                const mint = anchor.web3.Keypair.generate();
                console.log('MINT', mint.toString());
                const mintTxId = (
                    await mintOneToken(candyMachine, wallet.publicKey, mint)
                )[0];

                let status: any = { err: true };
                if (mintTxId) {
                    status = await awaitTransactionSignatureConfirmation(
                        mintTxId,
                        props.txTimeout,
                        props.connection,
                        'singleGossip',
                        true,
                    );
                }

                if (!status?.err) {
                    setAlertState({
                        open: true,
                        message: 'Congratulations! Mint succeeded!',
                        severity: 'success',
                    });

                    // update front-end amounts
                    setLastMintTime();
                    displaySuccess(mint.publicKey);
                    setTooManyTokens(tooManyTokens + 1);
                } else {
                    setAlertState({
                        open: true,
                        message: 'Mint failed! Please try again!',
                        severity: 'error',
                    });
                }
            }
        } catch (error: any) {
            // TODO: blech:
            let message = error.msg || 'Minting failed! Please try again!';
            if (!error.msg) {
                if (!error.message) {
                    message = 'Transaction Timeout! Please try again.';
                } else if (error.message.indexOf('0x138')) {
                } else if (error.message.indexOf('0x137')) {
                    message = `SOLD OUT!`;
                } else if (error.message.indexOf('0x135')) {
                    message = `Insufficient funds to mint. Please fund your wallet.`;
                }
            } else {
                if (error.code === 311) {
                    message = `SOLD OUT!`;
                } else if (error.code === 312) {
                    message = `Minting period hasn't started yet.`;
                }
            }

            setAlertState({
                open: true,
                message,
                severity: "error",
            });
        } finally {
            setIsMinting(false);
            setIsLoading(false);
        }
    };


    useEffect(() => {
        (async () => {
            
            if (wallet) {
                if(wallet.publicKey.toString() != localStorage.lastMintAccount) {

                }
                const interval = window.setInterval(async() => {
                    if (localStorage.lastMintTime && localStorage.lastMintAccount) {
                        const lastMintTime = localStorage.getItem("lastMintTime");
                        const lastMintAccount = localStorage.getItem("lastMintAccount");
                        if(wallet.publicKey.toString() == lastMintAccount) {
                            const now = new Date().getTime();
                            const diff = now - Number(lastMintTime);
                            if(diff > WAITING) {

                            }
                        }
                    }
                }, 1000);
                setIntervalId(interval);
            }
        })();
    }, [wallet]);

    useEffect(() => {
        (async () => {
            if (wallet) {
                
                const balance = await props.connection.getBalance(wallet.publicKey);
                setBalance(balance / LAMPORTS_PER_SOL);

                const nftNum = await getAllCollectibles([wallet.publicKey?.toString()], [{
                    updateAuthority: REACT_NFT_AUTORITY, collectionName: REACT_TOKEN_NAME
                }]);
                setTooManyTokens(nftNum[0]);
            }
        })();
    }, [wallet, props.connection]);

    useEffect(() => {
        (async () => {
            setIsLoading(true);
            await refreshCandyMachineState();
            setIsLoading(false);
        })()
    }, [
        wallet,
        props.candyMachineId,
        props.connection,
    ]);

    return (
        <div style={{position: 'relative'}}>
            <div className="banner">
                <img src="./background.jpg" />
            </div>
            <div className="header-wrapper">
            <WalletContainer>
                <div className="page-links">
                    <li onClick={goToHome}><a className={`${page === 'home' ? 'page-selected' : 'page-not-selected'}`} href="/" rel="noopener noreferrer">HOME</a></li>
                    <li onClick={goToMint}><a className={`${page === 'mint' ? 'page-selected' : 'page-not-selected'}`} href="/" rel="noopener noreferrer">MINT</a></li>
                </div>
                <div className="social">
                    <a href={`${TWITTER_URL}`} target="_blank" rel="noreferrer"><img src={'twitter.png'} style={{ marginRight: '10px' }} alt="twitter" /></a>
                    <a href={`${DISCORD_URL}`} target="_blank" rel="noreferrer"><img src={'discord.png'} alt="discord" /></a>
                </div>
            </WalletContainer>
            </div>

            <main className="main">
            {
            isLoading == true ?
            <div id="preloader"></div> :
            <div id="preloader" style={{display: 'none'}}></div>
            }

                <MainContainer>
                    <MintContainer>
                        <div><Image
                            src="playaz.gif"
                            alt="NFT To Mint" />
                            {wallet && isActive && whitelistEnabled && (whitelistTokenBalance > 0) &&
                                <h3>You have {whitelistTokenBalance} whitelist mint(s) remaining.</h3>}
                        </div>
                        <DesContainer>
                            {candyMachine?.state &&
                                <>
                                    <div className="progress-bar">
                                        <div className="progress-units">
                                            {Array.apply(null, Array(progress)).map((item, index) =>
                                                <div className="progress-unit" key={index}></div>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '26px', color: '#002454', lineHeight: '50px', marginBottom: '20px', fontWeight: 'bold' }}>{itemsRemaining} OF {itemsAvailable} AVAILABLE</div></>}
                            <Wallet>
                                {wallet ?
                                    <ConnectButton /> :
                                    <ConnectButton>Wallet Connect</ConnectButton>}
                            </Wallet>

                            {
                                <div>
                                    <div style={{ marginTop: '20px' }}>
                                        {wallet && isActive &&  
                                            <MintButton
                                                candyMachine={candyMachine}
                                                isMinting={isMinting}
                                                isActive={isActive}
                                                isSoldOut={isSoldOut}
                                                onMint={onMint}
                                                wallet={wallet ? true : false}
                                                tooManyTokens={tooManyTokens >= 1}
                                                mintable={true}
                                                whitelistEnabled={whitelistEnabled}
                                            />
                                        }
                                        {
                                            candyMachine?.state?.goLiveDate && !isActive && 
                                            <Countdown
                                                date={toDate(candyMachine?.state?.goLiveDate)}
                                                onMount={({ completed }) => completed && setIsActive(true)}
                                                onComplete={() => {
                                                    setIsActive(true);
                                                }}
                                                renderer={renderCounter}
                                            />
                                        }
                                    </div>
                                    <Price>
                                        {whitelistEnabled && (whitelistTokenBalance > 0) ? ("Mint Price: " + whitelistPrice + " " + priceLabel) : ("Mint Price: " + price + " " + priceLabel)}
                                    </Price>
                                </div>
                            }
                        </DesContainer>
                    </MintContainer>
                </MainContainer>
                <Snackbar
                    open={alertState.open}
                    autoHideDuration={6000}
                    onClose={() => setAlertState({ ...alertState, open: false })}
                >
                    <Alert
                        onClose={() => setAlertState({ ...alertState, open: false })}
                        severity={alertState.severity}
                    >
                        {alertState.message}
                    </Alert>
                </Snackbar>
            </main>
            <Footer className="footer">
                <div className="copyright">© 2022 COPYRIGHT</div>
                <div>
                    <div className="fs-10">built by the playaz at</div>
                    <img src={"footer-logo.png"} style={{ marginTop: '10px' }} />
                </div>
                <div className="support-faqs">
                    <div style={{ cursor: 'pointer' }}>SUPPORT</div>
                    <div style={{ cursor: 'pointer' }}>FAQS</div>
                </div>
            </Footer>
        </div>

    );
};

export default Home;
