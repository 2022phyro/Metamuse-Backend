/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
// The main service that interacts with the Sui blockchain

import { Injectable } from '@nestjs/common';
import { SuiClient, SuiHTTPTransport } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64 } from '@mysten/sui/utils';

@Injectable()
export class SuiService {
  private client: SuiClient;
  private keypair: Ed25519Keypair;
  private contractAddress: string;

  constructor() {
    const rpcUrl = process.env.SUI_RPC_URL;
    this.client = new SuiClient({
      transport: new SuiHTTPTransport({
        url: rpcUrl || 'https://fullnode.mainnet.sui.io:443',
      }),
    });

    const privatekeyBase64 = process.env.SUI_PRIVATE_KEY;
    if (!privatekeyBase64) {
      console.warn(
        'Warning: SUI_PRIVATE_KEY is not defined in environment variables',
      );
      this.keypair = new Ed25519Keypair();
    } else {
      const privatekeyBytes = fromBase64(privatekeyBase64);
      this.keypair = Ed25519Keypair.fromSecretKey(privatekeyBytes);
    }

    this.contractAddress = process.env.SUI_CONTRACT_ADDRESS || '0x0';
  }

  /**
   * Create a new artwork on the blockchain
   */
  async createArtwork(title: string, ipfsHash: string): Promise<string> {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.contractAddress}::artwork::create_artwork`,
      arguments: [
        tx.pure(new TextEncoder().encode(title)),
        tx.pure(new TextEncoder().encode(ipfsHash)),
      ],
    });

    const result = await this.client.signAndExecuteTransaction({
      signer: this.keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    const artworkCreatedEvent = result.events?.find((event) =>
      event.type.includes('::artwork::ArtworkCreated'),
    );

    if (!artworkCreatedEvent) {
      throw new Error(
        'Failed to create artwork: Event not found in transaction result',
      );
    }

    const parseData = artworkCreatedEvent.parsedJson as { artwork_id: string };

    return parseData.artwork_id;
  }

  /**
   * Add a contributor to an existing artwork
   */
  async addContributor(
    artworkId: string,
    contributorAddress: string,
    sharePercentage: number,
  ): Promise<boolean> {
    const tx = new Transaction();

    const artwork = tx.object(artworkId);

    tx.moveCall({
      target: `${this.contractAddress}::artwork::add_contributor`,
      arguments: [
        artwork,
        tx.pure(new TextEncoder().encode(contributorAddress)),
        tx.pure.u64(sharePercentage),
      ],
    });

    const result = await this.client.signAndExecuteTransaction({
      signer: this.keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    return result.effects?.status.status === 'success';
  }
  /**
   * Mint an NFT from an artwork
   */
  async mintNft(artworkId: string, royaltyPercentage: number): Promise<string> {
    const tx = new Transaction();

    const artwork = tx.object(artworkId);

    const nft = tx.moveCall({
      target: `${this.contractAddress}::artwork::mint_nft`,
      arguments: [artwork, tx.pure.u64(royaltyPercentage)],
    });
    // Transfer the NFT to the caller
    const senderAddress = this.keypair.toSuiAddress();
    tx.transferObjects([nft], tx.pure.address(senderAddress));

    const result = await this.client.signAndExecuteTransaction({
      signer: this.keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    const createObject = result.effects?.created?.find(
      (obj) => obj.owner === senderAddress,
    );
    if (!createObject) {
      throw new Error(
        'Failed to mint NFT: Created object not found in transaction result',
      );
    }
    return createObject.reference.objectId;
  }
  /**
   * Distribute royalties to contributors
   */
  async distributionRoyalties(
    artworkId: string,
    paymentAmount: bigint,
  ): Promise<boolean> {
    const tx = new Transaction();

    const artwork = tx.object(artworkId);

    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u256(paymentAmount)]);

    tx.moveCall({
      target: `${this.contractAddress}::artwork::distribute_royalties`,
      arguments: [artwork, coin],
    });
    const result = await this.client.signAndExecuteTransaction({
      signer: this.keypair,
      transaction: tx,
      options: {
        showEffects: true,
      },
    });
    return result.effects?.status.status === 'success';
  }
  /**
   * Check if an artwork is minted
   */
  async isArtworkMinted(artworkId: string): Promise<boolean> {
    try {
      const object = await this.client.getObject({
        id: artworkId,
        options: {
          showContent: true,
        },
      });
      if (
        object.data?.content &&
        'fields' in object.data.content // check if field exist
      ) {
        const field = (object.data.content as any).fields;
        return field?.is_minted ?? false;
      }

      return false;
    } catch (error) {
      console.error('Error checking if artwork is minted:', error);
      return false;
    }
  }
  /**
   * Get artwork metadata
   */
  async getArtworkMetadata(artworkId: string): Promise<any> {
    try {
      const object = await this.client.getObject({
        id: artworkId,
        options: {
          showContent: true,
        },
      });
      if (
        object.data?.content &&
        'fields' in object.data.content // check if field in object
      ) {
        const field = (object.data.content as any).fields;
        return field?.is_minted ?? false;
      }
      return false;
    } catch (error) {
      console.error('Error fetching artwork metadata:', error);
      throw new Error('Failed to fetch artwork metadata');
    }
  }
}
