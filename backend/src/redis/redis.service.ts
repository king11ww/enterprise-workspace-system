import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';

export interface AcquiredLock {
  key: string;
  token: string;
}

export interface AcquireLockOptions {
  /** Lock time-to-live in milliseconds (auto-expires if the holder crashes). */
  ttlMs?: number;
  /** How many extra attempts to make if the lock is busy. 0 = fail immediately. */
  retryCount?: number;
  /** Base delay between attempts in milliseconds (random jitter is added). */
  retryDelayMs?: number;
}

/**
 * Releases the lock only if it is still owned by the caller (token matches).
 * Prevents a slow request from deleting a lock that has already expired
 * and been re-acquired by another request.
 */
const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(configService: ConfigService) {
    this.client = new Redis({
      host: configService.get<string>('REDIS_HOST') ?? 'localhost',
      port: Number(configService.get<string>('REDIS_PORT') ?? 6379),
      password: configService.get<string>('REDIS_PASSWORD') || undefined,
      maxRetriesPerRequest: 3,
    });

    this.client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
  }

  /**
   * Distributed mutex based on `SET key token NX PX ttl`.
   * With a single Redis node this is exactly what the Redlock algorithm reduces to.
   * Returns null if the lock could not be acquired within the allowed retries.
   */
  async acquireLock(key: string, options: AcquireLockOptions = {}): Promise<AcquiredLock | null> {
    const { ttlMs = 5000, retryCount = 0, retryDelayMs = 50 } = options;
    const token = randomUUID();

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      const result = await this.client.set(key, token, 'PX', ttlMs, 'NX');
      if (result === 'OK') {
        return { key, token };
      }
      if (attempt < retryCount) {
        const jitter = Math.floor(Math.random() * retryDelayMs);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs + jitter));
      }
    }

    return null;
  }

  async releaseLock(lock: AcquiredLock): Promise<boolean> {
    const deleted = await this.client.eval(RELEASE_LOCK_SCRIPT, 1, lock.key, lock.token);
    return deleted === 1;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
