import {
  Controller, Post, Get, Param, Body, Query, Delete,
  UseGuards, Request, HttpCode, HttpStatus, ParseUUIDPipe
} from '@nestjs/common';
import { QrService } from './qr.service';
import { IngestQrDto } from './dto/ingest-qr.dto';
import { ApproveQrDto } from './dto/approve-qr.dto';
import { RawQrCaptureDto } from './dto/raw-qr-capture.dto';
import { ManualQrDto } from './dto/manual-qr.dto';
import { DeviceTokenGuard } from '../../common/guards/device-token.guard';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('qr')
export class QrController {
  constructor(private readonly qrService: QrService) {}

  // ── Extension: ingest QR Code ──────────────────────────────
  @Post('ingest')
  @UseGuards(DeviceTokenGuard)
  @HttpCode(HttpStatus.CREATED)
  async ingest(@Body() dto: IngestQrDto, @Request() req: any) {
    return this.qrService.ingest(dto, req.device);
  }

  // ── Dashboard: ingest manual (cola QR direto pela UI) ──────
  @Post()
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.CREATED)
  async ingestManual(@Body() dto: ManualQrDto, @Request() req: any) {
    return this.qrService.ingestManual(dto.payload, dto.sourceUrl, req.user.id);
  }

  // ── Extension: ingest Raw QR Capture ───────────────────────
  @Post('raw-capture')
  @UseGuards(DeviceTokenGuard)
  @HttpCode(HttpStatus.CREATED)
  async ingestRaw(@Body() dto: RawQrCaptureDto, @Request() req: any) {
    return this.qrService.ingestRaw(dto, req.device);
  }

  // ── Dashboard: list QR codes ───────────────────────────────
  @Get()
  @UseGuards(ApiKeyGuard)
  async findAll(@Query() pagination: PaginationDto, @Request() req: any) {
    return this.qrService.findAll(req.user.id, pagination);
  }

  // ── Dashboard: get stats ───────────────────────────────────
  @Get('stats')
  @UseGuards(ApiKeyGuard)
  async getStats(@Request() req: any) {
    return this.qrService.getStats(req.user.id);
  }

  @Get('raw-captures')
  @UseGuards(ApiKeyGuard)
  async findRawCaptures(@Request() req: any) {
    return this.qrService.findRawCaptures(req.user.id);
  }

  // ── Dashboard: get one QR code ────────────────────────────
  @Get(':id')
  @UseGuards(ApiKeyGuard)
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.qrService.findOne(id, req.user.id);
  }

  // ── Dashboard: approve QR code ────────────────────────────
  @Post(':id/approve')
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveQrDto,
    @Request() req: any,
  ) {
    return this.qrService.approve(id, req.user.id, dto.amount);
  }

  // ── Dashboard: reject QR code ─────────────────────────────
  @Post(':id/reject')
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  async reject(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.qrService.reject(id, req.user.id);
  }

  @Delete('raw-capture/:id')
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  async deleteRaw(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.qrService.deleteRaw(id, req.user.id);
  }

  @Delete(':id')
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.qrService.cancel(id, req.user.id);
  }
}
