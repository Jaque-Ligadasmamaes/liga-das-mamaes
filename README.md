# Liga das Mamães

Site público da Liga das Mamães (Atibaia e região) e painel da equipe em `/painel`.

- HTML/JS puro, sem build. Publicado pelo GitHub Pages (branch `main`, pasta raiz).
- Dados no Supabase (plano grátis). A chave em `assets/config.js` é pública; a segurança vem das regras do banco (RLS).

## Banco de dados

Projeto Supabase `liga-das-mamaes` na organização "Liga das Mamães" (conta da Jaque). Para recriar o banco do zero, rode no SQL Editor, nesta ordem: `supabase/schema.sql`, `supabase/seed.sql`, `supabase/002_temas.sql`, `supabase/003_ideias.sql`, `supabase/004_agentes.sql`, `supabase/005_emails.sql`, `supabase/006_tarefas.sql`, `supabase/007_robo_ofertas.sql`, `supabase/008_resumo_grupos.sql` (a carga dos agentes, com as instruções, fica nos arquivos do projeto, fora do repositório público).

## Robô de e-mails

`robo/gmail-liga.gs` é um Google Apps Script (grátis) que roda no Gmail da Liga às 6h e às 18h e manda para o painel (Conteúdo › E-mails da Liga) os e-mails de afiliados, lojas, parcerias e cadastros. A chave dele aparece no painel em Ajustes › Robô de e-mails e fica nas propriedades do script (CHAVE_LIGA), nunca no código.

## Robô do WhatsApp (resumo dos grupos)

`robo/whatsapp/` é um robô **somente leitura** (biblioteca Baileys, não oficial) que entra num chip separado da Liga como "aparelho conectado", 2x por dia pelo GitHub Actions (`.github/workflows/robo-whatsapp.yml`, grátis). Ele lê só os grupos ativados no painel (aba Grupos), guarda o mínimo (nome de exibição, texto, sem número de telefone, sem fotos/áudios) e apaga o texto depois de 3 dias. O envio de mensagens fica bloqueado no código. O Claude escreve o resumo 2x por dia (tabela `wa_resumos`) e a lista de pedidos sem resposta (`wa_pendencias`).

- Segredo do GitHub: `ROBO_WHATS_CHAVE` (a chave aparece no painel em Grupos › Configurar o robô).
- Parear: cadastre o número do chip no painel, depois em Actions › "Robô do WhatsApp" › Run workflow › `parear`, e digite o código de 8 letras no celular do chip.
- Testes: `cd robo/whatsapp && npm ci && npm test`.
