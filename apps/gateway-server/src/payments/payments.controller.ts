import { Controller, Post, UseGuards, Body, Req, HttpCode, HttpStatus, Version } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { VerifyReceiptDto } from './payments.dto';
import { JwtPayload } from '../auth/auth.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('verify-receipt')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyReceipt(
    @Req() request: Request & { user: JwtPayload },
    @Body() dto: VerifyReceiptDto,
  ) {
    return this.paymentsService.verifyReceipt(request.user.sub, dto.receiptData, dto.provider, dto.planId);
  }

  @Post('restore-purchases')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async restorePurchases(
    @Req() request: Request & { user: JwtPayload },
    @Body() dto: { receiptData: string },
  ) {
    return this.paymentsService.restorePurchases(request.user.sub, dto.receiptData);
  }
}
