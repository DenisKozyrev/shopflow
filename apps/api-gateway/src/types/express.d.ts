import { AuthenticatedUser } from '../auth/auth.guard';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
