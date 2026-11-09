import { seedProfessionals } from './seed-roster';
import { seedSchedule, seedRandom } from './seed-schedule';
import { specialisationCodes, languageCodes } from './schema';
import * as argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { DatabaseService } from './database.module';
import { users, professionalProfiles, workingHours } from './schema';

export const demoPassword = 'ThoughtFull-demo-2026!';

export async function seedData(db: DatabaseService['db']): Promise<void> {
  const passwordHash = await argon2.hash(demoPassword, {
    type: argon2.argon2id,
  });
  const people = [
    ...seedProfessionals.map((person) => ({
      ...person,
      role: 'professional' as const,
    })),
    {
      name: 'Sam Demo',
      email: 'sam@example.test',
      role: 'member' as const,
      timezone: 'Asia/Kuala_Lumpur',
    },
    {
      name: 'Jordan Demo',
      email: 'jordan@example.test',
      role: 'member' as const,
      timezone: 'Europe/London',
    },
  ];
  await db.transaction(async (tx) => {
    for (const person of people) {
      const [created] = await tx
        .insert(users)
        .values({ ...person, passwordHash })
        .onConflictDoNothing({ target: users.email })
        .returning();
      if (!created) {
        continue;
      }
      if (created.role === 'professional') {
        const random = seedRandom(created.email + ':profile');
        const titles = [
          'Counsellor',
          'Psychologist',
          'Career coach',
          'Wellbeing coach',
        ];
        const focus = specialisationCodes.filter(() => random() < 0.45);
        const spoken = languageCodes.filter(() => random() < 0.35);
        await tx.insert(professionalProfiles).values({
          userId: created.id,
          title: titles[Math.floor(random() * titles.length)],
          bio: 'Fictional demonstration profile with flexible local working hours.',
          specialisations: focus.length ? focus : ['anxiety'],
          languages: spoken.length ? spoken : ['en'],
        });
        await tx.insert(workingHours).values(
          seedSchedule(created.email).map((range) => ({
            ...range,
            professionalId: created.id,
            createdBy: created.id,
            updatedBy: created.id,
          })),
        );
      }
    }
  });
  // Verify the expected identities without changing existing accounts on reruns.
  for (const person of people) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, person.email));
    if (!user) {
      throw new Error('Seed account missing');
    }
  }
}
