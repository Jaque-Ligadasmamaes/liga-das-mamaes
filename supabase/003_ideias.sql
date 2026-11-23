-- Caixa de ideias da Jaque (o Claude desenvolve e responde no campo "desenvolvimento")
create table if not exists public.ideias (
  id uuid primary key default gen_random_uuid(),
  texto text not null,
  status text not null default 'nova' check (status in ('nova','desenvolvida','virou_acao','arquivada')),
  desenvolvimento text,
  criado_em timestamptz default now()
);
alter table public.ideias enable row level security;
create policy ideias_admin on public.ideias for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.ideias to authenticated;
