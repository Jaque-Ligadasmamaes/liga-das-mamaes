/**
 * Robô de ofertas da Shopee para a Liga das Mamães (Google Apps Script, grátis).
 * Fica no MESMO projeto do robô de e-mails (script.google.com, conta da Liga).
 * Todo dia às 7h busca ofertas dos temas ativos na API de Afiliados da Shopee,
 * aplica os filtros da Liga e manda as melhores para a fila "Aprovar" do painel,
 * já com o link de afiliado da Liga. Nada é publicado sem a Jaque aprovar.
 *
 * Instalação (uma vez só, depois que a Shopee liberar a API de afiliados):
 * 1. No projeto do robô de e-mails, toque em "+" > Script, dê o nome "shopee" e cole este código.
 * 2. Engrenagem > Propriedades do script: adicione SHOPEE_APP_ID e SHOPEE_SECRET
 *    (do portal de Afiliados da Shopee > Open API). A CHAVE_LIGA já está lá.
 * 3. Escolha a função "instalarShopee" e toque em Executar.
 */
const SHOPEE_API = 'https://open-api.affiliate.shopee.com.br/graphql';

// Filtros da Liga (a Caçadora de achadinhos ajusta aqui se precisar)
const FILTRO = {
  notaMinima: 4.7,       // estrelas
  vendasMinimas: 500,    // vendidos
  porPalavra: 20,        // resultados lidos por palavra de busca
  maxPorTema: 6,         // ofertas novas por tema em cada rodada
  maxPorDia: 20,         // no máximo 20 ofertas novas da Shopee por dia
  proibidas: /eletrodom|air ?fryer|liquidificador|geladeira|celular|smartphone|tv |televis|notebook|vape|arma|aposta|adulto|sexy|lingerie/i,
};

function shopeeQuery_(query) {
  const p = PropertiesService.getScriptProperties();
  const appId = p.getProperty('SHOPEE_APP_ID'), secret = p.getProperty('SHOPEE_SECRET');
  if (!appId || !secret) throw new Error('Faltam SHOPEE_APP_ID e SHOPEE_SECRET nas propriedades do script.');
  const payload = JSON.stringify({ query: query });
  const ts = Math.floor(Date.now() / 1000);
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, appId + ts + payload + secret, Utilities.Charset.UTF_8);
  const sig = raw.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
  const r = UrlFetchApp.fetch(SHOPEE_API, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: payload,
    headers: { Authorization: 'SHA256 Credential=' + appId + ', Timestamp=' + ts + ', Signature=' + sig },
  });
  const j = JSON.parse(r.getContentText());
  if (j.errors) throw new Error('Shopee: ' + JSON.stringify(j.errors));
  return j.data;
}

function buscarShopee_(palavra) {
  const q = 'query { productOfferV2(keyword: ' + JSON.stringify(palavra) + ', sortType: 2, page: 1, limit: ' + FILTRO.porPalavra + ') {' +
    ' nodes { itemId productName priceMin priceMax priceDiscountRate sales ratingStar imageUrl offerLink shopName commissionRate } } }';
  return (shopeeQuery_(q).productOfferV2 || {}).nodes || [];
}

function supabaseRpc_(nome, corpo) {
  const r = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/' + nome, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: SUPABASE_KEY }, payload: JSON.stringify(corpo),
  });
  if (r.getResponseCode() >= 300) throw new Error('Supabase ' + nome + ' ' + r.getResponseCode() + ': ' + r.getContentText());
  return JSON.parse(r.getContentText());
}

function buscarOfertas() {
  const chave = PropertiesService.getScriptProperties().getProperty('CHAVE_LIGA');
  const temas = supabaseRpc_('temas_para_robo', { chave: chave });
  let total = 0;
  temas.forEach(function (t) {
    if (total >= FILTRO.maxPorDia) return;
    const vistos = {}; const bons = [];
    String(t.palavras).split(',').map(function (s) { return s.trim(); }).filter(String).forEach(function (palavra) {
      let itens = [];
      try { itens = buscarShopee_(palavra); } catch (e) { Logger.log(e.message); }
      itens.forEach(function (it) {
        const preco = Number(it.priceMin || it.priceMax || 0);
        const desconto = Number(it.priceDiscountRate || 0);
        if (vistos[it.itemId]) return; vistos[it.itemId] = 1;
        if (Number(it.ratingStar || 0) < FILTRO.notaMinima) return;
        if (Number(it.sales || 0) < FILTRO.vendasMinimas) return;
        if (t.preco_max && preco > Number(t.preco_max)) return;
        if (FILTRO.proibidas.test(it.productName || '')) return;
        bons.push({
          origem_id: 'shopee:' + it.itemId, titulo: it.productName, link: it.offerLink, loja: 'Shopee',
          preco: preco, preco_antigo: desconto > 0 ? Math.round(preco / (1 - desconto / 100) * 100) / 100 : '',
          imagem_url: it.imageUrl, tema_id: t.id, nota: it.ratingStar, vendas: it.sales, comissao: it.commissionRate,
          descricao: 'Nota ' + it.ratingStar + ' e ' + it.sales + ' vendidos' + (it.shopName ? ' · loja ' + it.shopName : '') + '.',
          _pontos: Number(it.ratingStar) * 1000 + Math.log(Number(it.sales) + 1) * 100 + desconto,
        });
      });
    });
    bons.sort(function (a, b) { return b._pontos - a._pontos; });
    const lote = bons.slice(0, Math.min(FILTRO.maxPorTema, FILTRO.maxPorDia - total)).map(function (o) { delete o._pontos; return o; });
    if (lote.length) total += Number(supabaseRpc_('registrar_ofertas', { chave: chave, ofertas: lote }));
  });
  Logger.log('Ofertas novas na fila Aprovar: ' + total);
  return total;
}

function instalarShopee() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'buscarOfertas') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('buscarOfertas').timeBased().everyDays(1).atHour(7).inTimezone('America/Sao_Paulo').create();
  const n = buscarOfertas();
  Logger.log('Pronto! O robô de ofertas roda todo dia às 7h. Agora foram ' + n + ' oferta(s) para o Aprovar.');
}
