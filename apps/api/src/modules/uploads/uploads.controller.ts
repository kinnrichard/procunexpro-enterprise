import {
  Controller, Post, UseGuards, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'node:path';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UploadsService } from './uploads.service';

const imageFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  if (!/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(extname(file.originalname))) {
    return cb(new BadRequestException('Only image files are allowed (JPG, PNG, GIF, WEBP, SVG)'), false);
  }
  cb(null, true);
};

const documentFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  if (!/\.(pdf|doc|docx|xls|xlsx|csv|txt|ppt|pptx|zip|rar)$/i.test(extname(file.originalname))) {
    return cb(new BadRequestException('Unsupported file type'), false);
  }
  cb(null, true);
};

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), fileFilter: imageFilter, limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.uploads.save(file);
  }

  @Post('document')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), fileFilter: documentFilter, limits: { fileSize: 50 * 1024 * 1024 } }))
  uploadDocument(@UploadedFile() file: Express.Multer.File) {
    return this.uploads.save(file, 'documents');
  }
}
