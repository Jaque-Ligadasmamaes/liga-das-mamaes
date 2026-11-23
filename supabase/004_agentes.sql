-- Equipe de agentes da Liga: cada agente tem missão, instruções e próximos passos.
-- A Jaque pergunta pelo painel (aba Equipe); o Claude responde na rodada diária.
create table if not exists public.agentes (
  slug text primary key,
  ordem int default 0,
  nome text not null,
  emoji text,
  missao text,
  instrucoes text,
  proximos_passos text,
  atualizado_em timestamptz default now()
);
create table if not exists public.perguntas_agentes (
  id uuid primary key default gen_random_uuid(),
  agente text not null default 'triagem' references public.agentes(slug),
  pergunta text not null,
  resposta text,
  status text not null default 'aguardando' check (status in ('aguardando','respondida','arquivada')),
  criado_em timestamptz default now(),
  respondido_em timestamptz
);
create table if not exists public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  data date not null default (now() at time zone 'America/Sao_Paulo')::date,
  tipo text not null default 'entrada' check (tipo in ('entrada','saida')),
  categoria text,
  descricao text not null,
  valor numeric(10,2) not null,
  recebido boolean default true,
  criado_em timestamptz default now()
);
alter table public.ideias add column if not exists agente text references public.agentes(slug);

alter table public.agentes enable row level security;
alter table public.perguntas_agentes enable row level security;
alter table public.lancamentos enable row level security;
create policy agentes_admin on public.agentes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy perguntas_admin on public.perguntas_agentes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy lancamentos_admin on public.lancamentos for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.agentes, public.perguntas_agentes, public.lancamentos to authenticated;
