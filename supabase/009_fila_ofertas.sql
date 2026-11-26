-- Busca diária de ofertas (20 por loja): marca as ofertas que ainda não têm link de afiliado
-- (ex.: Mercado Livre, que não tem API de link) e guarda o link original do produto.
alter table public.achadinhos add column if not exists precisa_link boolean not null default false;
alter table public.achadinhos add column if not exists link_produto text;
create index if not exists achadinhos_loja_status_idx on public.achadinhos (loja, status);

create or replace function public.registrar_ofertas(chave text, ofertas jsonb)
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare n int;
begin
  if chave is null or chave <> (select valor from public.segredos where nome = 'robo_emails') then raise exception 'chave inválida'; end if;
  insert into public.achadinhos (titulo, link, loja, preco, preco_antigo, imagem_url, descricao, tema_id, status, fonte, origem_id, nota, vendas, comissao, precisa_link, link_produto)
  select left(o->>'titulo',200), o->>'link', coalesce(o->>'loja','Shopee'), (o->>'preco')::numeric, nullif(o->>'preco_antigo','')::numeric,
         o->>'imagem_url', left(o->>'descricao',500), nullif(o->>'tema_id','')::uuid, 'sugerido', 'robo', o->>'origem_id',
         nullif(o->>'nota','')::numeric, nullif(o->>'vendas','')::int, nullif(o->>'comissao','')::numeric,
         coalesce((o->>'precisa_link')::boolean, false), coalesce(o->>'link_produto', o->>'link')
  from jsonb_array_elements(ofertas) o
  where coalesce(o->>'origem_id','') <> '' and coalesce(o->>'link','') <> ''
  on conflict (origem_id) where origem_id is not null do nothing;
  get diagnostics n = row_count;
  return n;
end $function$;
