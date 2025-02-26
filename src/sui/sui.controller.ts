/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { SuiService } from './sui.service';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('sui')
@UseGuards(AuthGuard)
export class SuiController {
  constructor(private readonly suiService: SuiService) {}

  @Post('artwork')
  async createArtwork(
    @Body() createArtworkDto: { title: string; ipfsHash: string },
  ) {
    const artworkId = await this.suiService.createArtwork(
      createArtworkDto.title,
      createArtworkDto.ipfsHash,
    );
    return { artworkId };
  }

  @Post('artwork/:id/contributor')
  async addContributor(
    @Param('id') artworkId: string,
    @Body() addContributorDto: { address: string; sharePercentage: number },
  ) {
    const success = await this.suiService.addContributor(
      artworkId,
      addContributorDto.address,
      addContributorDto.sharePercentage,
    );
    return { success };
  }

  @Post('artwork/:id/mint')
  async mintNft(
    @Param('id') artworkId: string,
    @Body() mintedNftDto: { royaltyPercentage: number },
  ) {
    const nftId = await this.suiService.mintNft(
      artworkId,
      mintedNftDto.royaltyPercentage,
    );
    return { nftId };
  }

  @Post('artwork/:id/distribute')
  async distributeRoyalties(
    @Param('id') artworkId: string,
    @Body() distributeDto: { amount: string },
  ) {
    const amount = BigInt(distributeDto.amount);
    const success = await this.suiService.distributionRoyalties(
      artworkId,
      amount,
    );
    return { success };
  }

  @Get('artwork/:id')
  async getArtworkMetadata(@Param('id') artworkId: string) {
    const metadata = await this.suiService.getArtworkMetadata(artworkId);
    return metadata;
  }
}
