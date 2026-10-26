import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';

@Controller('uploads')
export class UploadsController {
  @UseGuards(JwtAuthGuard)
  @Post('menu')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = process.env.VERCEL
            ? join('/tmp', 'uploads')
            : join(process.cwd(), 'uploads');
          if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
          }
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          return cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|pdf)$/)) {
          return cb(
            new BadRequestException('Only image files and PDFs are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  uploadMenu(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return {
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      url: `/uploads/${file.filename}`,
    };
  }
}
