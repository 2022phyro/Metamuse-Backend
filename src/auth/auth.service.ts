import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BlacklistAccess, BlacklistRefresh, OTP } from './auth.schema';
import {
  ForbiddenError,
  IntegrityError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@app/utils';
import {
  JWT_VERIFYING_KEY,
  JWT_ALGORITHM,
  JWT_SIGNING_KEY,
  JWT_REFRESH_TOKEN_EXPIRATION,
  JWT_ACCESS_TOKEN_EXPIRATION,
  JWT_AUTH_HEADERS,
} from '@app/utils';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { encryptPassword, verifyPassword } from '@app/utils/utils.encrypt';
interface AuthTokenResponse {
  accessToken: string;
  userId: string;
  refreshToken: string;
  access_iat: string;
  refresh_iat: string;
  access_exp: string;
  refresh_exp: string;
}
interface OTPVerifyParams {
  otpId: string;
  otpType: 'EMAIL' | 'AUTHENTICATOR';
  otp?: string;
  verificationToken?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(BlacklistAccess.name)
    private blacklistAccessModel: Model<BlacklistAccess>,
    @InjectModel(BlacklistRefresh.name)
    private blacklistRefreshModel: Model<BlacklistRefresh>,
    private userService: UsersService,
    private jwtService: JwtService,
  ) {}

  async blacklistToken(
    token: string,
    model: 'access' | 'refresh',
  ): Promise<void> {
    try {
      if (model == 'access') {
        await this.blacklistAccessModel.create({ token });
      } else if (model == 'refresh') {
        await this.blacklistRefreshModel.create({ token });
      } else {
        throw new ValidationError('Invalid model');
      }
    } catch (error) {
      if (error && error?.code === 11000) {
        throw new IntegrityError('Token already blacklisted');
      }
      throw error;
    }
  }
  async isTokenBlacklisted(
    token: string,
    model: 'access' | 'refresh',
  ): Promise<boolean> {
    let blacklist: BlacklistAccess | BlacklistRefresh | null = null;
    if (model === 'access') {
      blacklist = await this.blacklistAccessModel.findOne({ token }).lean();
    } else if (model === 'refresh') {
      blacklist = await this.blacklistRefreshModel.findOne({ token }).lean();
    }
    return blacklist != null;
  }
  async clearBlacklist(): Promise<void> {
    await this.blacklistAccessModel.deleteMany({});
    await this.blacklistRefreshModel.deleteMany({});
  }
  async getTokens(
    user, //: IUserDocument
  ): Promise<AuthTokenResponse> {
    const issuedAt = Math.floor(Date.now() / 1000); // current time in seconds since the epoch
    const accessTokenExpiry = issuedAt + 60 * 60; // 1 hour from now
    const refreshTokenExpiry = issuedAt + 60 * 60 * 24 * 7; // 7 days from now
    const payload = {
      sub: user._id.toHexString(),
      lastAuthChange: user.lastAuthChange,
      iat: Math.floor(Date.now() / 1000), // current time in seconds since the epoch
    };

    const accessToken = await this.jwtService.signAsync(
      { ...payload, type: 'access' },
      {
        secret: JWT_SIGNING_KEY,
        expiresIn: JWT_ACCESS_TOKEN_EXPIRATION,
        algorithm: JWT_ALGORITHM,
      },
    );
    const refreshToken = await this.jwtService.signAsync(
      { ...payload, type: 'refresh' },
      {
        secret: JWT_SIGNING_KEY,
        expiresIn: JWT_REFRESH_TOKEN_EXPIRATION,
        algorithm: JWT_ALGORITHM,
      },
    );

    return {
      accessToken,
      refreshToken,
      userId: user._id.toHexString(),
      access_iat: new Date(issuedAt * 1000).toISOString(),
      refresh_iat: new Date(issuedAt * 1000).toISOString(),
      access_exp: new Date(accessTokenExpiry * 1000).toISOString(),
      refresh_exp: new Date(refreshTokenExpiry * 1000).toISOString(),
    };
  }
  async refreshTokens(oldRefreshToken: string): Promise<AuthTokenResponse> {
    try {
      if (await this.isTokenBlacklisted(oldRefreshToken, 'refresh')) {
        throw new ForbiddenError('Token blacklisted');
      }
      const decoded = this.jwtService.verify(oldRefreshToken, {
        secret: JWT_VERIFYING_KEY,
        algorithms: [JWT_ALGORITHM],
        maxAge: JWT_REFRESH_TOKEN_EXPIRATION,
        ignoreExpiration: false,
      });
      if (decoded.type !== 'refresh') {
        throw new ForbiddenError('Invalid token type');
      }
      const user = await this.userService.getUser(
        Types.ObjectId.createFromHexString(decoded.sub ?? ''),
      );
      if (user == null) {
        throw new ForbiddenError('User not found');
      }
      const newTokens = await this.getTokens(user);
      await this.blacklistToken(oldRefreshToken, 'refresh');
      return newTokens;
    } catch (error) {
      throw new UnauthorizedError('Invalid token');
    }
  }
}

@Injectable()
export class OTPService {
  constructor(
    @InjectModel(OTP.name) private otpModel: Model<OTP>,
  ) {}
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
  async createOTP(
    userId: Types.ObjectId,
    otpType: 'EMAIL' | 'AUTHENTICATOR',
    multiUse = false,
  ): Promise<OTP> {
    const otp = this.generateOTP();
    const hashedOTP = encryptPassword(otp);
    const verificationToken = this.generateOTP();
    const obj: any = { userId, otpType, otp: hashedOTP, verificationToken, multiUse };
    const record = await this.otpModel.create(obj);
    return record;
  }

  async verifyOTP({ otpId, otpType, otp }: Partial<OTPVerifyParams>): Promise<void> {
    const otpRecord = await this.otpModel.findOne({
      otpId,
      otpType,
    });
    if (!otpRecord) {
      throw new UnauthorizedError('Otp not found. It must have expired');
    }
    if (otpRecord.isUsed) {
      throw new UnauthorizedError('OTP already used');
    }
    if (otp && verifyPassword(otp, otpRecord.hashedOTP)) {
      otpRecord.isVerified = true;
      await otpRecord.save();
      return;
    }
    throw new UnauthorizedError('Invalid OTP');
  }

  async useOTP({ otpId, otpType, verificationToken }: Partial<OTPVerifyParams>): Promise<OTP> {
    const otpRecord = await this.otpModel.findOne({
      otpId,
      otpType,
    });
    if (!otpRecord) {
      throw new UnauthorizedError('Otp not found. It must have expired');
    }
    if (otpRecord.isUsed) {
      throw new UnauthorizedError('OTP already used');
    }
    if (verificationToken && verifyPassword(verificationToken, (otpRecord.verificationToken) as string)) {
      if (!otpRecord.multiUse) {
        otpRecord.isUsed = true;
      }
      await otpRecord.save();
      return otpRecord;
    }
    throw new UnauthorizedError('OTP verification failed');
  }

}
