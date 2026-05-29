import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller()
export class AppController {
  @Get()
  getHello(@Res() res: Response) {
    const frontendUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return res.status(200).json({
      success: true,
      message: 'AI OS Backend API is running successfully.',
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      links: {
        health: '/api/v1/health',
        ping: '/api/v1/health/ping',
        dashboard: frontendUrl,
      }
    });
  }
}
