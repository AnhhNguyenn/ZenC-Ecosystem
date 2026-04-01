import { IsString, IsNotEmpty, IsEnum } from 'class-validator';

export class VerifyReceiptDto {
  @IsString()
  @IsNotEmpty()
  receiptData!: string;

  @IsEnum(['APPLE', 'GOOGLE', 'STRIPE'])
  provider!: 'APPLE' | 'GOOGLE' | 'STRIPE';

  @IsString()
  @IsNotEmpty()
  planId!: string; // 'PRO' or 'UNLIMITED'
}
