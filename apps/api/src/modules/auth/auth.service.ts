import { createHash, timingSafeEqual } from 'node:crypto';
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { CookieOptions, Response } from 'express';
import {
  SESSION_COOKIES,
  type CustomerSession,
  type Session,
  type SessionRole,
  type StaffSession,
} from '@common';
import { PrismaConfig, env } from '@configs';

const SESSION_HOURS = 8;

// Strict for staff (no cross-site navigation carries it), lax for customers arriving from links.
const cookieOptions = (role: SessionRole): CookieOptions => ({
  httpOnly: true,
  sameSite: role === 'staff' ? 'strict' : 'lax',
  secure: env.WEB_ORIGIN.startsWith('https://'),
  path: '/',
  maxAge: SESSION_HOURS * 60 * 60 * 1000,
});

// Compares digests so the comparison takes the same time whatever the input's length.
const sameSecret = (given: string, expected: string) =>
  timingSafeEqual(
    createHash('sha256').update(given).digest(),
    createHash('sha256').update(expected).digest(),
  );

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaConfig,
    private readonly jwt: JwtService,
  ) {}

  // Demo sign-in: pick a seeded customer. A real deployment would put a login in front of this.
  async startCustomerSession(customerId: string, response: Response): Promise<CustomerSession> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true },
    });
    if (!customer) throw new NotFoundException('No such customer');
    const session: CustomerSession = {
      role: 'customer',
      customerId: customer.id,
      name: customer.name,
    };
    await this.setCookie(session, response);
    return session;
  }

  async startStaffSession(name: string, password: string, response: Response) {
    if (!sameSecret(password, env.ADMIN_PASSWORD)) {
      throw new UnauthorizedException('That password is not correct');
    }
    const session: StaffSession = { role: 'staff', name: name.trim() };
    await this.setCookie(session, response);
    return session;
  }

  endSession(role: SessionRole, response: Response) {
    response.clearCookie(SESSION_COOKIES[role], { ...cookieOptions(role), maxAge: undefined });
  }

  // Both sessions at once, for the web app's header; an invalid cookie reads as signed out.
  async currentSessions(cookies: Record<string, string | undefined>) {
    const read = async <T extends Session>(role: SessionRole): Promise<T | null> => {
      const token = cookies[SESSION_COOKIES[role]];
      if (!token) return null;
      try {
        const session = await this.jwt.verifyAsync<T>(token);
        return session.role === role ? session : null;
      } catch {
        return null;
      }
    };
    return {
      customer: await read<CustomerSession>('customer'),
      staff: await read<StaffSession>('staff'),
    };
  }

  private async setCookie(session: Session, response: Response) {
    const token = await this.jwt.signAsync({ ...session }, { expiresIn: `${SESSION_HOURS}h` });
    response.cookie(SESSION_COOKIES[session.role], token, cookieOptions(session.role));
  }
}
