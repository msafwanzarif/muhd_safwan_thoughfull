import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, jsonb, check } from 'drizzle-orm/pg-core';
import { audit } from './columns';
import { users } from './users';
export const specialisationCodes = [
  'anxiety',
  'depression',
  'stress_and_burnout',
  'relationships',
  'grief',
  'career_coaching',
] as const;
export const languageCodes = ['en', 'ms', 'zh', 'ta', 'yue', 'id'] as const;
export type SpecialisationCode = (typeof specialisationCodes)[number];
export type LanguageCode = (typeof languageCodes)[number];
export const professionalProfiles = pgTable(
  'professional_profiles',
  {
    userId: uuid()
      .primaryKey()
      .references(() => users.id),
    title: text(),
    bio: text(),
    specialisations: jsonb()
      .$type<SpecialisationCode[]>()
      .notNull()
      .default([]),
    languages: jsonb().$type<LanguageCode[]>().notNull().default([]),
    ...audit(),
  },
  (t) => [
    check(
      'professional_profiles_specialisations_valid',
      sql`jsonb_typeof(${t.specialisations}) = 'array' and ${t.specialisations} <@ '["anxiety","depression","stress_and_burnout","relationships","grief","career_coaching"]'::jsonb`,
    ),
    check(
      'professional_profiles_languages_valid',
      sql`jsonb_typeof(${t.languages}) = 'array' and ${t.languages} <@ '["en","ms","zh","ta","yue","id"]'::jsonb`,
    ),
  ],
);
