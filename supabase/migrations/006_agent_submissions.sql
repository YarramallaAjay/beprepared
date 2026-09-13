CREATE TABLE agent_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  repo_url TEXT NOT NULL,
  agent_yaml JSONB NOT NULL,
  review_status TEXT DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewer_notes TEXT,
  agent_id UUID REFERENCES agents(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own submissions" ON agent_submissions
  FOR SELECT USING (auth.uid() = submitted_by);
CREATE POLICY "Users can create submissions" ON agent_submissions
  FOR INSERT WITH CHECK (auth.uid() = submitted_by);

CREATE TRIGGER agent_submissions_updated_at BEFORE UPDATE ON agent_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
