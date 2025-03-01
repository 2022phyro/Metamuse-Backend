import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService, OTPService } from './auth.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  BlacklistAccess,
  BlacklistAccessSchema,
  BlacklistRefresh,
  BlacklistRefreshSchema,
  OTP,
  OTPSchema,
} from './auth.schema';
import { UsersModule } from 'src/users/users.module';
import { JwtModule } from '@nestjs/jwt';
import {
  JWT_ACCESS_TOKEN_EXPIRATION,
  JWT_ALGORITHM,
  JWT_SIGNING_KEY,
} from '@app/utils';
import { AuthGuard } from './auth.guard';
import { APP_GUARD } from '@nestjs/core';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BlacklistAccess.name, schema: BlacklistAccessSchema },
      { name: BlacklistRefresh.name, schema: BlacklistRefreshSchema },
      { name: OTP.name, schema: OTPSchema },
    ]),
    UsersModule,
    NotificationModule,
    JwtModule.register({
      global: true,
      secret: JWT_SIGNING_KEY,
      signOptions: {
        algorithm: JWT_ALGORITHM,
        expiresIn: JWT_ACCESS_TOKEN_EXPIRATION,
      },
      verifyOptions: {
        algorithms: [JWT_ALGORITHM],
        maxAge: JWT_ACCESS_TOKEN_EXPIRATION,
        ignoreExpiration: false,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OTPService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  exports: [AuthService, OTPService, MongooseModule],
})
export class AuthModule {}
