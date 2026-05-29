import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { LogsService } from './logs.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  @UseGuards(ApiKeyGuard)
  async findAll(@Query() pagination: PaginationDto) {
    return this.logsService.findAll(pagination);
  }
}


