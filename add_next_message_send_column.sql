ALTER TABLE message_storage ADD COLUMN IF NOT EXISTS next_message_send BOOLEAN DEFAULT false;
