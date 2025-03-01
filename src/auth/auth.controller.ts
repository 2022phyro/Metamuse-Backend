/* The AuthController class in this TypeScript code handles authentication and user account
verification operations with error handling for various scenarios. */
import {
  Body,
  Controller,
  HttpCode,
  Post,
  Request,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  UsePipes,
  ForbiddenException,
  UseGuards,
  Get,
} from '@nestjs/common';
import { omit } from 'lodash'
import { UsersService } from 'src/users/users.service';
import { AuthService, OTPService } from './auth.service';
import { AllowAny } from './auth.decorator';
import {
  ForbiddenError,
  IntegrityError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  ZodValidationPipe,
} from '@app/utils';
import {
  LoginDto,
  loginSchema,
  LogoutDto,
  logoutSchema,
  OtpRequestDto,
  otpRequestSchema,
  otpSchema,
  SignupDto,
  signupSchema,
} from './auth.dto';
import { OTPRequired } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly otpservice: OTPService,
  ) {}

  @AllowAny()
  @HttpCode(200)
  @Post('login')
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(@Body() body: LoginDto): Promise<any> {
    try {
      const user = await this.usersService.loginUser(body.email, body.password);
      const tokens = await this.authService.getTokens(user);
      return tokens;
    } catch (error) {
      if (error instanceof NotFoundError)
        throw new NotFoundException(error.message, error.name);
      else if (error instanceof UnauthorizedError)
        throw new UnauthorizedException(error.message, error.name);
      else throw new BadRequestException(error.message);
    }
  }

  @AllowAny()
  @HttpCode(201)
  @Post('signup')
  @UsePipes(new ZodValidationPipe(signupSchema))
  async signup(@Body() body: SignupDto): Promise<any> {
    try {
      await this.usersService.signupUser(body);
      return { message: 'Signup successful, Proceed to verify your account' };
    } catch (error) {
      if (error instanceof IntegrityError)
        throw new ConflictException(error.message, error.name);
      else throw new BadRequestException(error.message);
    }
  }

  @AllowAny()
  @HttpCode(200)
  @Post('refresh')
  @UsePipes(new ZodValidationPipe(logoutSchema))
  async refresh(@Body() body: LogoutDto): Promise<any> {
    try {
      const tokens = await this.authService.refreshTokens(body.token);
      return tokens;
    } catch (error) {
      if (error instanceof ForbiddenError)
        throw new ForbiddenException(error.message);
      else if (error instanceof UnauthorizedError)
        throw new UnauthorizedException(error.message);
      else if (error instanceof IntegrityError)
        throw new ConflictException(error.message);
      else throw new BadRequestException(error.message);
    }
  }

  @Post('logout')
  @UsePipes(new ZodValidationPipe(logoutSchema))
  async logout(@Request() req, @Body() body: LogoutDto): Promise<any> {
    try {
      await this.authService.blacklistToken(req.token, 'access');
      await this.authService.blacklistToken(body.token, 'refresh');
      return { message: 'Successfully logged out' };
    } catch (error) {
      if (error instanceof ValidationError)
        throw new BadRequestException(error.message);
      else if (error instanceof IntegrityError)
        throw new ConflictException(error.message);
      else throw new BadRequestException(error.message);
    }
  }

  @AllowAny()
  @UseGuards(OTPRequired)
  @Post('account/verify')
  async verifyAccount(@Request() req, @Body() body: any): Promise<any> {
    try {
      const email = body.email;
      const user: any = await this.usersService.findOne(null, { email });
      if (
        req.otpRecord &&
        req.otpRecord.userId.toString() != user._id.toString()
      ) {
        throw new UnauthorizedError(
          "You're not permitted to carry this out. Request a new otp",
        );
      }
      if (user.status == 'active') {
        throw new UnauthorizedError('Account already verified');
      }
      user.status = 'active';
      await user.save();
      return { message: 'Account verified successfully..Proceed to log in' };
    } catch (error) {
      if (error instanceof UnauthorizedError)
        throw new UnauthorizedException(error.message);
      else throw new BadRequestException(error.message);
    }
  }

  @AllowAny()
  @UseGuards(OTPRequired)
  @Post('password/reset')
  async resetPassword(@Request() req, @Body() body: any): Promise<any> {
    try {
      const email = body.email;
      const user: any = await this.usersService.findOne(null, { email });
      if (req.otpRecord && req.otpRecord.userId != user._id) {
        throw new UnauthorizedError(
          "You're not permitted to carry this out. Request a new otp",
        );
      }
      const password = body.password;
      await this.usersService.update(user._id, { password });
      return { message: 'Password reset successfully' };
    } catch (error) {
      if (error instanceof UnauthorizedError)
        throw new UnauthorizedException(error.message);
      if (error instanceof NotFoundError)
        throw new NotFoundException(error.message);
      else throw new BadRequestException(error.message);
    }
  }

  @AllowAny()
  @Post('otp/request')
  @UsePipes(new ZodValidationPipe(otpRequestSchema))
  async requestOTP(@Body() body: OtpRequestDto): Promise<any> {
    try {
      const email = body.email;
      const user: any = await this.usersService.findOne(null, { email });
      const otp = await this.otpservice.createOTP(
        user._id,
        body.otpType,
        body.multiUse,
      );
      this.otpservice.sendOTP(otp, user);
      return { message: 'OTP sent successfully'};
    } catch (error) {
      if (error instanceof UnauthorizedError)
        throw new UnauthorizedException(error.message);
      else throw new BadRequestException(error.message);
    }
  }

  @AllowAny()
  @Post('otp/verify')
  @UsePipes(new ZodValidationPipe(otpSchema))
  async verifyOTP(@Body() body: OtpRequestDto): Promise<any> {
    try {
      const result = await this.otpservice.verifyOTP(body);
      return { message: 'OTP verified successfully', result };
    } catch (error) {
      if (error instanceof UnauthorizedError)
        throw new UnauthorizedException(error.message);
      else throw new BadRequestException(error.message);
    }
    // Verify OTP
  }
  @Get('account')
  async profile(@Request() req): Promise<any> {
    try {
      const sanitizedResult = omit(req.user.toJSON(), ['password', 'lastAuthChange', '__v'])
      return sanitizedResult;
    } catch (error) {
      console.log('Error', error);
      throw new UnauthorizedException(error.message);
    }
  }
}
