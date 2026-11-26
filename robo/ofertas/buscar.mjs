// Busca diária de ofertas da Liga (roda no GitHub Actions, grátis).
// Só usa APIs OFICIAIS das lojas. Hoje: Mercado Livre. Shopee roda no Apps Script (robo/shopee-liga.gs).
// Amazon entra quando a conta de Associados for aprovada.
// Nada é publicado: tudo cai na fila "Aprovar" do painel para a Jaque decidir.
import { FILTRO, ofertaML, escolher, palavrasDoTema } from './lib.mjs';

const SUPABASE_URL = 'https://hrgvtdfsqtjlfzhsdcnk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WK084yz0hOSX7uVE79YNHw_GcPJiBRR'; // chave pública do site (não é segredo)
const { CHAVE_LIGA, ML_CLIENT_ID, ML_CLIENT_SECRET } = process.env;
const TESTE = process.argv.includes('--teste'); // --teste: busca e mostra quantas acharia, sem gravar

async function rpc(nome, corpo) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}`, {
    method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Supabase ${nome} ${r.status}: ${txt.slice(0, 200)}`);
  return JSON.parse(txt);
}

async function tokenML() {
  const r = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: ML_CLIENT_ID, client_secret: ML_CLIENT_SECRET }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Mercado Livre não deu o acesso (HTTP ${r.status}: ${j.message || j.error || 'sem detalhe'})`);
  return j.access_token;
}

async function buscarML(token, palavra) {
  const u = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(palavra)}&condition=new&limit=${FILTRO.porPalavra}`;
  const r = await fetch(u, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`busca do Mercado Livre respondeu HTTP ${r.status}`);
  return (await r.json()).results || [];
}

async function main() {
  if (!CHAVE_LIGA) throw new Error('Falta o segredo CHAVE_LIGA no GitHub (é a chave do robô em Ajustes do painel).');
  const temas = await rpc('temas_para_robo', { chave: CHAVE_LIGA });
  console.log(`Temas ativos: ${temas.length}`);
  if (!temas.length) return console.log('Nenhum tema ativo com palavras de busca. Cadastre em Conteúdo › Temas.');

  // Mercado Livre
  if (!ML_CLIENT_ID || !ML_CLIENT_SECRET) {
    console.log('Mercado Livre: pulado (faltam os segredos ML_CLIENT_ID e ML_CLIENT_SECRET).');
  } else {
    const token = await tokenML();
    const porTema = [];
    let lidos = 0, erros = 0;
    for (const t of temas) {
      const lista = [];
      for (const p of palavrasDoTema(t)) {
        try { const itens = await buscarML(token, p); lidos += itens.length; itens.forEach((it) => { const o = ofertaML(it, t); if (o) lista.push(o); }); }
        catch (e) { erros++; console.log(`Mercado Livre: ${e.message}`); }
      }
      porTema.push(lista);
    }
    const lote = escolher(porTema);
    console.log(`Mercado Livre: ${lidos} produtos lidos, ${porTema.flat().length} passaram no filtro, ${lote.length} escolhidos${erros ? `, ${erros} busca(s) com erro` : ''}.`);
    if (!TESTE && lote.length) console.log(`Mercado Livre: ${await rpc('registrar_ofertas', { chave: CHAVE_LIGA, ofertas: lote })} oferta(s) nova(s) na fila Aprovar.`);
  }

  console.log('Shopee: roda pelo robô do Apps Script assim que a Shopee liberar a API de afiliados.');
  console.log('Amazon: aguardando aprovação da conta de Associados.');
}

main().catch((e) => { console.error('Erro: ' + e.message); process.exit(1); });
