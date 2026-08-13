import {
  Controller, Post, UseGuards, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

// Ensure upload dir exists
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

function generateFilename(_req: any, file: Express.Multer.File, cb: any) {
  const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${extname(file.originalname)}`;
  cb(null, uniqueName);
}

const imageFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const allowed = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
  if (!allowed.test(extname(file.originalname))) {
    return cb(new BadRequestException('Only image files are allowed (JPG, PNG, GIF, WEBP, SVG)'), false);
  }
  cb(null, true);
};

const documentFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const allowed = /\.(pdf|doc|docx|xls|xlsx|csv|txt|ppt|pptx|zip|rar)$/i;
  if (!allowed.test(extname(file.originalname))) {
    return cb(new BadRequestException('Unsupported file type'), false);
  }
  cb(null, true);
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const multer = require('multer');
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: generateFilename,
});

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      fileFilter: imageFilter,
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return {
      fileName: file.originalname,
      fileUrl: `/uploads/${file.filename}`,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }

  @Post('document')
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      fileFilter: documentFilter,
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  uploadDocument(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return {
      fileName: file.originalname,
      fileUrl: `/uploads/${file.filename}`,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }
}
