import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  JWT_ACCESS_TOKEN_EXPIRATION,
  JWT_REFRESH_TOKEN_EXPIRATION,
  OTP_EXPIRATION,
} from '@app/utils';

export type BlacklistAccessDocument = HydratedDocument<BlacklistAccess>;
export type BlacklistRefreshDocument = HydratedDocument<BlacklistRefresh>;
@Schema({
  timestamps: true,
  expires: JWT_ACCESS_TOKEN_EXPIRATION,
})
export class BlacklistAccess {
  @Prop({ required: true, unique: true })
  token: string;
}

@Schema({
  timestamps: true,
  expires: JWT_REFRESH_TOKEN_EXPIRATION,
})
export class BlacklistRefresh {
  @Prop({ required: true, unique: true })
  token: string;
}

@Schema({
  timestamps: true,
})
export class OTP {
  @Prop({ required: true })
  hashedOTP: string;
  
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, default: () => new Date(Date.now() + OTP_EXPIRATION * 1000) })
  expiresAt: Date; // Add this
  
  @Prop({ default: false })
  isUsed: boolean;
  
  @Prop({ enum: ['EMAIL', 'AUTHENTICATOR'], default: 'EMAIL' })
  otpType: string;
  
  @Prop()
  verificationToken?: string;
}


export const BlacklistRefreshSchema =
  SchemaFactory.createForClass(BlacklistRefresh);
export const BlacklistAccessSchema =
  SchemaFactory.createForClass(BlacklistAccess);
export const OTPSchema = SchemaFactory.createForClass(OTP);
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
