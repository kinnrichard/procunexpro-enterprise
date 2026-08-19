import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { extname, join, dirname } from 'node:path';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Stores uploads in DigitalOcean Spaces when DO_SPACES_* is configured, else
// falls back to the local filesystem (so local dev works with no config).
// Mirrors the dentro project's uploads service.
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly uploadDir = join(process.cwd(), 'uploads');
  private readonly s3: S3Client | null = null;
  private readonly useSpaces: boolean;
  private readonly bucket: string;
  private readonly baseUrl: string;

  constructor() {
    const key = process.env.DO_SPACES_KEY;
    const secret = process.env.DO_SPACES_SECRET;
    const region = process.env.DO_SPACES_REGION || 'sgp1';
    const endpoint = process.env.DO_SPACES_ENDPOINT || `https://${region}.digitaloceanspaces.com`;
    this.bucket = process.env.DO_SPACES_BUCKET || '';
    this.baseUrl = (process.env.DO_SPACES_CDN_URL || `https://${this.bucket}.${region}.digitaloceanspaces.com`).replace(/\/+$/, '');

    if (key && secret && key !== 'xxx' && secret !== 'xxx' && this.bucket) {
      this.s3 = new S3Client({
        endpoint,
        region,
        credentials: { accessKeyId: key, secretAccessKey: secret },
        forcePathStyle: false,
      });
      this.useSpaces = true;
      this.logger.log(`Uploads → DigitalOcean Spaces (bucket "${this.bucket}")`);
    } else {
      this.useSpaces = false;
      if (!existsSync(this.uploadDir)) mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log('Uploads → local filesystem');
    }
  }

  private makeName(file: Express.Multer.File): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${extname(file.originalname).toLowerCase()}`;
  }

  // Save a file; returns the response shape the frontend expects.
  async save(file: Express.Multer.File, subDir = ''): Promise<{ fileName: string; fileUrl: string; fileSize: number; mimeType: string }> {
    if (!file) throw new BadRequestException('No file uploaded');
    const name = this.makeName(file);
    const rel = subDir ? `${subDir}/${name}` : name;

    if (this.useSpaces && this.s3) {
      const objectKey = `uploads/${rel}`;
      await this.s3.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
        CacheControl: 'public, max-age=31536000, immutable',
      }));
      return { fileName: file.originalname, fileUrl: `${this.baseUrl}/${objectKey}`, fileSize: file.size, mimeType: file.mimetype };
    }

    // Local filesystem fallback
    const full = join(this.uploadDir, rel);
    const dir = dirname(full);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(full, file.buffer);
    return { fileName: file.originalname, fileUrl: `/uploads/${rel}`, fileSize: file.size, mimeType: file.mimetype };
  }

  // Best-effort delete (accepts a full Spaces URL or a local /uploads path).
  async remove(fileUrl?: string): Promise<void> {
    if (!fileUrl) return;
    if (this.useSpaces && this.s3) {
      try {
        const key = fileUrl.startsWith('http')
          ? new URL(fileUrl).pathname.replace(/^\/+/, '')
          : `uploads/${fileUrl.replace(/^\/?uploads\//, '')}`;
        await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      } catch (e: any) {
        this.logger.warn(`Failed to delete from Spaces: ${fileUrl} (${e?.message})`);
      }
      return;
    }
    try {
      const rel = fileUrl.replace(/^\/?uploads\//, '');
      const full = join(this.uploadDir, rel);
      if (existsSync(full)) unlinkSync(full);
    } catch {
      // ignore
    }
  }
}
