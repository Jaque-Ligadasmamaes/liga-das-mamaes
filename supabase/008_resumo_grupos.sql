-- Resumo dos grupos do WhatsApp (robô SOMENTE LEITURA, num chip separado).
-- O robô roda no GitHub Actions 2x por dia, lê as mensagens novas dos grupos ATIVADOS no painel
-- e grava aqui pelas funções com chave. O Claude escreve o resumo 2x por dia.
-- Privacidade: não guardamos número de telefone (só o nome que a pessoa usa no WhatsApp e um código
-- embaralhado), não guardamos fotos/áudios, e o texto das mensagens é apagado depois de 3 dias.

create table if not exists public.wa_grupos (
  jid text primary key,
  nome text,
  participantes int,
  ativo boolean not null default false,   -- só grupos ativados no painel são lidos
  atualizado_em timestamptz default now()
);

create table if not exists public.wa_mensagens (
  id text primary key,                     -- id da mensagem no WhatsApp
  grupo_jid text not null references public.wa_grupos(jid) on delete cascade,
  enviada_em timestamptz not null,
  autor text,                              -- nome que a pessoa usa no WhatsApp
  autor_hash text,                         -- código embaralhado (para saber se outra pessoa respondeu)
  texto text,
  tipo text default 'texto',
  responde_a text,                         -- id da mensagem citada (quando alguém responde marcando)
  processado boolean not null default false, -- o Claude já leu para o resumo
  criado_em timestamptz default now()
);
create index if not exists wa_mensagens_grupo_data on public.wa_mensagens (grupo_jid, enviada_em);

create table if not exists public.wa_resumos (
  id uuid primary key default gen_random_uuid(),
  grupo_jid text references public.wa_grupos(jid) on delete cascade,
  de timestamptz,
  ate timestamptz,
  total int default 0,
  pessoas int default 0,
  resumo text,        -- o que rolou (Claude)
  assuntos text,      -- principais assuntos, um por linha
  atencao text,       -- o que precisa da atenção da Jaque (vazio = nada)
  fonte text not null default 'robo' check (fonte in ('robo', 'claude')),
  visto boolean not null default false,
  criado_em timestamptz default now()
);
create index if not exists wa_resumos_grupo_data on public.wa_resumos (grupo_jid, criado_em desc);

create table if not exists public.wa_pendencias (
  id uuid primary key default gen_random_uuid(),
  grupo_jid text references public.wa_grupos(jid) on delete cascade,
  msg_id text unique,
  autor text,
  texto text,
  enviada_em timestamptz,
  tipo text default 'indicacao',   -- indicacao, duvida, reclamacao, outro
  status text not null default 'aberta' check (status in ('aberta', 'resolvida', 'ignorada')),
  fonte text not null default 'robo',
  resolvida_em timestamptz,
  criado_em timestamptz default now()
);

-- Estado do robô (sessão do WhatsApp). Ninguém lê pela API: só o robô, com a chave.
create table if not exists public.wa_estado (
  id int primary key default 1 check (id = 1),
  sessao text,                   -- sessão compactada (é o "login" do chip; nunca mostrar)
  pausado boolean not null default false,
  ultima_execucao timestamptz,
  ultimo_status text,
  numero_final text,             -- só os 4 últimos dígitos do chip, para conferência
  numero_chip text               -- número do chip do robô, digitado no painel (só para parear)
);
insert into public.wa_estado (id) values (1) on conflict (id) do nothing;

alter table public.wa_grupos enable row level security;
alter table public.wa_mensagens enable row level security;
alter table public.wa_resumos enable row level security;
alter table public.wa_pendencias enable row level security;
alter table public.wa_estado enable row level security;
create policy wa_grupos_admin on public.wa_grupos for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy wa_mensagens_admin on public.wa_mensagens for select to authenticated using (public.is_admin());
create policy wa_resumos_admin on public.wa_resumos for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy wa_pendencias_admin on public.wa_pendencias for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, update on public.wa_grupos to authenticated;
grant select on public.wa_mensagens to authenticated;
grant select, insert, update, delete on public.wa_resumos to authenticated;
grant select, insert, update, delete on public.wa_pendencias to authenticated;
revoke all on public.wa_grupos, public.wa_mensagens, public.wa_resumos, public.wa_pendencias from anon;
revoke all on public.wa_estado from anon, authenticated;

