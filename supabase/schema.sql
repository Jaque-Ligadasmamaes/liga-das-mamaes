-- Liga das Mamães: esquema completo do banco (Supabase, plano grátis)
create table public.admins (email text primary key);
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(coalesce(auth.jwt()->>'email','')));
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
create policy admins_admin_read on public.admins for select to authenticated using (public.is_admin());

create table public.config (chave text primary key, valor text, atualizado_em timestamptz default now());
alter table public.config enable row level security;
create policy config_public_read on public.config for select using (true);
create policy config_admin_write on public.config for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.negocios (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 120),
  categoria text not null check (char_length(categoria) <= 60),
  cidade text check (char_length(cidade) <= 60),
  descricao text check (char_length(descricao) <= 600),
  whatsapp text check (char_length(whatsapp) <= 30),
  instagram text check (char_length(instagram) <= 80),
  site text check (char_length(site) <= 200),
  endereco text check (char_length(endereco) <= 200),
  foto_url text,
  de_mae boolean default false,
  indicado_por text check (char_length(indicado_por) <= 80),
  contato_indicacao text check (char_length(contato_indicacao) <= 80),
  plano text not null default 'gratis' check (plano in ('gratis','parceira','destaque')),
  plano_ate date,
  status text not null default 'pendente' check (status in ('pendente','aprovado','arquivado')),
  criado_em timestamptz default now()
);
alter table public.negocios enable row level security;
create policy negocios_public_read on public.negocios for select using (status = 'aprovado' or public.is_admin());
create policy negocios_public_suggest on public.negocios for insert to anon, authenticated
  with check (status = 'pendente' and plano = 'gratis' and plano_ate is null and foto_url is null);
create policy negocios_admin_insert on public.negocios for insert to authenticated with check (public.is_admin());
create policy negocios_admin_update on public.negocios for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy negocios_admin_delete on public.negocios for delete to authenticated using (public.is_admin());

create table public.episodios (
  id uuid primary key default gen_random_uuid(),
  numero int, titulo text not null, convidada text,
  negocio_id uuid references public.negocios(id) on delete set null,
  resumo text, link text, capa_url text, data date,
  publicado boolean not null default false,
  criado_em timestamptz default now()
);
alter table public.episodios enable row level security;
create policy episodios_read on public.episodios for select using (publicado or public.is_admin());
create policy episodios_admin on public.episodios for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo text not null default 'role' check (tipo in ('feira','role','outro')),
  data date, hora text, local text, descricao text, link text, capa_url text,
  publicado boolean not null default false,
  criado_em timestamptz default now()
);
alter table public.eventos enable row level security;
create policy eventos_read on public.eventos for select using (publicado or public.is_admin());
create policy eventos_admin on public.eventos for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.achadinhos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null, descricao text, loja text,
  preco numeric(10,2), preco_antigo numeric(10,2), cupom text,
  link text not null, imagem_url text, categoria text,
  fonte text not null default 'manual' check (fonte in ('manual','robo')),
  status text not null default 'sugerido' check (status in ('sugerido','publicado','descartado')),
  publicado_em timestamptz,
  criado_em timestamptz default now()
);
alter table public.achadinhos enable row level security;
create policy achadinhos_read on public.achadinhos for select using (status = 'publicado' or public.is_admin());
create policy achadinhos_admin on public.achadinhos for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.conteudos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  formato text default 'reels' check (formato in ('reels','story','post','podcast')),
  roteiro text, link_arquivo text, data_prevista date,
  status text not null default 'ideia' check (status in ('ideia','aprovado','gravado','publicado','descartado')),
  observacao text,
  criado_em timestamptz default now()
);
alter table public.conteudos enable row level security;
create policy conteudos_admin on public.conteudos for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 80),
  negocio text check (char_length(negocio) <= 120),
  whatsapp text not null check (char_length(whatsapp) between 8 and 30),
  plano text check (char_length(plano) <= 30),
  tipo text not null default 'anuncio' check (tipo in ('anuncio','feira','parceria')),
  mensagem text check (char_length(mensagem) <= 600),
  status text not null default 'novo' check (status in ('novo','conversando','fechado','perdido')),
  criado_em timestamptz default now()
);
alter table public.leads enable row level security;
create policy leads_public_insert on public.leads for insert to anon, authenticated with check (status = 'novo');
create policy leads_admin on public.leads for select to authenticated using (public.is_admin());
create policy leads_admin_upd on public.leads for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy leads_admin_del on public.leads for delete to authenticated using (public.is_admin());

create table public.metricas (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('visita','clique')),
  alvo text not null check (char_length(alvo) <= 40),
  ref_id uuid,
  criado_em timestamptz default now()
);
alter table public.metricas enable row level security;
create policy metricas_insert on public.metricas for insert to anon, authenticated with check (true);
create policy metricas_admin_read on public.metricas for select to authenticated using (public.is_admin());
create index metricas_criado_idx on public.metricas (criado_em);
create index negocios_status_idx on public.negocios (status, categoria);
create index achadinhos_status_idx on public.achadinhos (status, publicado_em desc);
create index episodios_negocio_idx on public.episodios (negocio_id);

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

create or replace function public.resumo_metricas(dias int default 30)
returns json language plpgsql stable security definer set search_path = public as $$
declare r json;
begin
  if not public.is_admin() then raise exception 'sem permissão'; end if;
  select json_build_object(
    'visitas', (select count(*) from metricas where tipo='visita' and criado_em > now() - make_interval(days => dias)),
    'cliques', (select count(*) from metricas where tipo='clique' and criado_em > now() - make_interval(days => dias)),
    'por_pagina', (select coalesce(json_agg(x order by x.total desc), '[]') from (select alvo, count(*) total from metricas where tipo='visita' and criado_em > now() - make_interval(days => dias) group by alvo) x),
    'por_clique', (select coalesce(json_agg(x order by x.total desc), '[]') from (select alvo, count(*) total from metricas where tipo='clique' and criado_em > now() - make_interval(days => dias) group by alvo) x),
    'top_achadinhos', (select coalesce(json_agg(x), '[]') from (select a.titulo, count(*) total from metricas m join achadinhos a on a.id=m.ref_id where m.alvo='achadinho' and m.criado_em > now() - make_interval(days => dias) group by a.titulo order by 2 desc limit 5) x),
    'top_negocios', (select coalesce(json_agg(x), '[]') from (select n.nome, n.plano, count(*) total from metricas m join negocios n on n.id=m.ref_id where m.alvo like 'negocio_%' and m.criado_em > now() - make_interval(days => dias) group by n.nome, n.plano order by 3 desc limit 10) x),
    'por_dia', (select coalesce(json_agg(x order by x.dia), '[]') from (select to_char(date_trunc('day', criado_em at time zone 'America/Sao_Paulo'),'YYYY-MM-DD') dia, count(*) filter (where tipo='visita') visitas, count(*) filter (where tipo='clique') cliques from metricas where criado_em > now() - make_interval(days => dias) group by 1) x)
  ) into r;
  return r;
end $$;
revoke all on function public.resumo_metricas(int) from public, anon;
grant execute on function public.resumo_metricas(int) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos','fotos', true, 5242880, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;
create policy fotos_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'fotos' and public.is_admin());
create policy fotos_admin_update on storage.objects for update to authenticated using (bucket_id = 'fotos' and public.is_admin());
create policy fotos_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'fotos' and public.is_admin());
