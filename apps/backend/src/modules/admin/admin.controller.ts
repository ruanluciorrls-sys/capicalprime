import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, ParseUUIDPipe,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateUserDto, UpdateUserDto, ExtendSubscriptionDto, SetPasswordDto } from './dto/admin-user.dto';

/**
 * Painel ADMIN — somente MASTER_ADMIN e ADMIN podem acessar.
 * Operações destrutivas (delete, rebaixar master) restritas a MASTER_ADMIN.
 */
@Controller('admin')
@UseGuards(ApiKeyGuard, RolesGuard)
@Roles('MASTER_ADMIN', 'ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listUsers({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
    });
  }

  @Get('users/:id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUser(id);
  }

  @Post('users')
  @Roles('MASTER_ADMIN')
  async create(@Body() dto: CreateUserDto, @Request() req: any) {
    return this.adminService.createUser(dto, req.user.id);
  }

  @Patch('users/:id')
  @Roles('MASTER_ADMIN')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Request() req: any,
  ) {
    return this.adminService.updateUser(id, dto, req.user.id);
  }

  @Delete('users/:id')
  @Roles('MASTER_ADMIN')
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.adminService.deleteUser(id, req.user.id);
  }

  @Post('users/:id/extend-subscription')
  @Roles('MASTER_ADMIN')
  async extend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExtendSubscriptionDto,
    @Request() req: any,
  ) {
    return this.adminService.extendSubscription(id, dto, req.user.id);
  }

  @Post('users/:id/revoke-session')
  @Roles('MASTER_ADMIN')
  async revoke(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.adminService.revokeSession(id, req.user.id);
  }

  @Post('users/:id/set-password')
  @Roles('MASTER_ADMIN')
  async setPwd(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPasswordDto,
    @Request() req: any,
  ) {
    return this.adminService.setPassword(id, dto, req.user.id);
  }

  @Post('users/:id/reset-password')
  @Roles('MASTER_ADMIN')
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    return this.adminService.resetUserPassword(id, req.user.id);
  }

  @Post('users/:id/rotate-api-key')
  @Roles('MASTER_ADMIN')
  async rotate(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.rotateApiKey(id);
  }

  @Get('users/:id/preferences')
  @Roles('MASTER_ADMIN')
  async getPreferences(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserPreferences(id);
  }

  @Patch('users/:id/preferences')
  @Roles('MASTER_ADMIN')
  async updatePreferences(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.adminService.updateUserPreferences(id, body, req.user.id);
  }
}
