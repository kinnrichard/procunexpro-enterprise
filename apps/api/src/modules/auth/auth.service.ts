import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(companyName: string, username: string, password: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { companyName },
    });
    if (!tenant) throw new UnauthorizedException('Invalid credentials');

    const user = await this.prisma.user.findUnique({
      where: { tenantId_username: { tenantId: tenant.id, username } },
      include: { department: true },
    });
    if (!user?.isActive) throw new UnauthorizedException('Invalid credentials');

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account is locked. Try again later.');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: { increment: 1 },
          ...(user.failedLoginAttempts >= 4
            ? { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) }
            : {}),
        },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLogin: new Date() },
    });

    const payload = {
      sub: user.id,
      tenantId: tenant.id,
      role: user.role,
      username: user.username,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: tenant.id,
        companyName: tenant.companyName,
        departmentId: user.departmentId,
        departmentName: user.department?.name,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  async refresh(token: string) {
    const stored = await this.prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      include: { tenant: true },
    });
    if (!user?.isActive) throw new UnauthorizedException('User inactive');

    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      username: user.username,
    };

    const accessToken = this.jwtService.sign(payload);
    return { accessToken };
  }

  async logout(token: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token },
      data: { revokedAt: new Date() },
    });
  }

  async getTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async updateTenant(tenantId: string, data: any) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(data.companyName !== undefined && { companyName: data.companyName }),
        ...(data.domain !== undefined && { domain: data.domain }),
        ...(data.logo !== undefined && { logo: data.logo }),
        ...(data.settings !== undefined && { settings: data.settings }),
      },
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true, department: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar,
      tenantId: user.tenantId,
      companyName: user.tenant.companyName,
      departmentId: user.departmentId,
      departmentName: user.department?.name,
    };
  }
}
