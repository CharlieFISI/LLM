import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { FilesService } from './files.service';
import { ApiKeyGuard } from 'src/common/api-key.guard';

@UseGuards(ApiKeyGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly fileService: FilesService) {}

  @Post('all-minilm')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './documents/input',
        filename: (_req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(
            null,
            `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`,
          );
        },
      }),
    }),
  )
  async uploadFileOllamaAllMinilm(@UploadedFile() file: Express.Multer.File) {
    return await this.fileService.processFileOllamaAllMinilm(file);
  }

  @Post('openai-3-small')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './documents/input',
        filename: (_req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(
            null,
            `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`,
          );
        },
      }),
    }),
  )
  async uploadFileOpenAI3Small(@UploadedFile() file: Express.Multer.File) {
    return await this.fileService.processFileOpenAI3Small(file);
  }

  @Post('embed-schema')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './documents/input',
        filename: (_req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(
            null,
            `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`,
          );
        },
      }),
    }),
  )
  async embedSchema(
    @UploadedFile() file: Express.Multer.File,
    @Body('model') model: string,
  ) {
    return await this.fileService.embedSchema(file, model);
  }
}