-- Chave do robô do WhatsApp (o painel mostra em Ajustes; vai no "segredo" do GitHub).
insert into public.segredos (nome, valor)
values ('robo_whats', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (nome) do nothing;

create or replace function public.chave_robo_whats() returns text
language sql security definer set search_path = public as $$
  select case when public.is_admin() then (select valor from public.segredos where nome = 'robo_whats') end;
$$;
revoke all on function public.chave_robo_whats() from public, anon;
grant execute on function public.chave_robo_whats() to authenticated;

-- Situação do robô para o painel (sem a sessão).
create or replace function public.situacao_robo_whats() returns jsonb
language sql security definer set search_path = public as $$
  select case when public.is_admin() then jsonb_build_object(
    'conectado', sessao is not null, 'pausado', pausado, 'ultima_execucao', ultima_execucao,
    'ultimo_status', ultimo_status, 'numero_final', coalesce(numero_final, right(numero_chip, 4)), 'tem_numero', numero_chip is not null) end
  from public.wa_estado where id = 1;
$$;
revoke all on function public.situacao_robo_whats() from public, anon;
grant execute on function public.situacao_robo_whats() to authenticated;

create or replace function public.pausar_robo_whats(pausar boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'sem acesso'; end if;
  update public.wa_estado set pausado = pausar where id = 1;
end $$;
revoke all on function public.pausar_robo_whats(boolean) from public, anon;
grant execute on function public.pausar_robo_whats(boolean) to authenticated;

create or replace function public.numero_robo_whats(numero text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'sem acesso'; end if;
  update public.wa_estado set numero_chip = nullif(regexp_replace(numero, '\D', '', 'g'), '') where id = 1;
end $$;
revoke all on function public.numero_robo_whats(text) from public, anon;
grant execute on function public.numero_robo_whats(text) to authenticated;

create or replace function public._checar_chave_whats(chave text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if chave is null or chave <> (select valor from public.segredos where nome = 'robo_whats') then
    raise exception 'chave inválida';
  end if;
end $$;
revoke all on function public._checar_chave_whats(text) from public, anon, authenticated;

-- Início de cada rodada: o robô pega a sessão e a lista de grupos ativados.
create or replace function public.whats_inicio(chave text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  perform public._checar_chave_whats(chave);
  select jsonb_build_object(
    'sessao', e.sessao, 'pausado', e.pausado, 'numero_chip', e.numero_chip,
    'grupos_ativos', coalesce((select jsonb_agg(jid) from public.wa_grupos where ativo), '[]'::jsonb))
  into r from public.wa_estado e where e.id = 1;
  return r;
end $$;
revoke all on function public.whats_inicio(text) from public;
grant execute on function public.whats_inicio(text) to anon;

-- Fim de cada rodada: grava sessão, grupos, mensagens, pedidos sem resposta e o resumo do robô.
-- Também apaga o que é velho (privacidade).
create or replace function public.whats_fim(chave text, dados jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n_msg int := 0; n_pend int := 0; n_resolv int := 0;
begin
  perform public._checar_chave_whats(chave);

  update public.wa_estado set
    sessao = coalesce(dados->>'sessao', sessao),
    ultima_execucao = now(),
    ultimo_status = left(dados->>'status', 300),
    numero_final = coalesce(dados->>'numero_final', numero_final)
  where id = 1;
  if dados->>'desconectado' = 'sim' then update public.wa_estado set sessao = null where id = 1; end if;

  insert into public.wa_grupos (jid, nome, participantes, atualizado_em)
  select g->>'jid', left(g->>'nome', 120), (g->>'participantes')::int, now()
  from jsonb_array_elements(coalesce(dados->'grupos', '[]')) g
  where g->>'jid' like '%@g.us'
  on conflict (jid) do update set nome = excluded.nome, participantes = excluded.participantes, atualizado_em = now();

  insert into public.wa_mensagens (id, grupo_jid, enviada_em, autor, autor_hash, texto, tipo, responde_a)
  select m->>'id', m->>'grupo_jid', (m->>'enviada_em')::timestamptz, left(m->>'autor', 60), left(m->>'autor_hash', 20),
         left(m->>'texto', 2000), coalesce(m->>'tipo', 'texto'), m->>'responde_a'
  from jsonb_array_elements(coalesce(dados->'mensagens', '[]')) m
  where exists (select 1 from public.wa_grupos g where g.jid = m->>'grupo_jid' and g.ativo)
  on conflict (id) do nothing;
  get diagnostics n_msg = row_count;

  insert into public.wa_pendencias (grupo_jid, msg_id, autor, texto, enviada_em, tipo)
  select p->>'grupo_jid', p->>'msg_id', left(p->>'autor', 60), left(p->>'texto', 600), (p->>'enviada_em')::timestamptz, coalesce(p->>'tipo', 'indicacao')
  from jsonb_array_elements(coalesce(dados->'pendencias', '[]')) p
  where exists (select 1 from public.wa_grupos g where g.jid = p->>'grupo_jid' and g.ativo)
  on conflict (msg_id) do nothing;
  get diagnostics n_pend = row_count;

  -- Alguém respondeu (marcando) um pedido antigo? Então fecha o pedido.
  update public.wa_pendencias p set status = 'resolvida', resolvida_em = now()
  where p.status = 'aberta' and exists (
    select 1 from public.wa_mensagens m
    where m.responde_a = p.msg_id and m.autor_hash is distinct from (select autor_hash from public.wa_mensagens where id = p.msg_id));
  get diagnostics n_resolv = row_count;

  insert into public.wa_resumos (grupo_jid, de, ate, total, pessoas, resumo, fonte)
  select r->>'grupo_jid', (r->>'de')::timestamptz, (r->>'ate')::timestamptz, (r->>'total')::int, (r->>'pessoas')::int, left(r->>'resumo', 1500), 'robo'
  from jsonb_array_elements(coalesce(dados->'resumos', '[]')) r
  where exists (select 1 from public.wa_grupos g where g.jid = r->>'grupo_jid' and g.ativo);

  -- Limpeza (privacidade): texto das mensagens só 3 dias; resumos 60 dias; pedidos fechados 30 dias.
  delete from public.wa_mensagens where enviada_em < now() - interval '3 days';
  delete from public.wa_resumos where criado_em < now() - interval '60 days';
  delete from public.wa_pendencias where status <> 'aberta' and coalesce(resolvida_em, criado_em) < now() - interval '30 days';
  delete from public.wa_pendencias where status = 'aberta' and enviada_em < now() - interval '14 days';

  return jsonb_build_object('mensagens', n_msg, 'pendencias', n_pend, 'resolvidas', n_resolv);
end $$;
revoke all on function public.whats_fim(text, jsonb) from public;
grant execute on function public.whats_fim(text, jsonb) to anon;
