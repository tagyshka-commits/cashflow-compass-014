
create type public.income_status as enum ('pending','received','delayed','converted','cancelled');
create type public.expense_status as enum ('pending','paid','delayed','cancelled');

alter table public.expected_incomes
  add column status public.income_status not null default 'pending',
  add column received_at timestamptz,
  add column original_expected_date date;

-- Backfill: legacy `received=true` rows become status='received'
update public.expected_incomes set status = 'received', received_at = coalesce(received_at, now())
  where received = true;

alter table public.committed_expenses
  add column status public.expense_status not null default 'pending',
  add column paid_at timestamptz,
  add column original_due_date date;

alter table public.accounts
  add column is_protected boolean not null default false,
  add column storage_location text,
  add column unlock_date date,
  add column unlock_condition text;

create index if not exists expected_incomes_status_idx on public.expected_incomes(user_id, status);
create index if not exists committed_expenses_status_idx on public.committed_expenses(user_id, status);
