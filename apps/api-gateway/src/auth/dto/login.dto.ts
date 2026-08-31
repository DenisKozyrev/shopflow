import { LoginRequest } from '@shopflow/proto';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto implements LoginRequest {
  @IsEmail()
  readonly email!: string;

  // No MinLength/MaxLength here on purpose — login only checks presence/type.
  // Enforcing today's password policy at login time would reject anyone whose
  // password predates that policy, and auth-service's bcrypt.compare already
  // returns a clean "invalid credentials" for a wrong password either way.
  @IsString()
  @IsNotEmpty()
  readonly password!: string;
}
