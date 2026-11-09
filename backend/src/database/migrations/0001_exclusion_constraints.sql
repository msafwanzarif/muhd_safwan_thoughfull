CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE working_hours ADD CONSTRAINT working_hours_no_overlap EXCLUDE USING gist (professional_id WITH =, weekday WITH =, int4range(start_minute, start_minute + length_hours * 60, '[)') WITH &&);
--> statement-breakpoint
ALTER TABLE booking_sessions ADD CONSTRAINT booking_sessions_professional_no_overlap EXCLUDE USING gist (professional_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&) WHERE (status = 'active');
--> statement-breakpoint
ALTER TABLE booking_sessions ADD CONSTRAINT booking_sessions_member_no_overlap EXCLUDE USING gist (member_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&) WHERE (status = 'active');
