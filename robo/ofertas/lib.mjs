// Regras da Liga para escolher ofertas (mesmas do robô da Shopee). Sem dependências.
export const FILTRO = {
  porLojaPorDia: 20,   // no máximo 20 ofertas novas de cada loja por dia
  porPalavra: 50,      // resultados lidos por palavra de busca
  descontoMinimo: 0,   // % (0 = aceita sem desconto, mas desconto conta pontos)
  proibidas: /eletrodom|air ?fryer|liquidificador|geladeira|celular|smartphone|\btv\b|televis|notebook|vape|arma|aposta|adulto|sexy|lingerie|usado|recondicionado/i,
};

export const palavrasDoTema = (t) => String(t.palavras || '').split(',').map((s) => s.trim()).filter(Boolean);

// Transforma um item da busca do Mercado Livre numa oferta da fila Aprovar (ou null se não passa no filtro).
export function ofertaML(it, tema) {
  if (!it || !it.id || !it.permalink) return null;
  const titulo = String(it.title || '');
  const preco = Number(it.price || 0);
  if (!preco || FILTRO.proibidas.test(titulo)) return null;
  if (it.condition && it.condition !== 'new') return null;
  if (tema.preco_max && preco > Number(tema.preco_max)) return null;
  const antigo = Number(it.original_price || 0);
  const desconto = antigo > preco ? Math.round((1 - preco / antigo) * 100) : 0;
  if (desconto < FILTRO.descontoMinimo) return null;
  const freteGratis = !!(it.shipping && it.shipping.free_shipping);
  const lojaOficial = !!it.official_store_id;
  const extras = [desconto ? `${desconto}% off` : '', freteGratis ? 'frete grátis' : '', lojaOficial ? 'loja oficial' : ''].filter(Boolean);
  return {
    origem_id: 'ml:' + it.id,
    titulo, loja: 'Mercado Livre',
    link: it.permalink, link_produto: it.permalink, precisa_link: true,
    preco, preco_antigo: antigo > preco ? antigo : '',
    imagem_url: String(it.thumbnail || '').replace(/^http:/, 'https:').replace(/-I\.(jpg|webp)$/, '-O.$1'),
    tema_id: tema.id,
    descricao: extras.length ? extras.join(' · ') + '.' : '',
    _pontos: desconto * 3 + (freteGratis ? 40 : 0) + (lojaOficial ? 30 : 0),
  };
}

// Junta as ofertas de todos os temas, tira repetidas e fica com as melhores, dividindo entre os temas.
export function escolher(porTema, limite = FILTRO.porLojaPorDia) {
  const vistos = new Set();
  const filas = porTema.map((lista) => lista.filter((o) => !vistos.has(o.origem_id) && vistos.add(o.origem_id))
    .sort((a, b) => b._pontos - a._pontos));
  const saida = [];
  for (let i = 0; saida.length < limite && filas.some((f) => f.length > i); i++) {
    for (const f of filas) if (f[i] && saida.length < limite) saida.push(f[i]);
  }
  return saida.map(({ _pontos, ...o }) => o);
}
