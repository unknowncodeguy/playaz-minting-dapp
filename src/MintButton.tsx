import styled from 'styled-components';
import { useEffect, useState } from 'react';
import Button from '@material-ui/core/Button';
import { CircularProgress } from '@material-ui/core';
import { GatewayStatus, useGateway } from '@civic/solana-gateway-react';
import Countdown from "react-countdown";
import { CandyMachine } from './candy-machine';
import { toDate, AlertState, getAtaForMint, getAllCollectibles } from './utils';
import {
    WAITING,
  } from './config'


export const CTAButton = styled(Button)`
  display: block !important;
  margin: 0 auto !important;
  background-color: #002454 !important;
  width: 300px !important;
  height: 80px !important;
  font-size: 1em !important;
  border: 4px solid #002454 !important;
  border-radius: 30px !important;
  color: #FFFFFF !important;
  text-align: center !important;
  font-weight: bold !important;
  box-shadow: inset 0 0 3px white !important;
`;

export const MintButton = ({
    onMint,
    candyMachine,
    isMinting,
    isActive,
    isSoldOut,
    wallet,
    mintable,
    tooManyTokens
}: {
    onMint: () => Promise<void>;
    candyMachine: CandyMachine | undefined;
    isMinting: boolean;
    isActive: boolean;
    isSoldOut: boolean;
    wallet: boolean;
    mintable: boolean;
    tooManyTokens: boolean;
}) => {
    const { requestGatewayToken, gatewayStatus } = useGateway();
    const [clicked, setClicked] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);

    const renderCounter = ({ days, hours, minutes, seconds }: any) => {
        return (    
            <span className="counter" style={{textAlign: 'center', color: 'white', display: 'block'}}>
               {seconds}
            </span>
        );
    };

    useEffect(() => {
        setIsVerifying(false);
        if (gatewayStatus === GatewayStatus.COLLECTING_USER_INFORMATION && clicked) {
            // when user approves wallet verification txn
            setIsVerifying(true);
        } else if (gatewayStatus === GatewayStatus.ACTIVE && clicked) {
            console.log('Verified human, now minting...');
            onMint();
            setClicked(false);
        }
    }, [gatewayStatus, clicked, setClicked, onMint]);

    return (
        <CTAButton
            disabled={
                candyMachine?.state.isSoldOut || isSoldOut ||
                isMinting ||
                !isActive ||
                isVerifying ||
                !wallet ||
                !mintable || 
                tooManyTokens 
            }
            onClick={async () => {
                if (isActive && candyMachine?.state.gatekeeper && gatewayStatus !== GatewayStatus.ACTIVE) {
                    console.log('Requesting gateway token');
                    setClicked(true);
                    await requestGatewayToken();
                } else {
                    console.log('Minting...');
                    await onMint();
                }
            }}
            variant="contained"
        >
            {!candyMachine ? (
                "CONNECTING..."
            ) : candyMachine?.state.isSoldOut || isSoldOut ? (
                'SOLD OUT'
            ) : isActive ? (
                isVerifying ? 'VERIFYING...' :
                    isMinting ? (
                        <div style={{ display: 'flex', textAlign: 'center', marginLeft: '50px' }}>
                            Minting...
                            <CircularProgress />
                        </div>
                    ) : !mintable ? (<Countdown
                    date={new Date(Number(localStorage.lastMintTime) + WAITING)}
                    onComplete={() => {

                    }}
                    renderer={renderCounter}
                />)
                    : tooManyTokens ? ('Mint limited.') : ("MINT HERE")
            ) : (candyMachine?.state.goLiveDate ? (
                "SOON"
            ) : (
                "UNAVAILABLE"
            ))}
        </CTAButton>
    );
};
