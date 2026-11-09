import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, lt, desc, isNull, count, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.module';
import { notifications } from '../database/schema';
import {
  NotificationDataDto,
  NotificationsQueryDto,
  NotificationsPageResponseDto,
  NotificationResponseDto,
  UnreadCountResponseDto,
} from './dto/notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly database: DatabaseService) {}

  private response(
    row: typeof notifications.$inferSelect,
  ): NotificationResponseDto {
    return {
      id: row.id,
      type: row.type,
      sessionId: row.sessionId,
      data: row.data as NotificationDataDto,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async list(
    userId: string,
    query: NotificationsQueryDto,
  ): Promise<NotificationsPageResponseDto> {
    const rows = await this.database.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, userId),
          query.cursor ? lt(notifications.id, query.cursor) : undefined,
        ),
      )
      .orderBy(desc(notifications.id))
      .limit(query.limit + 1);
    const page = rows.slice(0, query.limit);

    return {
      items: page.map((row) => this.response(row)),
      nextCursor: rows.length > query.limit ? page.at(-1)!.id : null,
    };
  }

  async unread(userId: string): Promise<UnreadCountResponseDto> {
    const [row] = await this.database.db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, userId),
          isNull(notifications.readAt),
        ),
      );

    return row;
  }

  async markAllRead(userId: string): Promise<UnreadCountResponseDto> {
    const changed = await this.database.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.recipientId, userId),
          isNull(notifications.readAt),
        ),
      )
      .returning({ id: notifications.id });

    return { count: changed.length };
  }

  async markRead(userId: string, id: string): Promise<NotificationResponseDto> {
    const [row] = await this.database.db
      .update(notifications)
      .set({ readAt: sql`coalesce(${notifications.readAt}, now())` })
      .where(
        and(eq(notifications.id, id), eq(notifications.recipientId, userId)),
      )
      .returning();
    if (!row) {
      throw new NotFoundException('Notification not found');
    }

    return this.response(row);
  }
}
