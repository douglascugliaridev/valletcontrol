import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { AuthResponse, User } from '@valletcontrol/shared';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../common/auth/decorators/current-user.decorator';
import { Public } from '../../../common/auth/decorators/public.decorator';
import { GetMeUseCase } from '../application/use-cases/get-me.use-case';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { RegisterUseCase } from '../application/use-cases/register.use-case';
import { LoginDto, RegisterDto } from './dto/auth.dto';

/** Controller REST — adaptador primário (frame driver adapter) do módulo auth. */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly getMeUseCase: GetMeUseCase,
  ) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.registerUseCase.execute(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.loginUseCase.execute(dto);
  }

  @Get('me')
  me(@CurrentUser() authUser: AuthenticatedUser): Promise<User> {
    return this.getMeUseCase.execute(authUser.userId);
  }
}
