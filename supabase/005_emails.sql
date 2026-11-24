-- Caixa de e-mails da Liga: o robô do Gmail da Liga (Google Apps Script) grava aqui
-- os e-mails importantes (afiliados, lojas, cadastros). A Jaque vê no painel.
create table if not exists public.emails_liga (
  id uuid primary key default gen_random_uuid(),
  gmail_id text unique not null,
  recebido_em timestamptz,
  remetente text,
  assunto text,
  trecho text,
  categoria text default 'outros',
  link text,
  resumo text,            -- escrito pela rodada diária da equipe
  acao text,              -- o que a Jaque precisa fazer (vazio = só informativo)
  status text not null default 'novo' check (status in ('novo','resumido','resolvido','arquivado')),
  criado_em timestamptz default now()
);
alter table public.emails_liga enable row level security;
create policy emails_admin on public.emails_liga for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.emails_liga to authenticated;

-- Chave do robô: fica numa tabela que ninguém lê pela API, só o painel (admin) pela função abaixo.
create table if not exists public.segredos (nome text primary key, valor text not null);
alter table public.segredos enable row level security;
revoke all on public.segredos from anon, authenticated;
insert into public.segredos (nome, valor)
values ('robo_emails', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (nome) do nothing;

create or replace function public.chave_robo_emails() returns text
language sql security definer set search_path = public as $$
  select case when public.is_admin() then (select valor from public.segredos where nome = 'robo_emails') end;
$$;
revoke all on function public.chave_robo_emails() from public, anon;
grant execute on function public.chave_robo_emails() to authenticated;

-- O robô grava por esta função (com a chave), nunca direto na tabela.
create or replace function public.registrar_emails(chave text, emails jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if chave is null or chave <> (select valor from public.segredos where nome = 'robo_emails') then
    raise exception 'chave inválida';
  end if;
  insert into public.emails_liga (gmail_id, recebido_em, remetente, assunto, trecho, categoria, link)
  select e->>'gmail_id', (e->>'recebido_em')::timestamptz, left(e->>'remetente', 200), left(e->>'assunto', 300),
         left(e->>'trecho', 1500), coalesce(e->>'categoria', 'outros'), left(e->>'link', 500)
  from jsonb_array_elements(emails) e
  where coalesce(e->>'gmail_id', '') <> ''
  on conflict (gmail_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.registrar_emails(text, jsonb) from public;
grant execute on function public.registrar_emails(text, jsonb) to anon, authenticated;
revoke all on public.emails_liga from anon;
