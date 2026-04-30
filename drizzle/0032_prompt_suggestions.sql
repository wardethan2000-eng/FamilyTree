-- Add suggestion columns to prompts for rule-based follow-up suggestions
CREATE TYPE prompt_suggestion_kind AS ENUM ('rule_based', 'manual');
CREATE TYPE prompt_suggestion_status AS ENUM ('suggested', 'approved', 'dismissed');

ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS suggestion_kind prompt_suggestion_kind,
  ADD COLUMN IF NOT EXISTS suggestion_status prompt_suggestion_status,
  ADD COLUMN IF NOT EXISTS suggested_follow_up_for_id uuid REFERENCES prompts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS prompts_suggestion_status_idx ON prompts (suggestion_status);
CREATE INDEX IF NOT EXISTS prompts_suggested_follow_up_idx ON prompts (suggested_follow_up_for_id) WHERE suggested_follow_up_for_id IS NOT NULL;