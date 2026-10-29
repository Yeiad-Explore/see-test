-- Run once in the Supabase SQL editor (or apply as a migration). Replace CHANGE_ME with a long random string;
-- the same string goes into DB_SECRET. The functions below are the only way in: the tables have RLS on and no policies.
create table config (key text primary key, value text not null);
insert into config values ('api_key', 'CHANGE_ME');

create table logins (
  id text primary key,                       -- the primary key is what makes "one login per ID" safe under 100 simultaneous logins
  token text not null,
  logged_in_at timestamptz not null default now(),
  started_at timestamptz,
  submitted boolean not null default false
);
create table results (
  ref text primary key,                      -- also the dedupe key in the Google Sheet
  student_id text not null,
  row jsonb not null,                        -- the finished sheet row
  created_at timestamptz not null default now(),
  sent_to text,                              -- the SHEET_LINK this row was last written to
  lease_until timestamptz                    -- set while a send to the Sheet is in flight
);
alter table config enable row level security;
alter table logins enable row level security;
alter table results enable row level security;

create function st_check(p_key text) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_key is null or p_key <> (select value from config where key = 'api_key') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

create function st_login(p_key text, p_id text, p_token text) returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform st_check(p_key);
  insert into logins (id, token) values (p_id, p_token) on conflict do nothing;
  get diagnostics n = row_count;
  return n = 1;
end $$;

create function st_status(p_key text, p_id text, p_token text) returns jsonb language plpgsql security definer set search_path = public as $$
declare l logins;
begin
  perform st_check(p_key);
  select * into l from logins where id = p_id and token = p_token;
  if not found then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true, 'submitted', l.submitted,
    'at', (extract(epoch from l.logged_in_at) * 1000)::bigint,
    'startedAt', (extract(epoch from l.started_at) * 1000)::bigint,
    'now', (extract(epoch from clock_timestamp()) * 1000)::bigint);
end $$;

create function st_start(p_key text, p_id text, p_token text) returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform st_check(p_key);
  update logins set started_at = coalesce(started_at, now()) where id = p_id and token = p_token;
  return found;
end $$;

-- 'ok' | 'submitted' | 'auth'. Flipping submitted and storing the row happen in one transaction, so a double submit cannot store two rows.
create function st_submit(p_key text, p_id text, p_token text, p_ref text, p_row jsonb) returns text language plpgsql security definer set search_path = public as $$
begin
  perform st_check(p_key);
  update logins set submitted = true where id = p_id and token = p_token and not submitted and started_at is not null;
  if found then
    insert into results (ref, student_id, row) values (p_ref, p_id, p_row);
    return 'ok';
  end if;
  return case when exists (select 1 from logins where id = p_id and token = p_token) then 'submitted' else 'auth' end;
end $$;

-- Hands out unsent rows for one sender at a time (advisory lock + 60 s lease), so 100 submits never hit Apps Script together.
create function st_claim(p_key text, p_link text, p_limit int) returns jsonb language plpgsql security definer set search_path = public as $$
declare out jsonb;
begin
  perform st_check(p_key);
  perform pg_advisory_xact_lock(4217);
  if exists (select 1 from results where lease_until > now() and sent_to is distinct from p_link) then return '[]'::jsonb; end if;
  with c as (select ref from results where sent_to is distinct from p_link order by created_at limit p_limit for update),
       u as (update results r set lease_until = now() + interval '60 seconds' from c where r.ref = c.ref returning r.row, r.created_at)
  select coalesce(jsonb_agg(row order by created_at), '[]'::jsonb) into out from u;
  return out;
end $$;

create function st_mark_sent(p_key text, p_refs text[], p_link text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform st_check(p_key);
  update results set sent_to = p_link, lease_until = null where ref = any (p_refs);
end $$;

revoke execute on function st_check(text) from public, anon, authenticated;
revoke execute on function st_login(text, text, text), st_status(text, text, text), st_start(text, text, text),
  st_submit(text, text, text, text, jsonb), st_claim(text, text, int), st_mark_sent(text, text[], text) from public, authenticated;
grant execute on function st_login(text, text, text), st_status(text, text, text), st_start(text, text, text),
  st_submit(text, text, text, text, jsonb), st_claim(text, text, int), st_mark_sent(text, text[], text) to anon;
