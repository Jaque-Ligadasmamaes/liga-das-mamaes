-- Dados iniciais
insert into public.config (chave, valor) values
 ('link_comunidade', ''), ('link_canal', ''), ('instagram', ''), ('whatsapp_contato', ''),
 ('texto_hero', 'Uma rede de apoio de mães de Atibaia e região. Indicações de confiança, trocas, encontros e muito acolhimento.'),
 ('feira_data', ''), ('preco_parceira', '30'), ('preco_destaque', '50')
on conflict (chave) do nothing;
insert into public.admins(email) values ('jaque.ligadasmamaes@gmail.com'), ('ml.cecells@gmail.com') on conflict do nothing;
insert into public.negocios (nome, categoria, cidade, descricao, status) values
('Restaurante Nordestino','Alimentação','Atibaia','Parceiro amigo da Liga. Completar dados.','pendente'),
('Óticas Lures','Saúde','Atibaia','Parceira amiga da Liga. Completar dados.','pendente'),
('Cis-Kids','Saúde','Atibaia','Parceira amiga da Liga. Completar dados e categoria.','pendente');
insert into public.eventos (titulo, tipo, descricao, publicado) values
('Feira da Liga','feira','Nosso bazar de fim de ano com negócios de mães da Liga. Data e local em breve. Quer expor? Fale com a gente!', true);
insert into public.conteudos (titulo, formato, status, data_prevista, observacao) values
('Café com a Liga #1: primeira visita','podcast','ideia','2026-12-05','Primeira visita prevista para 05/12');
insert into public.achadinhos (titulo, loja, preco, preco_antigo, link, descricao, status, fonte) values
('Kit 3 bodies de algodão (exemplo)', 'Shopee', 49.90, 79.90, 'https://shopee.com.br', 'Exemplo de oferta sugerida pelo robô. Pode descartar.', 'sugerido', 'robo');
