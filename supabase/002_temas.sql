-- Temas da vez (curadoria sazonal dos Achadinhos)
create table if not exists public.temas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  emoji text,
  descricao text,
  inicio date,
  fim date,
  palavras text,
  meta_semana int default 10,
  publicado boolean not null default true,
  criado_em timestamptz default now()
);
alter table public.temas enable row level security;
create policy temas_read on public.temas for select using (publicado or public.is_admin());
create policy temas_admin on public.temas for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.temas to anon, authenticated;
alter table public.achadinhos add column if not exists tema_id uuid references public.temas(id) on delete set null;
create index if not exists achadinhos_tema_idx on public.achadinhos (tema_id);

insert into public.temas (nome, emoji, descricao, inicio, fim, palavras, meta_semana) values
('Presentes de Natal até R$ 100', '🎄', 'Brinquedos que estimulam, livros e kits criativos. Nada de eletrônico caro.', '2026-11-23', '2026-12-20',
 'brinquedo educativo, brinquedo montessori, livro infantil, kit pintura infantil, massinha, quebra-cabeça infantil, fantoche, instrumento musical infantil', 15),
('Verão e piscina', '☀️', 'Tudo para curtir o calor com segurança: proteção solar, boias e roupas UV.', '2026-12-01', '2027-02-28',
 'boia infantil, colete salva-vidas infantil, maiô proteção UV, camiseta UV infantil, protetor solar infantil, piscina inflável, chapéu infantil, óculos de natação infantil, fralda de piscina', 10),
('Férias e viagem com criança', '🚗', 'Para sobreviver à estrada e aos dias em casa.', '2026-12-15', '2027-01-31',
 'organizador banco carro, jogo de viagem infantil, garrafinha infantil, lancheira térmica, kit atividades férias, livro de colorir, almofada de pescoço infantil', 8),
('Volta às aulas', '🎒', 'Material escolar com desconto, comprado com antecedência.', '2026-12-01', '2027-02-15',
 'mochila infantil, lancheira, estojo, etiqueta escolar personalizada, garrafa escolar, kit material escolar, caderno infantil, lápis de cor, uniforme', 12),
('Carnaval kids', '🎭', 'Fantasias e acessórios para os bloquinhos infantis.', '2027-01-15', '2027-02-10',
 'fantasia infantil, tiara carnaval, protetor auricular infantil, glitter biodegradável, leque, saia tutu', 8),
('Básicos do dia a dia', '🧺', 'O que toda mãe compra sempre: só quando o preço estiver realmente bom.', null, null,
 'fralda, lenço umedecido, pomada assadura, sabonete infantil, shampoo infantil, toalha com capuz, copo de transição', 6);
