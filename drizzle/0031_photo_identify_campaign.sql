-- Add mediaId to prompt campaign questions for photo clarification
ALTER TABLE prompt_campaign_questions
  ADD COLUMN IF NOT EXISTS media_id uuid REFERENCES media(id) ON DELETE SET NULL;

-- Add mediaId to prompts for photo clarification in the reply flow
ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS media_id uuid REFERENCES media(id) ON DELETE SET NULL;