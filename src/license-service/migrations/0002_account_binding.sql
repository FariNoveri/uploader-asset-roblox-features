ALTER TABLE licenses
ADD COLUMN creator_id TEXT NOT NULL DEFAULT '';

ALTER TABLE licenses
ADD COLUMN creator_is_group INTEGER NOT NULL DEFAULT 0
CHECK (creator_is_group IN (0, 1));

ALTER TABLE licenses
ADD COLUMN profile_locked INTEGER NOT NULL DEFAULT 0
CHECK (profile_locked IN (0, 1));
