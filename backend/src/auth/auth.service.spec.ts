import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

describe('AuthService', () => {
  let service: AuthService;
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  const jwt = {
    signAsync: jest.fn().mockResolvedValue('signed-token'),
    verifyAsync: jest.fn(),
  };
  const config = {
    getOrThrow: jest.fn().mockReturnValue('secret'),
    get: jest.fn().mockReturnValue('15m'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      prisma as never,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
    );
  });

  describe('register', () => {
    const dto: RegisterDto = {
      name: 'Budi',
      email: 'budi@example.com',
      password: 'password123',
    };

    it('berhasil register user baru dengan role END_USER', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u1',
        name: 'Budi',
        email: 'budi@example.com',
        passwordHash: 'hash',
        role: Role.END_USER,
        department: null,
        isActive: true,
      });

      const result = await service.register(dto);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: Role.END_USER }),
        }),
      );
      expect(result.user.role).toBe(Role.END_USER);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('menolak email yang sudah terdaftar', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-existing' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const dto: LoginDto = {
      email: 'budi@example.com',
      password: 'password123',
    };

    it('menolak password yang salah', async () => {
      const hash = await bcrypt.hash('password-lain', 4);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        passwordHash: hash,
        isActive: true,
      });

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('menolak user nonaktif', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        passwordHash: await bcrypt.hash(dto.password, 4),
        isActive: false,
      });

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('berhasil login dengan kredensial benar', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        name: 'Budi',
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, 4),
        role: Role.AGENT,
        department: 'IT',
        isActive: true,
      });

      const result = await service.login(dto);

      expect(result.user.role).toBe(Role.AGENT);
      expect(result.accessToken).toBe('signed-token');
    });
  });
});
