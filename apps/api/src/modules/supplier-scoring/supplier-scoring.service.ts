import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SupplierScoringService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    params: { page?: number; limit?: number; search?: string; period?: string },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (params.period) {
      where.period = params.period;
    }

    if (params.search) {
      where.vendor = {
        name: { contains: params.search, mode: 'insensitive' },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.supplierScore.findMany({
        where,
        skip,
        take: limit,
        orderBy: { overall: 'desc' },
        include: {
          vendor: { select: { id: true, name: true } },
        },
      }),
      this.prisma.supplierScore.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getLeaderboard(tenantId: string) {
    const scores = await this.prisma.supplierScore.groupBy({
      by: ['vendorId'],
      where: { tenantId },
      _avg: {
        quality: true,
        delivery: true,
        pricing: true,
        service: true,
        overall: true,
      },
      _count: { id: true },
      orderBy: { _avg: { overall: 'desc' } },
    });

    const vendorIds = scores.map((s) => s.vendorId);
    const vendors = await this.prisma.vendor.findMany({
      where: { id: { in: vendorIds } },
      select: { id: true, name: true },
    });
    const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));

    return scores.map((s) => ({
      vendorId: s.vendorId,
      vendorName: vendorMap.get(s.vendorId) || 'Unknown',
      avgQuality: Math.round((s._avg.quality || 0) * 100) / 100,
      avgDelivery: Math.round((s._avg.delivery || 0) * 100) / 100,
      avgPricing: Math.round((s._avg.pricing || 0) * 100) / 100,
      avgService: Math.round((s._avg.service || 0) * 100) / 100,
      avgOverall: Math.round((s._avg.overall || 0) * 100) / 100,
      scoreCount: s._count.id,
    }));
  }

  async getVendorScores(tenantId: string, vendorId: string) {
    return this.prisma.supplierScore.findMany({
      where: { tenantId, vendorId },
      include: {
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { period: 'desc' },
    });
  }

  async create(tenantId: string, data: any) {
    const quality = data.quality || 0;
    const delivery = data.delivery || 0;
    const pricing = data.pricing || 0;
    const service = data.service || 0;
    const overall = Math.round(((quality + delivery + pricing + service) / 4) * 100) / 100;

    return this.prisma.supplierScore.create({
      data: {
        tenantId,
        vendorId: data.vendorId,
        period: data.period,
        quality,
        delivery,
        pricing,
        service,
        overall,
        notes: data.notes || null,
        scoredBy: data.scoredBy || null,
      },
      include: {
        vendor: { select: { id: true, name: true } },
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const score = await this.prisma.supplierScore.findFirst({ where: { id, tenantId } });
    if (!score) throw new NotFoundException('Score not found');

    const quality = data.quality === undefined ? score.quality : data.quality;
    const delivery = data.delivery === undefined ? score.delivery : data.delivery;
    const pricing = data.pricing === undefined ? score.pricing : data.pricing;
    const service = data.service === undefined ? score.service : data.service;
    const overall = Math.round(((quality + delivery + pricing + service) / 4) * 100) / 100;

    const updateData: any = { quality, delivery, pricing, service, overall };
    if (data.period !== undefined) updateData.period = data.period;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.scoredBy !== undefined) updateData.scoredBy = data.scoredBy;

    return this.prisma.supplierScore.update({
      where: { id },
      data: updateData,
      include: {
        vendor: { select: { id: true, name: true } },
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const score = await this.prisma.supplierScore.findFirst({ where: { id, tenantId } });
    if (!score) throw new NotFoundException('Score not found');
    await this.prisma.supplierScore.delete({ where: { id } });
    return { message: 'Score deleted' };
  }
}
