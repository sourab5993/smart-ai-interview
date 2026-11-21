-- Additive indexes keep completion retries idempotent while preserving learner history.
-- The initial schema previously keyed gaps only by owner and skill name. Scope them to the
-- learner's course/target role so different career paths do not overwrite each other.
alter table public.skill_gaps add column if not exists course text not null default '';
alter table public.skill_gaps add column if not exists target_role text not null default '';
alter table public.skill_gaps drop constraint if exists skill_gaps_owner_id_skill_name_key;
create unique index if not exists skill_gaps_owner_context_skill_uidx
  on public.skill_gaps(owner_id, course, target_role, skill_name);

-- One averaged value per dimension per completed session; safe to upsert on a retry.
create unique index if not exists performance_metrics_owner_session_name_uidx
  on public.performance_metrics(owner_id, session_id, metric_name);

-- Link each transparent readiness prediction to the source session, and make its refresh safe.
alter table public.ml_predictions add column if not exists session_id uuid
  references public.interview_sessions(id) on delete cascade;
create unique index if not exists ml_predictions_owner_session_uidx
  on public.ml_predictions(owner_id, session_id);

-- These client writes stay subject to the existing owner policies and authenticated grants.
