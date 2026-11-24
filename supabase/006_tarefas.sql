-- Lista "Pra fazer" da Jaque (tela Início). A equipe cria; ela marca como feito e pode responder.
create table if not exists public.tarefas (
  id uuid primary key default gen_random_uuid(),
  ordem int default 0,
  titulo text not null,
  passos text,
  link text,
  tempo text,
  agente text references public.agentes(slug),
  para date,
  feito boolean not null default false,
  feito_em timestamptz,
  resposta text,
  criado_em timestamptz default now()
);
alter table public.tarefas enable row level security;
create policy tarefas_admin on public.tarefas for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.tarefas to authenticated;
revoke all on public.tarefas from anon;
