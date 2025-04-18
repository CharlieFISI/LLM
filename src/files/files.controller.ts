import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { FilesService } from './files.service';
import { AskCrmDto} from './dto/create-file.dto';
import { ApiOperation } from '@nestjs/swagger';

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

  @Post('ask-crm-db')
  @ApiOperation({ summary: 'Haz una pregunta sobre la base de datos del CRM' })
  async questionCrmDb(
    @Body() body: AskCrmDto,
  ) {
    return this.fileService.questionCrmDb(body.question);
  }
}
