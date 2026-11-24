-- Robô de ofertas da Shopee (robo/shopee-liga.gs): lê temas ativos e grava achadinhos 'sugerido' pela chave do robô.
alter table public.temas add column if not exists preco_max numeric(10,2);
alter table public.achadinhos add column if not exists origem_id text;
create unique index if not exists achadinhos_origem_id_key on public.achadinhos (origem_id) where origem_id is not null;
alter table public.achadinhos add column if not exists nota numeric(3,2);
alter table public.achadinhos add column if not exists vendas int;
alter table public.achadinhos add column if not exists comissao numeric(6,4);
-- funções temas_para_robo(chave) e registrar_ofertas(chave, ofertas): ver migração "robo_ofertas" no Supabase.
