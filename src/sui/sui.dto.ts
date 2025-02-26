import { IsString, IsNumber, Min, Max, IsNotEmpty } from 'class-validator';

export class CreateArtworkDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  ipfsHash: string;
}

export class AddContributorDto {
  @IsString()
  @IsNotEmpty()
  address: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  sharePercentage: number;
}

export class MintNftDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  royaltyPercentage: number;
}

export class DistributeRoyaltyDto {
  @IsString()
  @IsNotEmpty()
  amount: string;
}
