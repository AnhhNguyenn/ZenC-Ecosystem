/**
 * CircuitBreaker – Lightweight provider failover protection.
 *
 * States:
 *   CLOSED    - Normal operation, requests pass through.
 *   OPEN      - Too many failures, all requests immediately rejected.
 *   HALF_OPEN - After resetTimeout, one probe request allowed.
 */

import { Logger } from '@nestjs/common';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit. Default: 3 */
  failureThreshold?: number;
  /** How long (ms) the circuit stays OPEN before transitioning to HALF_OPEN. Default: 30000 */
  resetTimeoutMs?: number;
  /** Sliding window (ms) for counting failures. Default: 60000 */
  windowMs?: number;
}

export class CircuitBreaker {
  private readonly logger = new Logger(CircuitBreaker.name);
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly windowMs: number;

  private state: CircuitState = 'CLOSED';
  private failureTimestamps: number[] = [];
  private openedAt = 0;

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
    this.windowMs = options.windowMs ?? 60_000;
  }

  /** Returns true if the circuit is OPEN (requests should be rejected). */
  isOpen(): boolean {
    if (this.state === 'OPEN') {
      // Check if reset timeout has elapsed → transition to HALF_OPEN
      if (Date.now() - this.openedAt >= this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.logger.warn(`[CircuitBreaker:${this.name}] Transitioning to HALF_OPEN – allowing probe request`);
        return false;
      }
      return true;
    }
    return false;
  }

  /** Call after a successful provider response. */
  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.logger.log(`[CircuitBreaker:${this.name}] Probe succeeded – CLOSING circuit`);
    }
    this.state = 'CLOSED';
    this.failureTimestamps = [];
  }

  /** Call after a provider failure (timeout, error, disconnect). */
  recordFailure(): void {
    const now = Date.now();

    // Prune failures outside the sliding window
    this.failureTimestamps = this.failureTimestamps.filter(
      (ts) => now - ts < this.windowMs,
    );
    this.failureTimestamps.push(now);

    // If in HALF_OPEN and the probe fails, re-open immediately
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.openedAt = now;
      this.logger.error(`[CircuitBreaker:${this.name}] Probe FAILED – re-opening circuit for ${this.resetTimeoutMs}ms`);
      return;
    }

    if (this.failureTimestamps.length >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = now;
      this.logger.error(
        `[CircuitBreaker:${this.name}] ${this.failureTimestamps.length} failures in ${this.windowMs}ms – OPENING circuit for ${this.resetTimeoutMs}ms`,
      );
    }
  }

  getState(): CircuitState {
    // Trigger HALF_OPEN transition check
    this.isOpen();
    return this.state;
  }
}
