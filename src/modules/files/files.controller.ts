import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { FilesService } from './files.service';

@ApiTags('Files')
@Controller()
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /** Serves GridFS-backed uploads when `STORAGE_DRIVER=mongodb`. */
  @Public()
  @Get('uploads/:folder/:filename')
  async serveUpload(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    const key = `${folder}/${filename}`;
    try {
      await this.filesService.pipeDownload(key, res);
    } catch (err) {
      if (err instanceof NotFoundException) {
        res.status(404).json({ message: err.message });
        return;
      }
      throw err;
    }
  }
}
