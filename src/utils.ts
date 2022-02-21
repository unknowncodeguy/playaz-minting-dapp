import * as anchor from '@project-serum/anchor';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { SystemProgram } from '@solana/web3.js';
import {
  LAMPORTS_PER_SOL,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
  PublicKey, 
  Connection
} from '@solana/web3.js';
import * as borsh from 'borsh';

import {
  REACT_TOKEN_NAME,
  REACT_NFT_AUTORITY,
  PROGRAM_ID,
  DEV_NET
} from './config'

import { Metadata, METADATA_SCHEMA } from './schema';

export interface AlertState {
  open: boolean;
  message: string;
  severity: 'success' | 'info' | 'warning' | 'error' | undefined;
}

export const toDate = (value?: anchor.BN) => {
  if (!value) {
    return;
  }

  return new Date(value.toNumber() * 1000);
};

const numberFormater = new Intl.NumberFormat('en-US', {
  style: 'decimal',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatNumber = {
  format: (val?: number) => {
    if (!val) {
      return '--';
    }

    return numberFormater.format(val);
  },
  asNumber: (val?: anchor.BN) => {
    if (!val) {
      return undefined;
    }

    return val.toNumber() / LAMPORTS_PER_SOL;
  },
};

export const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID =
  new anchor.web3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

export const CIVIC = new anchor.web3.PublicKey(
  'gatem74V238djXdzWnJf94Wo1DcnuGkfijbf3AuBhfs',
);

export const getAtaForMint = async (
  mint: anchor.web3.PublicKey,
  buyer: anchor.web3.PublicKey,
): Promise<[anchor.web3.PublicKey, number]> => {
  return await anchor.web3.PublicKey.findProgramAddress(
    [buyer.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
  );
};

export const getNetworkExpire = async (
  gatekeeperNetwork: anchor.web3.PublicKey,
): Promise<[anchor.web3.PublicKey, number]> => {
  return await anchor.web3.PublicKey.findProgramAddress(
    [gatekeeperNetwork.toBuffer(), Buffer.from('expire')],
    CIVIC,
  );
};

export const getNetworkToken = async (
  wallet: anchor.web3.PublicKey,
  gatekeeperNetwork: anchor.web3.PublicKey,
): Promise<[anchor.web3.PublicKey, number]> => {
  return await anchor.web3.PublicKey.findProgramAddress(
    [
      wallet.toBuffer(),
      Buffer.from('gateway'),
      Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),
      gatekeeperNetwork.toBuffer(),
    ],
    CIVIC,
  );
};

export function createAssociatedTokenAccountInstruction(
  associatedTokenAddress: anchor.web3.PublicKey,
  payer: anchor.web3.PublicKey,
  walletAddress: anchor.web3.PublicKey,
  splTokenMintAddress: anchor.web3.PublicKey,
) {
  const keys = [
    {
      pubkey: payer,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: associatedTokenAddress,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: walletAddress,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: splTokenMintAddress,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  return new TransactionInstruction({
    keys,
    programId: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    data: Buffer.from([]),
  });
}

export async function decodeMetadata(buffer: Buffer) {
    const METADATA_REPLACE = new RegExp('\u0000', 'g');
    const metadata = borsh.deserializeUnchecked(
      METADATA_SCHEMA,
      Metadata,
      buffer,
    );
    metadata.data.name = metadata.data.name.replace(METADATA_REPLACE, '');
    metadata.data.uri = metadata.data.uri.replace(METADATA_REPLACE, '');
    metadata.data.symbol = metadata.data.symbol.replace(METADATA_REPLACE, '');
    return metadata;
  }

export const getAllCollectibles = async (wallets: string[], filters: any[]): Promise<any> => {

    const PROGRAM = new PublicKey(PROGRAM_ID)
    const cluster = DEV_NET;
    
    try {
     
        const conn = new Connection(cluster, 'confirmed')
      if (conn === null) throw new Error('No connection')
      const connection = conn

      const tokenAccountsByOwnerAddress = await Promise.all(
        wallets.map(async address =>
          connection.getParsedTokenAccountsByOwner(new PublicKey(address), {
            programId: TOKEN_PROGRAM_ID
          })
        )
      )
      const potentialNFTsByOwnerAddress = tokenAccountsByOwnerAddress
        .map(ta => ta.value)
        // value is an array of parsed token info
        .map((value) => {
          const mintAddresses = value
            .map(v => ({
              mint: v.account.data.parsed.info.mint,
              tokenAmount: v.account.data.parsed.info.tokenAmount,
              tokenAccount: v.pubkey.toString()
            }))
            .filter(({ tokenAmount }) => {
              // Filter out the token if we don't have any balance
              const ownsNFT = tokenAmount.amount !== '0'
              // Filter out the tokens that don't have 0 decimal places.
              // NFTs really should have 0
              const hasNoDecimals = tokenAmount.decimals === 0
              return ownsNFT && hasNoDecimals
            })
            .map(({ mint, tokenAccount }) => ({ mint, tokenAccount }))
          return { mintAddresses }
        })
      const nfts = await Promise.all(
        potentialNFTsByOwnerAddress.map(async ({ mintAddresses }) => {
          const programAddresses: any = await Promise.all(
            mintAddresses.map(
              async mintAddress => {
                const program = await PublicKey.findProgramAddress(
                  [
                    Buffer.from('metadata'),
                    PROGRAM.toBytes(),
                    new PublicKey(mintAddress.mint).toBytes()
                  ],
                  PROGRAM
                );
              return {
                ...mintAddress,
                program
              }
            }
          ))
          let accountInfos: any[] = [];
          for (let cur = 0; cur < programAddresses.length;) {
            let subAddresses = programAddresses.slice(cur, cur + 100);
            let subAccountInfos = await connection.getMultipleAccountsInfo(
              subAddresses.map((program: any) => program.program[0] )
            )
            accountInfos = [ ...accountInfos, ...subAccountInfos ];
            cur += 100;
          }
          accountInfos = accountInfos.map((account, index) => ({
            account,
            ...programAddresses[index]
          }))
          const nonNullInfos = accountInfos?.filter((info: any) => info.account) ?? []
          let metadataList: any[] = [];
          let tokenInfoList: any [] = [];

          for (let i = 0; i < nonNullInfos.length; i ++) {
            
            let metadata = await decodeMetadata(nonNullInfos[i].account!.data);
            
            if (filters.find(filter => metadata.updateAuthority === filter.updateAuthority &&  metadata?.data?.name.indexOf(filter.collectionName) >= 0)) {
              metadataList.push({
                ...metadata,
                ...metadata.data
              });
    
              tokenInfoList.push(nonNullInfos[i]);
            }
          }

          return tokenInfoList.length;
        })
      )
      return nfts;
    } catch (e) {
      console.error('Unable to get collectibles', e)
      return 3;
    }
}
