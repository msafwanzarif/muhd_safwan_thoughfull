import { UnprocessableEntityException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { signupIdempotencyKeys } from '../database/schema';
import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { and, eq, gt } from 'drizzle-orm';
import { DatabaseService } from '../database/database.module';
import { users, professionalProfiles, userSessions } from '../database/schema';
import { SignUpDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService) {}

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async signUp(dto: SignUpDto, key: string) {
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(key ?? '')) {
      throw new BadRequestException(
        'Idempotency-Key must contain 16–128 letters, digits, underscores or hyphens',
      );
    }
    const keyHash = this.hashToken(key);
    const requestBody = JSON.stringify({
      name: dto.name,
      email: dto.email,
      password: dto.password,
      role: dto.role,
      timezone: dto.timezone,
      title: dto.title ?? null,
      bio: dto.bio ?? null,
      specialisations: dto.specialisations ?? null,
      languages: dto.languages ?? null,
    });
    if (
      dto.role === 'member' &&
      [dto.title, dto.bio, dto.specialisations, dto.languages].some(
        (v) => v !== undefined,
      )
    ) {
      throw new BadRequestException(
        'Professional details require the professional role',
      );
    }
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    try {
      return await this.database.db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL lock_timeout = '10s'`);
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtextextended(${keyHash}, 0))`,
        );
        const [existing] = await tx
          .select()
          .from(signupIdempotencyKeys)
          .where(eq(signupIdempotencyKeys.keyHash, keyHash));
        if (existing && existing.expiresAt > new Date()) {
          if (!(await argon2.verify(existing.requestHash, requestBody))) {
            throw new UnprocessableEntityException(
              'Idempotency key was used with a different request',
            );
          }

          return existing.responseBody;
        }
        if (existing) {
          await tx
            .delete(signupIdempotencyKeys)
            .where(eq(signupIdempotencyKeys.id, existing.id));
        }
        const [user] = await tx
          .insert(users)
          .values({
            name: dto.name,
            email: dto.email,
            passwordHash,
            role: dto.role,
            timezone: dto.timezone,
          })
          .returning({
            id: users.id,
            role: users.role,
            timezone: users.timezone,
          });
        if (dto.role === 'professional') {
          await tx.insert(professionalProfiles).values({
            userId: user.id,
            title: dto.title,
            bio: dto.bio,
            specialisations: dto.specialisations,
            languages: dto.languages,
          });
        }
        await tx.insert(signupIdempotencyKeys).values({
          keyHash,
          requestHash: await argon2.hash(requestBody, {
            type: argon2.argon2id,
          }),
          responseBody: user,
          expiresAt: new Date(Date.now() + 86400000),
        });

        return user;
      });
    } catch (error) {
      const cause = error as { code?: string; cause?: { code?: string } };
      if ((cause.cause?.code ?? cause.code) === '55P03') {
        throw new ConflictException(
          'Sign-up is still in progress; retry with the same key',
        );
      }
      if ((cause.cause?.code ?? cause.code) === '23505') {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const [user] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email));
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.database.db
      .insert(userSessions)
      .values({ userId: user.id, tokenHash: this.hashToken(token), expiresAt });

    return { token, expiresAt };
  }

  async authenticate(token: string) {
    const now = new Date();
    const [session] = await this.database.db
      .update(userSessions)
      .set({ lastActiveAt: now })
      .where(
        and(
          eq(userSessions.tokenHash, this.hashToken(token)),
          gt(userSessions.expiresAt, now),
          gt(
            userSessions.lastActiveAt,
            new Date(now.getTime() - 30 * 60 * 1000),
          ),
        ),
      )
      .returning();
    if (!session) {
      throw new UnauthorizedException('Session expired or invalid');
    }
    const [user] = await this.database.db
      .select({ userId: users.id, role: users.role, timezone: users.timezone })
      .from(users)
      .where(eq(users.id, session.userId));
    if (!user) {
      throw new UnauthorizedException();
    }

    return { ...user, sessionId: session.id };
  }

  async logout(sessionId: string) {
    await this.database.db
      .delete(userSessions)
      .where(eq(userSessions.id, sessionId));
  }
}
