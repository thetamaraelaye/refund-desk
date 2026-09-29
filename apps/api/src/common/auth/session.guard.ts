import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  PUBLIC_KEY,
  ROLE_KEY,
  SESSION_COOKIES,
  type Session,
  type SessionRequest,
  type SessionRole,
} from './session';

// Registered as APP_GUARD: every route is closed unless it is @Public() or names its role.
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true;

    const role = this.reflector.getAllAndOverride<SessionRole | undefined>(ROLE_KEY, targets);
    if (!role) throw new ForbiddenException('This route has no audience configured');

    const request = context.switchToHttp().getRequest<SessionRequest>();
    const cookies = request.cookies as Record<string, string | undefined>;
    const token = cookies[SESSION_COOKIES[role]];
    if (!token) throw new UnauthorizedException('Sign in to continue');

    let session: Session;
    try {
      session = await this.jwt.verifyAsync<Session>(token);
    } catch {
      throw new UnauthorizedException('Your session has expired; sign in again');
    }
    if (session.role !== role) throw new ForbiddenException('Wrong kind of session');
    request.session = session;
    return true;
  }
}
