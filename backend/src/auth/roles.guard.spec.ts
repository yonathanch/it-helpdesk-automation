import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Roles, ROLES_KEY } from './roles.decorator';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  const reflector = {
    getAllAndOverride: jest.fn(),
  };

  const createContext = (userRole?: Role): ExecutionContext => {
    const request = {
      user: userRole ? { sub: 'u1', role: userRole } : undefined,
    };
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('mengizinkan endpoint tanpa dekorator @Roles untuk role apa pun', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(createContext(Role.END_USER))).toBe(true);
  });

  it('mengizinkan role yang sesuai @Roles(ADMIN)', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

    expect(guard.canActivate(createContext(Role.ADMIN))).toBe(true);
  });

  it('menolak role yang tidak sesuai dengan ForbiddenException', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

    expect(() => guard.canActivate(createContext(Role.AGENT))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(createContext(Role.END_USER))).toThrow(
      ForbiddenException,
    );
  });

  it('menolak request tanpa user (belum terautentikasi)', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.AGENT]);

    expect(() => guard.canActivate(createContext())).toThrow(
      ForbiddenException,
    );
  });

  it('dekorator @Roles menyimpan metadata dengan benar', () => {
    const realReflector = new Reflector();
    const handler = () => undefined;
    Roles(Role.ADMIN, Role.AGENT)(handler);

    expect(
      realReflector.getAllAndOverride<Role[]>(ROLES_KEY, [handler]),
    ).toEqual([Role.ADMIN, Role.AGENT]);
  });
});
