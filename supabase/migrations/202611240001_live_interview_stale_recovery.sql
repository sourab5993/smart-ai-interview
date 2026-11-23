-- Allow 'abandoned' status and add stale finalization recovery for Live Interviews

-- 1. Update status check constraint to include 'abandoned'
alter table public.live_interview_sessions
  drop constraint if exists live_interview_sessions_status_check;

alter table public.live_interview_sessions
  add constraint live_interview_sessions_status_check
  check (status in ('in_progress','finalizing','completed','failed','abandoned'));

-- 2. Update claim_interview_finalization with live interview stale timeout support
create or replace function public.claim_interview_finalization(
  p_session_kind text,
  p_session_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owns_session boolean := false;
  acquired uuid;
  locked_session uuid;
  claim_interval interval;
begin
  if auth.uid() is null or p_session_kind not in ('simple', 'live') then
    return null;
  end if;

  if p_session_kind = 'simple' then
    select id into locked_session
    from public.interview_sessions
    where id = p_session_id and owner_id = auth.uid() and status = 'in_progress'
    for update;
    owns_session := found;
    claim_interval := interval '20 minutes';
  else
    select id into locked_session
    from public.live_interview_sessions
    where id = p_session_id and owner_id = auth.uid()
      and status in ('in_progress', 'failed', 'finalizing', 'abandoned')
    for update;
    owns_session := found;
    -- Live interviews are interactive; 60 seconds lease is sufficient and prevents permanent lockouts
    claim_interval := interval '60 seconds';
  end if;

  if not owns_session then
    return null;
  end if;

  insert into public.scheduled_finalizer_claims(session_kind, session_id, lease_until, lease_token)
  values (p_session_kind, p_session_id, now() + claim_interval, gen_random_uuid())
  on conflict (session_kind, session_id) do update
    set lease_until = excluded.lease_until,
        lease_token = gen_random_uuid(),
        last_error = null,
        updated_at = now()
    where public.scheduled_finalizer_claims.lease_until < now()
       or (p_session_kind = 'live' and public.scheduled_finalizer_claims.updated_at < now() - interval '45 seconds')
  returning lease_token into acquired;

  return acquired;
end;
$$;

revoke all on function public.claim_interview_finalization(text, uuid) from public, anon;
grant execute on function public.claim_interview_finalization(text, uuid) to authenticated;

-- 3. Function to force end or abandon a live interview session and clear claims
create or replace function public.force_end_live_interview(
  p_session_id uuid,
  p_status text default 'abandoned'
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_status text := coalesce(nullif(trim(p_status), ''), 'abandoned');
begin
  if auth.uid() is null then
    return false;
  end if;

  if target_status not in ('failed', 'abandoned') then
    target_status := 'abandoned';
  end if;

  update public.live_interview_sessions
  set status = target_status,
      report_error = 'Session force ended by user.',
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where id = p_session_id
    and owner_id = auth.uid()
    and status in ('in_progress', 'finalizing', 'failed');

  if not found then
    -- Check if it already exists for this owner
    if not exists (
      select 1 from public.live_interview_sessions
      where id = p_session_id and owner_id = auth.uid()
    ) then
      return false;
    end if;
  end if;

  -- Release any active claim on this session
  update public.scheduled_finalizer_claims
  set lease_until = now(),
      lease_token = null,
      last_error = 'Session force ended by user.',
      updated_at = now()
  where session_kind = 'live'
    and session_id = p_session_id;

  return true;
end;
$$;

revoke all on function public.force_end_live_interview(uuid, text) from public, anon;
grant execute on function public.force_end_live_interview(uuid, text) to authenticated;
