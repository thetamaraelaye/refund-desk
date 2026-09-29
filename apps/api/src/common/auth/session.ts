import {
  SetMetadata,
  createParamDecorator,
  type CustomDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

// Two audiences, two cookies: a reviewer can be signed in as a customer and as staff in one browser.
export const SESSION_COOKIES = { customer: 'customer-token', staff: 'admin-token' } as const;

export type SessionRole = keyof typeof SESSION_COOKIES;

export interface CustomerSession {
  role: 'customer';
  customerId: string;
  name: string;
}

export interface StaffSession {
  role: 'staff';
  name: string;
}

export type Session = CustomerSession | StaffSession;

export interface SessionRequest extends Request {
  session?: Session;
}

export const PUBLIC_KEY = 'isPublic';
export const ROLE_KEY = 'sessionRole';

// Opts a route out of the session guard.
export const Public = (): CustomDecorator => SetMetadata(PUBLIC_KEY, true);

// Every non-public route names its audience; a route without one is refused rather than left open.
export const CustomerOnly = (): CustomDecorator => SetMetadata(ROLE_KEY, 'customer');
export const StaffOnly = (): CustomDecorator => SetMetadata(ROLE_KEY, 'staff');

// Identity comes from the verified cookie, never from the request body.
export const CurrentCustomer = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CustomerSession => {
    const session = context.switchToHttp().getRequest<SessionRequest>().session;
    if (session?.role !== 'customer')
      throw new Error('CurrentCustomer used on a non-customer route');
    return session;
  },
);

export const CurrentStaff = createParamDecorator(
  (_data: unknown, context: ExecutionContext): StaffSession => {
    const session = context.switchToHttp().getRequest<SessionRequest>().session;
    if (session?.role !== 'staff') throw new Error('CurrentStaff used on a non-staff route');
    return session;
  },
);
