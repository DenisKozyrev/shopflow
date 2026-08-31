import { RegisterRequest } from '@shopflow/proto';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto implements RegisterRequest {
  @IsEmail()
  readonly email!: string;

  // Mirrors auth-service's Zod schema: bcrypt silently truncates input at 72 bytes,
  // so the upper bound has to match there too, not just the lower one.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  readonly password!: string;

  @IsString()
  @IsNotEmpty()
  readonly name!: string;
}
