# Liga das Mamães

Site público da Liga das Mamães (Atibaia e região) e painel da equipe em `/painel`.

- HTML/JS puro, sem build. Publicado pelo GitHub Pages (branch `main`, pasta raiz).
- Dados no Supabase (plano grátis). A chave em `assets/config.js` é pública; a segurança vem das regras do banco (RLS).

## Banco de dados

Projeto Supabase `liga-das-mamaes` na organização "Liga das Mamães" (conta da Jaque). Para recriar o banco do zero, rode no SQL Editor, nesta ordem: `supabase/schema.sql`, `supabase/seed.sql`, `supabase/002_temas.sql`, `supabase/003_ideias.sql`.
