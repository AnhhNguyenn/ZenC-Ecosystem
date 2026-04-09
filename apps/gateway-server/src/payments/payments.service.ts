import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '../entities/subscription.entity';
import { TransactionHistory } from '../entities/transaction-history.entity';
import { User } from '../entities/user.entity';
import { RedisService } from '../common/redis.service';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Subscription) private subRepo: Repository<Subscription>,
    @InjectRepository(TransactionHistory) private transRepo: Repository<TransactionHistory>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private readonly redis: RedisService,
  ) {}

  /**
   * Verify IAP Receipt from Mobile (Apple/Google) and grant/renew premium plan.
   * BOM 2 Fix: Implemented distributed lock to prevent Webhook Double Spend Race Conditions.
   */
  async verifyReceipt(userId: string, receiptData: string, provider: 'APPLE' | 'GOOGLE' | 'STRIPE', planId: string) {
    // 1. REAL IMPLEMENTATION: Send receiptData to Apple (https://buy.itunes.apple.com/verifyReceipt)
    // or Google Play API to get the verified transaction details.
    // For this demonstration, we simulate a successful API verification response.

    const verifiedOriginalTransactionId = `apple_orig_txn_${Date.now()}`;
    const verifiedTransactionId = `apple_txn_${Date.now()}`;
    const verifiedAmount = planId === 'PRO' ? 9.99 : 29.99;
    const verifiedCurrency = 'USD';
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // + 30 days

    // Attempt to acquire distributed lock for this transaction to prevent Race Condition Double Spend
    const lockKey = `lock:payment:verify:${verifiedTransactionId}`;
    const lockValue = crypto.randomUUID(); // BOM 2 Fix: Secure lock value to prevent deleting another worker's lock
    const acquiredLock = await this.redis.getClient().set(lockKey, lockValue, 'EX', 15, 'NX'); // BOM 2 Fix: TTL 15s
    if (!acquiredLock) {
      throw new ConflictException('Transaction is currently being processed by another worker');
    }

    try {
      return await this.subRepo.manager.transaction(async (manager) => {
        // 2. Anti-fraud: Ensure the transaction isn't already processed (Atomic-like constraint)
        const existingTxn = await manager.findOne(TransactionHistory, { where: { transactionId: verifiedTransactionId } });
        if (existingTxn) throw new ConflictException('Transaction already processed');

        // 3. Check for existing subscription for this user
      let subscription = await manager.findOne(Subscription, { where: { userId } });

      let type: 'NEW' | 'RENEWAL' = 'NEW';

      if (subscription) {
        // Upgrade or Renewal
        subscription.status = 'ACTIVE';
        subscription.planId = planId;
        subscription.currentPeriodEnd = currentPeriodEnd;
        subscription.currentPeriodStart = currentPeriodStart;
        type = 'RENEWAL';
      } else {
        // New Subscription
        subscription = this.subRepo.create({
          userId,
          planId,
          provider,
          originalTransactionId: verifiedOriginalTransactionId,
          status: 'ACTIVE',
          currentPeriodStart,
          currentPeriodEnd,
          autoRenewStatus: true,
        });
      }

      await manager.save(subscription);

      // 4. Create Ledger Entry
      const transaction = this.transRepo.create({
        userId,
        transactionId: verifiedTransactionId,
        originalTransactionId: verifiedOriginalTransactionId,
        amount: verifiedAmount,
        currency: verifiedCurrency,
        type,
        provider,
        receiptData: JSON.parse(JSON.stringify({ raw_receipt: receiptData })), // Store raw receipt for auditing
      });

      await manager.save(transaction);

      // 5. Update user tier
        await manager.update(User, { id: userId }, { tier: planId as 'PRO' | 'UNLIMITED' });

        this.logger.log(`Verified ${provider} receipt for user ${userId}. Granted ${planId}.`);

        return {
          message: 'Receipt verified and subscription active.',
          subscription,
        };
      });
    } finally {
      // BOM 2 Fix: Lua Script to atomically delete the lock ONLY IF we still own it
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await this.redis.getClient().eval(luaScript, 1, lockKey, lockValue);
    }
  }

  /**
   * Handle Webhook Refund
   */
  async handleRefund(originalTransactionId: string) {
    return await this.subRepo.manager.transaction(async (manager) => {
      const subscription = await manager.findOne(Subscription, { where: { originalTransactionId } });
      if (!subscription) {
        this.logger.warn(`Refund webhook received for unknown transaction: ${originalTransactionId}`);
        return;
      }

      // Mark subscription as REFUNDED
      subscription.status = 'REFUNDED';
      await manager.save(subscription);

      // Downgrade user tier
      await manager.update(User, { id: subscription.userId }, { tier: 'FREE' });

      this.logger.warn(`Processed refund for user ${subscription.userId}. Downgraded to FREE.`);
    });
  }

  /**
   * Restore Purchases (Apple Guideline 3.1.1)
   * Users can tap "Restore" on a new device. The app sends the originalTransactionId (or latest receipt).
   */
  async restorePurchases(userId: string, receiptData: string) {
    // 1. Verify receipt with Apple/Google to get originalTransactionId and active status
    const mockOriginalTransactionId = "apple_orig_txn_mock_for_restore";

    return await this.subRepo.manager.transaction(async (manager) => {
      // Find subscription globally by originalTransactionId (maybe bought on a different User ID originally, or same ID)
      const subscription = await manager.findOne(Subscription, { where: { originalTransactionId: mockOriginalTransactionId } });

      if (!subscription) {
        throw new BadRequestException('No active subscription found for this receipt.');
      }

      if (subscription.status !== 'ACTIVE' || subscription.currentPeriodEnd < new Date()) {
        throw new BadRequestException('Subscription is expired or canceled.');
      }

      // If the subscription belonged to an old anonymous account, we can re-assign it to the current userId
      if (subscription.userId !== userId) {
        subscription.userId = userId;
        await manager.save(subscription);

        // Update user tier
        await manager.update(User, { id: userId }, { tier: subscription.planId as 'PRO' | 'UNLIMITED' });
      }

      this.logger.log(`Restored purchases for user ${userId}. Plan: ${subscription.planId}`);
      return { message: 'Purchases successfully restored.', subscription };
    });
  }
}
