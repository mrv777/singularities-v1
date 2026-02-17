-- Phase 7: Admin console support (settings + audit logs)
CREATE TABLE IF NOT EXISTS admin_settings (
  key VARCHAR(64) PRIMARY KEY,
  value_json JSONB NOT NULL,
  updated_by UUID REFERENCES players(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  action VARCHAR(128) NOT NULL,
  details JSONB,
  ip_address VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created
  ON admin_audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor
  ON admin_audit_logs(admin_player_id, created_at DESC);

INSERT INTO admin_settings (key, value_json)
VALUES ('arena_bots_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
