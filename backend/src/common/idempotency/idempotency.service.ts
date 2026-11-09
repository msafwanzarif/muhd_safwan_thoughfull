import {
  BadRequestException,
  ConflictException,
  Injectable,
  HttpException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { and, eq, lt } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.module';
import { idempotencyKeys } from '../../database/schema';

export type DatabaseTransaction = Parameters<
  Parameters<DatabaseService['db']['transaction']>[0]
>[0];

@Injectable()
export class IdempotencyService {
  constructor(private readonly database: DatabaseService) {}

  async execute<T extends object>(
    userId: string,
    key: string,
    payload: string,
    work: (tx: DatabaseTransaction) => Promise<T>,
    successStatus = 201,
  ): Promise<T> {
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(key ?? '')) {
      throw new BadRequestException(
        'Idempotency-Key must contain 16–128 letters, digits, underscores or hyphens',
      );
    }
    const requestHash = createHash('sha256').update(payload).digest('hex');
    const db = this.database.db;
    const deadline = Date.now() + 10000;
    while (true) {
      const now = new Date();
      // Expired keys are scoped by user and can be reused after 24 hours.
      await db
        .delete(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.userId, userId),
            eq(idempotencyKeys.key, key),
            lt(idempotencyKeys.createdAt, new Date(Date.now() - 86400000)),
          ),
        );
      let [claim] = await db
        .insert(idempotencyKeys)
        .values({ userId, key, requestHash, createdAt: now, updatedAt: now })
        .onConflictDoNothing()
        .returning();
      if (!claim) {
        const [existing] = await db
          .select()
          .from(idempotencyKeys)
          .where(
            and(
              eq(idempotencyKeys.userId, userId),
              eq(idempotencyKeys.key, key),
            ),
          );
        if (!existing) {
          continue;
        }
        if (existing.requestHash !== requestHash) {
          throw new UnprocessableEntityException(
            'Idempotency key was used with a different request',
          );
        }
        if (existing.status === 'completed') {
          if (existing.responseStatus! >= 400) {
            throw new HttpException(
              existing.responseBody as object,
              existing.responseStatus!,
            );
          }

          return existing.responseBody as T;
        }
        if (existing.updatedAt.getTime() < now.getTime() - 30000) {
          [claim] = await db
            .update(idempotencyKeys)
            .set({ updatedAt: now })
            .where(
              and(
                eq(idempotencyKeys.id, existing.id),
                eq(idempotencyKeys.status, 'in_progress'),
                eq(idempotencyKeys.updatedAt, existing.updatedAt),
              ),
            )
            .returning();
        }
      }
      if (claim) {
        try {
          const outcome = await db.transaction(async (tx) => {
            // Row lock fences stale owners and makes the side effect and response atomic.
            const [owned] = await tx
              .select()
              .from(idempotencyKeys)
              .where(eq(idempotencyKeys.id, claim.id))
              .for('update');
            if (
              !owned ||
              owned.status !== 'in_progress' ||
              owned.updatedAt.getTime() !== claim.updatedAt.getTime()
            ) {
              throw new ConflictException(
                'Request ownership changed; retry with the same key',
              );
            }
            let responseStatus = successStatus;
            let result: object;
            try {
              // Savepoint lets deterministic client errors be cached after work rolls back.
              result = await tx.transaction(work);
            } catch (error) {
              const cause = error as {
                code?: string;
                cause?: { code?: string };
              };
              const mapped = ['23P01', '40P01'].includes(
                cause.cause?.code ?? cause.code ?? '',
              )
                ? new ConflictException({
                    message: 'The slot was taken by another booking',
                    code: 'SLOT_TAKEN',
                  })
                : error;
              if (
                !(mapped instanceof HttpException) ||
                mapped.getStatus() >= 500
              ) {
                throw mapped;
              }
              responseStatus = mapped.getStatus();
              const body = mapped.getResponse();
              result = typeof body === 'string' ? { message: body } : body;
            }
            await tx
              .update(idempotencyKeys)
              .set({
                status: 'completed',
                responseStatus,
                responseBody: result,
              })
              .where(eq(idempotencyKeys.id, claim.id));

            return { responseStatus, responseBody: result };
          });
          if (outcome.responseStatus >= 400) {
            throw new HttpException(
              outcome.responseBody,
              outcome.responseStatus,
            );
          }

          return outcome.responseBody as T;
        } catch (error) {
          await db
            .delete(idempotencyKeys)
            .where(
              and(
                eq(idempotencyKeys.id, claim.id),
                eq(idempotencyKeys.status, 'in_progress'),
                eq(idempotencyKeys.updatedAt, claim.updatedAt),
              ),
            );
          throw error;
        }
      }
      if (Date.now() >= deadline) {
        throw new ConflictException(
          'Request still in progress; retry with the same key',
        );
      }
      await setTimeout(100);
    }
  }
}
