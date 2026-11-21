-- Run once in the Supabase SQL Editor as the project owner after the admin signs up.
-- Replace the email literal with the exact verified email for the designated admin account.
-- This elevated action is intentionally not exposed in the public application.
update public.profiles p
set role = 'admin'
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('admin@example.com');

-- Verify that exactly the intended account was promoted:
select id, email, role from public.profiles where role = 'admin';
