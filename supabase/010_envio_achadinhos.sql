-- Envio automático dos achadinhos aprovados no grupo Achadinhos (pelo chip do robô).
-- Depende da 008_resumo_grupos.sql. A Jaque só aprova; o robô posta foto + legenda,
-- espaçado: das 8h às 21h (São Paulo), no mínimo 45 min entre posts e no máximo 5 por dia.

alter table public.wa_estado add column if not exists grupo_achadinhos text;            -- jid do grupo onde o robô posta
alter table public.wa_estado add column if not exists envio_ligado boolean not null default false;

alter table public.achadinhos add column if not exists envio_status text
  check (envio_status in ('na_fila', 'enviado', 'erro', 'cancelado'));
alter table public.achadinhos add column if not exists envio_em timestamptz;
alter table public.achadinhos add column if not exists envio_erro text;
create index if not exists achadinhos_envio_idx on public.achadinhos (envio_status, publicado_em);

-- Ao publicar (aprovar), entra sozinho na fila de envio, se o envio automático estiver ligado.
create or replace function public._achadinho_para_fila() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'publicado' and coalesce(old.status, '') <> 'publicado'
     and new.envio_status is null and not coalesce(new.precisa_link, false)
     and coalesce(new.origem_id, '') not like 'teste:%'
     and (select envio_ligado from public.wa_estado where id = 1) then
    new.envio_status := 'na_fila';
  end if;
  return new;
end $$;
drop trigger if exists achadinho_para_fila on public.achadinhos;
create trigger achadinho_para_fila before insert or update of status on public.achadinhos
  for each row execute function public._achadinho_para_fila();

-- Painel: liga/desliga o envio e escolhe o grupo.
create or replace function public.configurar_envio_whats(grupo text, ligado boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'sem acesso'; end if;
  update public.wa_estado set grupo_achadinhos = nullif(grupo, ''), envio_ligado = coalesce(ligado, false) where id = 1;
end $$;
revoke all on function public.configurar_envio_whats(text, boolean) from public, anon;
grant execute on function public.configurar_envio_whats(text, boolean) to authenticated;

create or replace function public.situacao_robo_whats() returns jsonb
language sql security definer set search_path = public as $$
  select case when public.is_admin() then jsonb_build_object(
    'conectado', sessao is not null, 'pausado', pausado, 'ultima_execucao', ultima_execucao,
    'ultimo_status', ultimo_status, 'numero_final', coalesce(numero_final, right(numero_chip, 4)), 'tem_numero', numero_chip is not null,
    'grupo_achadinhos', grupo_achadinhos, 'envio_ligado', envio_ligado,
    'na_fila', (select count(*) from public.achadinhos where envio_status = 'na_fila'),
    'enviados_hoje', (select count(*) from public.achadinhos where envio_status = 'enviado'
                      and (envio_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date)) end
  from public.wa_estado where id = 1;
$$;

-- Robô: qual é o próximo achadinho a postar agora? (null = nada a fazer nesta rodada)
create or replace function public.whats_proximo_envio(chave text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e public.wa_estado; agora timestamp := now() at time zone 'America/Sao_Paulo'; o jsonb;
begin
  perform public._checar_chave_whats(chave);
  select * into e from public.wa_estado where id = 1;
  if e.pausado or not e.envio_ligado or e.grupo_achadinhos is null or e.sessao is null then return null; end if;
  if extract(hour from agora) < 8 or extract(hour from agora) >= 21 then return null; end if;
  if exists (select 1 from public.achadinhos where envio_status = 'enviado' and envio_em > now() - interval '45 minutes') then return null; end if;
  if (select count(*) from public.achadinhos where envio_status = 'enviado'
      and (envio_em at time zone 'America/Sao_Paulo')::date = agora::date) >= 5 then return null; end if;
  select to_jsonb(a) into o from public.achadinhos a
    where a.envio_status = 'na_fila' and a.status = 'publicado' and not coalesce(a.precisa_link, false)
    order by a.publicado_em nulls last, a.criado_em limit 1;
  if o is null then return null; end if;
  return jsonb_build_object('sessao', e.sessao, 'grupo', e.grupo_achadinhos, 'oferta', o);
end $$;
revoke all on function public.whats_proximo_envio(text) from public;
grant execute on function public.whats_proximo_envio(text) to anon;

-- Robô: terminou de postar (ou falhou). Guarda a sessão atualizada.
create or replace function public.whats_envio_feito(chave text, id uuid, ok boolean, erro text, sessao text, status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._checar_chave_whats(chave);
  update public.achadinhos set envio_status = case when ok then 'enviado' else 'erro' end,
    envio_em = case when ok then now() else envio_em end, envio_erro = case when ok then null else left(erro, 300) end
    where achadinhos.id = whats_envio_feito.id;
  update public.wa_estado set sessao = coalesce(whats_envio_feito.sessao, wa_estado.sessao),
    ultima_execucao = now(), ultimo_status = left(coalesce(whats_envio_feito.status, ''), 200) where wa_estado.id = 1;
end $$;
revoke all on function public.whats_envio_feito(text, uuid, boolean, text, text, text) from public;
grant execute on function public.whats_envio_feito(text, uuid, boolean, text, text, text) to anon;
