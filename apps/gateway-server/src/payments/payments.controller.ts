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

  @Post('webhooks/apple-s2s')
  @HttpCode(HttpStatus.OK)
  async appleWebhook(@Body() payload: any) {
    // Basic implementation for Apple Server-to-Server notifications
    // A real implementation would verify the App Store signature.
    const notificationType = payload?.notificationType || payload?.notification_type;
    if (notificationType === 'REFUND') {
      const originalTransactionId = payload?.data?.signedTransactionInfo?.originalTransactionId || payload?.auto_renew_adam_id; // Structure varies by API v1/v2
      if (originalTransactionId) {
        await this.paymentsService.handleRefund(originalTransactionId);
      }
    }
    return { received: true };
  }

  @Post('webhooks/google-rtdn')
  @HttpCode(HttpStatus.OK)
  async googleWebhook(@Body() payload: any) {
    // Basic implementation for Google Real-time Developer Notifications
    // The payload data is usually base64 encoded
    try {
      if (payload?.message?.data) {
        const decodedData = JSON.parse(Buffer.from(payload.message.data, 'base64').toString('utf8'));
        if (decodedData?.subscriptionNotification?.notificationType === 12) { // 12 = SUBSCRIPTION_REVOKED
          const purchaseToken = decodedData.subscriptionNotification.purchaseToken;
          // In Google, the purchaseToken often acts as the original transaction identifier or receipt
          if (purchaseToken) {
            await this.paymentsService.handleRefund(purchaseToken);
          }
        }
      }
    } catch (e) {
      // Ignore parse errors, just return 200 to acknowledge
    }
    return { received: true };
  }
}
