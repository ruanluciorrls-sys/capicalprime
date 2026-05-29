import { Controller, Get, Patch, Body, UseGuards, Request, Query, Param, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { UpdateBankConfigDto } from './dto/update-bank-config.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(ApiKeyGuard)
  async findAll(@Query() pagination: PaginationDto) {
    return this.usersService.findAll(pagination);
  }

  @Get('me')
  @UseGuards(ApiKeyGuard)
  async getProfile(@Request() req) {
    return req.user;
  }

  @Patch('me/bank-config')
  @UseGuards(ApiKeyGuard)
  async updateBankConfig(@Request() req, @Body() body: UpdateBankConfigDto) {
    return this.usersService.updateBankConfig(req.user.id, body.bankAdapter, body.bankConfig || {}, body.dryRun);
  }

  @Patch('me/bank-config/asaas/:environment')
  @UseGuards(ApiKeyGuard)
  async updateAsaasConfig(@Request() req, @Body() body: UpdateBankConfigDto, @Param('environment') environment: string) {
    const allowed = ['production', 'production2', 'production3', 'sandbox'];
    if (!allowed.includes(environment)) {
      throw new BadRequestException(`Environment must be one of: ${allowed.join(', ')}`);
    }
    return this.usersService.updateAsaasConfig(req.user.id, environment, body.bankConfig || {}, body.dryRun);
  }

  @Patch('me/preferences')
  @UseGuards(ApiKeyGuard)
  async updatePreferences(@Request() req, @Body() body: any) {
    return this.usersService.updatePreferences(req.user.id, body);
  }

  @Get('me/bank-config')
  @UseGuards(ApiKeyGuard)
  async getBankConfig(@Request() req) {
    return this.usersService.getBankConfig(req.user.id);
  }
}
