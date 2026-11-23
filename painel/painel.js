import { sb, esc, $, $$, brl, dataBR, safeUrl, waLink, toast } from '../assets/lib.js';
import { CATEGORIAS, CIDADES } from '../assets/config.js';

const app = $('#app');
let TEMAS = [];
const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const temaAtivo = (t) => (!t.inicio || t.inicio <= hoje()) && (!t.fim || t.fim >= hoje());
const nomeTema = (id) => { const t = TEMAS.find((x) => x.id === id); return t ? `${t.emoji || ''} ${t.nome}` : ''; };

// Texto pronto para o grupo/canal de Achadinhos no WhatsApp
function textoWhats(o) {
  const t = TEMAS.find((x) => x.id === o.tema_id);
  const linhas = [`🎁 *Achadinho da Liga*${t ? ` · ${t.emoji || ''} ${t.nome}` : ''}`, '', `*${o.titulo}*`];
  if (o.descricao) linhas.push(o.descricao);
  linhas.push('');
  if (o.preco) linhas.push(o.preco_antigo ? `💰 De ~${brl(o.preco_antigo)}~ por *${brl(o.preco)}*` : `💰 *${brl(o.preco)}*`);
  if (o.cupom) linhas.push(`🏷️ Cupom: *${o.cupom}*`);
  linhas.push(`🛒 ${o.loja ? o.loja + ': ' : ''}${o.link}`, '', '_Link de afiliado: você paga o mesmo preço e ajuda a manter a Liga 💗_');
  return linhas.join('\n');
}
async function enviarWhats(o) {
  const texto = textoWhats(o);
  try {
    if (navigator.share) { await navigator.share({ text: texto }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(texto); toast('Texto copiado! Cole no grupo de Achadinhos.'); }
  catch { prompt('Copie o texto:', texto); }
}
window.__enviarWhats = async (id) => {
  const { data } = await sb.from('achadinhos').select('*').eq('id', id).single();
  if (data) enviarWhats(data);
};

/* ---------- O que dá para cadastrar ---------- */
const op = (arr) => arr.map((x) => (Array.isArray(x) ? x : [x, x]));
const ENT = {
  negocios: {
    nome: 'Guia da Liga', icone: '📒', titulo: (r) => r.nome, ordem: ['criado_em', false],
    sub: (r) => [r.categoria, r.cidade, r.plano !== 'gratis' ? '★ ' + r.plano : '', r.status].filter(Boolean).join(' · '),
    campos: [
      ['nome', 'Nome', 'text', { req: true }], ['categoria', 'Categoria', 'select', { op: op(CATEGORIAS), req: true }],
      ['cidade', 'Cidade', 'select', { op: op(CIDADES) }], ['descricao', 'Descrição', 'textarea'],
      ['whatsapp', 'WhatsApp', 'tel'], ['instagram', 'Instagram', 'text', { ph: '@perfil' }], ['site', 'Site', 'text'],
      ['endereco', 'Endereço', 'text'], ['foto_url', 'Foto', 'foto'], ['de_mae', 'É negócio de mãe', 'bool'],
      ['plano', 'Plano', 'select', { op: [['gratis', 'Grátis'], ['parceira', 'Parceira da Liga (pago)'], ['destaque', 'Destaque (pago)']] }],
      ['plano_ate', 'Plano pago até', 'date'],
      ['status', 'Situação', 'select', { op: [['pendente', 'Aguardando aprovação'], ['aprovado', 'Publicado no Guia'], ['arquivado', 'Arquivado']] }],
      ['indicado_por', 'Indicado por', 'text'], ['contato_indicacao', 'Contato de quem indicou', 'text'],
    ],
    novo: { status: 'aprovado', plano: 'gratis' },
  },
  achadinhos: {
    nome: 'Achadinhos', icone: '🎁', titulo: (r) => r.titulo, ordem: ['criado_em', false],
    sub: (r) => [nomeTema(r.tema_id), r.loja, brl(r.preco), r.status].filter(Boolean).join(' · '),
    extra: (r) => r.status === 'publicado' ? `<div class="acoes"><button class="btn zap peq" onclick="__enviarWhats('${r.id}')">Enviar no WhatsApp</button></div>` : '',
    campos: [
      ['titulo', 'Produto', 'text', { req: true }], ['link', 'Link de afiliado', 'text', { req: true }],
      ['tema_id', 'Tema', 'select', { opFn: () => TEMAS.map((t) => [t.id, `${t.emoji || ''} ${t.nome}${temaAtivo(t) ? '' : ' (fora de época)'}`]) }],
      ['loja', 'Loja', 'select', { op: op(['Shopee', 'Mercado Livre', 'Amazon', 'Magalu', 'Outra']) }],
      ['preco', 'Preço (R$)', 'number'], ['preco_antigo', 'Preço antes (R$)', 'number'], ['cupom', 'Cupom', 'text'],
      ['imagem_url', 'Foto do produto', 'foto'], ['descricao', 'Por que vale a pena', 'textarea'],
      ['status', 'Situação', 'select', { op: [['sugerido', 'Para aprovar'], ['publicado', 'Publicado'], ['descartado', 'Descartado']] }],
    ],
    novo: { status: 'publicado', fonte: 'manual' },
  },
  episodios: {
    nome: 'Café com a Liga', icone: '☕', titulo: (r) => `#${r.numero ?? '?'} ${r.titulo}`, ordem: ['data', false],
    sub: (r) => [r.convidada, dataBR(r.data), r.publicado ? 'publicado' : 'rascunho'].filter(Boolean).join(' · '),
    campos: [
      ['numero', 'Número do episódio', 'number'], ['titulo', 'Título', 'text', { req: true }], ['convidada', 'Convidada', 'text'],
      ['resumo', 'Resumo', 'textarea'], ['link', 'Link do vídeo (Instagram, YouTube…)', 'text'], ['capa_url', 'Capa', 'foto'],
      ['data', 'Data', 'date'], ['publicado', 'Mostrar no site', 'bool'],
    ],
    novo: { publicado: false },
  },
  eventos: {
    nome: 'Agenda', icone: '🛍️', titulo: (r) => r.titulo, ordem: ['data', true],
    sub: (r) => [r.tipo, r.data ? dataBR(r.data) : 'data a definir', r.publicado ? 'publicado' : 'rascunho'].join(' · '),
    campos: [
      ['titulo', 'Nome do evento', 'text', { req: true }], ['tipo', 'Tipo', 'select', { op: [['feira', 'Feira da Liga'], ['role', 'Rolê da Liga'], ['outro', 'Outro']] }],
      ['data', 'Data', 'date'], ['hora', 'Horário', 'text', { ph: '9h às 13h' }], ['local', 'Local', 'text'],
      ['descricao', 'Descrição', 'textarea'], ['link', 'Link (inscrição, mapa…)', 'text'], ['capa_url', 'Arte', 'foto'],
      ['publicado', 'Mostrar no site', 'bool'],
    ],
    novo: { tipo: 'role', publicado: true },
  },
  ideias: {
    nome: 'Caixa de ideias', icone: '💡', titulo: (r) => r.texto.length > 80 ? r.texto.slice(0, 80) + '…' : r.texto, ordem: ['criado_em', false],
    sub: (r) => [dataBR(r.criado_em), { nova: 'nova', desenvolvida: 'Claude desenvolveu', virou_acao: 'virou ação', arquivada: 'arquivada' }[r.status]].join(' · '),
    extra: (r) => r.desenvolvimento ? `<div class="small" style="white-space:pre-wrap;background:#fff7fa;border-radius:12px;padding:10px">✨ ${esc(r.desenvolvimento)}</div>` : '',
    campos: [
      ['texto', 'Ideia', 'textarea', { req: true }],
      ['desenvolvimento', 'Desenvolvimento (Claude)', 'textarea'],
      ['status', 'Situação', 'select', { op: [['nova', 'Nova'], ['desenvolvida', 'Claude desenvolveu'], ['virou_acao', 'Virou ação'], ['arquivada', 'Arquivada']] }],
    ],
    novo: { status: 'nova' },
  },
  temas: {
    nome: 'Temas da vez', icone: '🗓️', titulo: (r) => `${r.emoji || ''} ${r.nome}`, ordem: ['inicio', true],
    sub: (r) => [r.inicio ? `${dataBR(r.inicio)} a ${dataBR(r.fim)}` : 'o ano todo', temaAtivo(r) ? 'ativo agora' : 'fora de época', `meta ${r.meta_semana || 0}/semana`].join(' · '),
    extra: (r) => r.palavras ? `<p class="small muted">🔎 ${esc(r.palavras)}</p>` : '',
    campos: [
      ['nome', 'Nome do tema', 'text', { req: true }], ['emoji', 'Emoji', 'text', { ph: '☀️' }], ['descricao', 'Descrição (aparece no site)', 'textarea'],
      ['inicio', 'Começa em', 'date'], ['fim', 'Termina em', 'date'],
      ['palavras', 'O que buscar (palavras separadas por vírgula)', 'textarea'], ['meta_semana', 'Meta de ofertas por semana', 'number'],
      ['publicado', 'Mostrar no site', 'bool'],
    ],
    novo: { publicado: true, meta_semana: 8 },
  },
  conteudos: {
    nome: 'Vídeos e posts', icone: '🎬', titulo: (r) => r.titulo, ordem: ['data_prevista', true],
    sub: (r) => [r.formato, r.data_prevista ? dataBR(r.data_prevista) : '', r.status].filter(Boolean).join(' · '),
    campos: [
      ['titulo', 'Ideia', 'text', { req: true }], ['formato', 'Formato', 'select', { op: [['reels', 'Reels'], ['story', 'Stories'], ['post', 'Post'], ['podcast', 'Café com a Liga']] }],
      ['roteiro', 'Roteiro', 'textarea'], ['link_arquivo', 'Link do vídeo/arte', 'text'], ['data_prevista', 'Data prevista', 'date'],
      ['status', 'Situação', 'select', { op: [['ideia', 'Ideia (para aprovar)'], ['aprovado', 'Aprovado, falta gravar'], ['gravado', 'Gravado'], ['publicado', 'Publicado'], ['descartado', 'Descartado']] }],
      ['observacao', 'Observação', 'textarea'],
    ],
    novo: { status: 'aprovado', formato: 'reels' },
  },
  leads: {
    nome: 'Pedidos', icone: '💬', titulo: (r) => `${r.nome}${r.negocio ? ' · ' + r.negocio : ''}`, ordem: ['criado_em', false], semNovo: true,
    sub: (r) => [{ anuncio: 'Quer anunciar', feira: 'Quer expor na Feira', parceria: 'Parceria' }[r.tipo], r.plano, dataBR(r.criado_em), r.status].filter(Boolean).join(' · '),
    extra: (r) => `${r.mensagem ? `<p class="small">${esc(r.mensagem)}</p>` : ''}<div class="acoes"><a class="btn zap peq" target="_blank" rel="noopener" href="${esc(waLink(r.whatsapp, `Oi, ${r.nome}! Aqui é a Jaque, da Liga das Mamães. Recebi sua mensagem pelo site 💗`))}">Chamar no WhatsApp</a></div>`,
    campos: [
      ['nome', 'Nome', 'text'], ['negocio', 'Negócio', 'text'], ['whatsapp', 'WhatsApp', 'tel'], ['mensagem', 'Mensagem', 'textarea'],
      ['status', 'Situação', 'select', { op: [['novo', 'Novo'], ['conversando', 'Conversando'], ['fechado', 'Fechou!'], ['perdido', 'Não rolou']] }],
    ],
  },
};

/* ---------- Telas ---------- */
const topo = (titulo, dir = '') => `<header class="ptopo"><h1>${titulo}</h1>${dir}</header>`;

async function telaLogin() {
  $('#abas').hidden = true;
  app.innerHTML = `<div class="login">
    <h1>Painel da Liga 💗</h1>
    <p class="muted">Entre com o e-mail e a senha que o Cecells cadastrou para você.</p>
    <form id="fLogin">
      <div class="campo"><label>E-mail</label><input name="email" type="email" autocomplete="username" required></div>
      <div class="campo"><label>Senha</label><input name="senha" type="password" autocomplete="current-password" required></div>
      <button class="btn" style="width:100%">Entrar</button>
      <button class="btn sec" type="button" id="btnCriar" style="width:100%;margin-top:10px">Primeiro acesso: criar minha senha</button>
    </form>
    <p class="small muted" style="margin-top:18px">Dica: no iPhone, toque em Compartilhar › Adicionar à Tela de Início para abrir o painel como um app.</p>
  </div>`;
  $('#fLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const { error } = await sb.auth.signInWithPassword({ email: f.email.trim(), password: f.senha });
    if (error) return toast(/confirm/i.test(error.message) ? 'Falta confirmar o e-mail: abra o link que chegou na sua caixa de entrada.' : 'E-mail ou senha não conferem.');
    rota();
  });
  $('#btnCriar').addEventListener('click', async () => {
    const f = $('#fLogin');
    const email = f.elements.email.value.trim(); const senha = f.elements.senha.value;
    if (!email || senha.length < 8) return toast('Preencha o e-mail e uma senha de pelo menos 8 caracteres.');
    const { data, error } = await sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: location.href.split('#')[0] } });
    if (error) return toast('Não deu: ' + error.message);
    if (data.session) return rota();
    toast('Pronto! Confirme pelo link que chegou no seu e-mail e depois volte aqui para entrar.');
  });
}

async function contarPendencias() {
  const c = (t, col, v) => sb.from(t).select('id', { count: 'exact', head: true }).eq(col, v);
  const [n, a, v, l] = await Promise.all([c('negocios', 'status', 'pendente'), c('achadinhos', 'status', 'sugerido'), c('conteudos', 'status', 'ideia'), c('leads', 'status', 'novo')]);
  const p = { negocios: n.count || 0, achadinhos: a.count || 0, conteudos: v.count || 0, leads: l.count || 0 };
  const total = p.negocios + p.achadinhos + p.conteudos;
  $('#badge').hidden = !total; $('#badge').textContent = total;
  return p;
}

async function telaInicio() {
  const dias = Number(sessionStorage.getItem('dias') || 30);
  const [{ data: m, error }, pend] = await Promise.all([sb.rpc('resumo_metricas', { dias }), contarPendencias()]);
  if (error) return topo('Início') + `<div class="pcorpo"><div class="vazio">Não deu para carregar os números: ${esc(error.message)}</div></div>`;
  const nomes = { inicio: 'Página inicial', guia: 'Guia', indicar: 'Indicar', cafe: 'Café', agenda: 'Agenda', achadinhos: 'Achadinhos', anuncie: 'Anuncie', entrar: 'Entrar na Liga' };
  const cliqueNomes = { achadinho: 'Ofertas', negocio_whatsapp: 'WhatsApp de negócios', negocio_instagram: 'Instagram de negócios', negocio_site: 'Site de negócios', entrar_comunidade: 'Entrar na comunidade', entrar_canal: 'Canal de achadinhos', episodio: 'Episódios', evento: 'Eventos', instagram: 'Instagram da Liga', contato: 'Fale com a gente', pedir_entrada: 'Pedir entrada' };
  const barras = (arr, nm) => { const max = Math.max(1, ...arr.map((x) => x.total)); return arr.map((x) => `<div class="barra"><span>${esc(nm[x.alvo] || x.alvo)}</span><div class="b" style="width:${(x.total / max) * 100}%"></div><b>${x.total}</b></div>`).join('') || '<p class="muted small">Sem dados ainda.</p>'; };
  const semana = new Date(Date.now() - 7 * 864e5).toISOString();
  const { data: recentes } = await sb.from('achadinhos').select('tema_id, status').gte('criado_em', semana);
  const ativos = TEMAS.filter(temaAtivo);
  const painelTemas = ativos.length ? `<div class="item"><div class="linha"><h3>🗓️ Temas da vez</h3><a class="small" href="#/lista/temas">editar</a></div>${ativos.map((t) => {
    const pub = (recentes || []).filter((r) => r.tema_id === t.id && r.status === 'publicado').length;
    const fila = (recentes || []).filter((r) => r.tema_id === t.id && r.status === 'sugerido').length;
    return `<div><div class="linha"><span>${esc(t.emoji || '')} ${esc(t.nome)}</span><b>${pub}/${t.meta_semana || 0}</b></div><div class="small muted">${fila ? fila + ' na fila · ' : ''}${t.fim ? 'até ' + dataBR(t.fim) : 'o ano todo'}</div></div>`;
  }).join('')}<p class="small muted">Ofertas publicadas nos últimos 7 dias / meta da semana.</p></div>` : '';
  setTimeout(() => { const fi = $('#fIdeia'); if (fi) fi.addEventListener('submit', async (e) => {
    e.preventDefault(); const texto = fi.elements.texto.value.trim(); if (!texto) return;
    const { error } = await sb.from('ideias').insert({ texto });
    if (error) return toast('Não salvou: ' + error.message);
    fi.reset(); toast('Ideia guardada! O Claude vai desenvolver 💡');
  }); });
  const dia = m.por_dia || []; const maxd = Math.max(1, ...dia.map((d) => d.visitas));
  const pendTxt = [
    pend.negocios && `<a class="item" href="#/aprovar" style="text-decoration:none;color:inherit"><b>📒 ${pend.negocios} indicação(ões) para aprovar</b></a>`,
    pend.achadinhos && `<a class="item" href="#/aprovar" style="text-decoration:none;color:inherit"><b>🎁 ${pend.achadinhos} achadinho(s) para aprovar</b></a>`,
    pend.conteudos && `<a class="item" href="#/aprovar" style="text-decoration:none;color:inherit"><b>🎬 ${pend.conteudos} ideia(s) de vídeo para aprovar</b></a>`,
    pend.leads && `<a class="item" href="#/lista/leads" style="text-decoration:none;color:inherit"><b>💬 ${pend.leads} pedido(s) novo(s) de anunciante</b></a>`,
  ].filter(Boolean).join('');
  return topo('Oi, Jaque! 💗', `<select id="dias" style="width:auto">${[7, 30, 90].map((d) => `<option value="${d}" ${d === dias ? 'selected' : ''}>${d} dias</option>`).join('')}</select>`) + `
  <div class="pcorpo">
    <form class="item" id="fIdeia"><h3>💡 Teve uma ideia?</h3>
      <textarea name="texto" required placeholder="Toque no 🎤 do teclado e fale. Ex.: fazer um rolê de piscina em janeiro com uma marca de protetor solar…"></textarea>
      <div class="acoes"><button class="btn peq">Guardar ideia</button><a class="btn sec peq" href="#/lista/ideias">Ver minhas ideias</a></div>
    </form>
    ${pendTxt || '<div class="item"><b>✨ Nada para aprovar agora.</b></div>'}
    ${painelTemas}
    <div class="numeros">
      <div class="num"><b>${m.visitas}</b><span>visitas ao site</span></div>
      <div class="num"><b>${m.cliques}</b><span>cliques em links</span></div>
    </div>
    <div class="item"><h3>Visitas por dia</h3><div class="grafico">${dia.map((d) => `<div title="${esc(d.dia)}: ${d.visitas}" style="height:${(d.visitas / maxd) * 100}%"></div>`).join('') || '<p class="muted small">Sem dados ainda.</p>'}</div></div>
    <div class="item"><h3>O que mais clicam</h3>${barras(m.por_clique || [], cliqueNomes)}</div>
    <div class="item"><h3>Páginas mais vistas</h3>${barras(m.por_pagina || [], nomes)}</div>
    <div class="item"><h3>Achadinhos mais clicados</h3>${(m.top_achadinhos || []).map((x) => `<div class="linha"><span>${esc(x.titulo)}</span><b>${x.total}</b></div>`).join('') || '<p class="muted small">Sem dados ainda.</p>'}</div>
    <div class="item"><h3>Negócios mais procurados</h3>${(m.top_negocios || []).map((x) => `<div class="linha"><span>${esc(x.nome)}${x.plano !== 'gratis' ? ' ★' : ''}</span><b>${x.total}</b></div>`).join('') || '<p class="muted small">Sem dados ainda.</p>'}<p class="small muted">Use isso para mostrar às parceiras quantas mães chegaram até elas.</p></div>
  </div>`;
}

async function telaAprovar() {
  const [n, a, v] = await Promise.all([
    sb.from('negocios').select('*').eq('status', 'pendente').order('criado_em'),
    sb.from('achadinhos').select('*').eq('status', 'sugerido').order('criado_em'),
    sb.from('conteudos').select('*').eq('status', 'ideia').order('criado_em'),
  ]);
  contarPendencias();
  const bloco = (titulo, itens, ent, sim, nao, simTxt) => `<h2 class="titulo-sec">${titulo}</h2>` + (itens.length ? itens.map((r) => `
    <div class="item"><div class="linha">${r.imagem_url ? `<img class="miniatura" src="${esc(safeUrl(r.imagem_url))}" alt="">` : ''}<div style="flex:1"><h3>${esc(ENT[ent].titulo(r))}</h3><div class="small muted">${esc(ENT[ent].sub(r))}</div></div></div>
      ${r.descricao ? `<p class="small">${esc(r.descricao)}</p>` : ''}${r.roteiro ? `<p class="small">${esc(r.roteiro)}</p>` : ''}
      ${r.indicado_por ? `<p class="small muted">Indicado por ${esc(r.indicado_por)}${r.contato_indicacao ? ' · ' + esc(r.contato_indicacao) : ''}</p>` : ''}
      ${r.link && ent === 'achadinhos' ? `<a class="small" href="${esc(safeUrl(r.link))}" target="_blank" rel="noopener">Abrir oferta ↗</a>` : ''}
      <div class="acoes"><button class="btn verde peq" data-acao="${ent}|${r.id}|${sim}">${simTxt}</button><a class="btn sec peq" href="#/editar/${ent}/${r.id}">Editar</a><button class="btn perigo peq" data-acao="${ent}|${r.id}|${nao}">Descartar</button></div>
    </div>`).join('') : '<p class="muted small">Nada pendente.</p>');
  setTimeout(() => $$('[data-acao]').forEach((b) => b.addEventListener('click', async () => {
    const [ent, id, st] = b.dataset.acao.split('|');
    const upd = { status: st }; if (ent === 'achadinhos' && st === 'publicado') upd.publicado_em = new Date().toISOString();
    b.disabled = true;
    const { error } = await sb.from(ent).update(upd).eq('id', id);
    if (error) { b.disabled = false; return toast('Não deu: ' + error.message); }
    toast(st === 'descartado' || st === 'arquivado' ? 'Descartado' : 'Aprovado! 💗');
    if (ent === 'achadinhos' && st === 'publicado' && confirm('Publicado no site! Quer enviar agora no WhatsApp?')) await window.__enviarWhats(id);
    rota();
  })));
  return topo('Aprovar') + `<div class="pcorpo">
    ${bloco('🎁 Achadinhos', a.data || [], 'achadinhos', 'publicado', 'descartado', 'Publicar no site')}
    ${bloco('📒 Indicações para o Guia', n.data || [], 'negocios', 'aprovado', 'arquivado', 'Aprovar')}
    ${bloco('🎬 Ideias de vídeo', v.data || [], 'conteudos', 'aprovado', 'descartado', 'Aprovar ideia')}
  </div>`;
}

function telaConteudo() {
  return topo('Conteúdo') + `<div class="pcorpo">${['ideias', 'temas', 'achadinhos', 'negocios', 'episodios', 'eventos', 'conteudos'].map((k) => `
    <a class="item" href="#/lista/${k}" style="text-decoration:none;color:inherit"><div class="linha"><h3>${ENT[k].icone} ${ENT[k].nome}</h3><span>›</span></div></a>`).join('')}
    <a class="item" href="../" target="_blank" style="text-decoration:none;color:inherit"><div class="linha"><h3>🌐 Ver o site</h3><span>↗</span></div></a>
  </div>`;
}

async function telaLista(ent) {
  const E = ENT[ent]; if (!E) return telaConteudo();
  const filtro = sessionStorage.getItem('f_' + ent) || '';
  const campoSt = E.campos.find((c) => c[0] === 'status');
  let q = sb.from(ent).select('*').order(E.ordem[0], { ascending: E.ordem[1], nullsFirst: false }).limit(200);
  if (filtro) q = q.eq('status', filtro);
  const { data, error } = await q;
  if (ent === 'leads') contarPendencias();
  setTimeout(() => { const s = $('#fStatus'); if (s) s.addEventListener('change', () => { sessionStorage.setItem('f_' + ent, s.value); rota(); }); });
  return topo(`${E.icone} ${E.nome}`, E.semNovo ? '' : `<a class="btn peq" href="#/editar/${ent}/novo">+ Novo</a>`) + `<div class="pcorpo">
    ${ent !== 'leads' ? '<a class="voltar" href="#/conteudo">‹ Conteúdo</a>' : ''}
    ${campoSt ? `<select id="fStatus"><option value="">Todos</option>${campoSt[3].op.map(([v, l]) => `<option value="${v}" ${v === filtro ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>` : ''}
    ${error ? `<div class="vazio">${esc(error.message)}</div>` : (data || []).map((r) => `
      <div class="item"><a href="#/editar/${ent}/${r.id}" style="text-decoration:none;color:inherit"><h3>${esc(E.titulo(r))}</h3><div class="small muted">${esc(E.sub(r))}</div></a>${E.extra ? E.extra(r) : ''}</div>`).join('') || '<div class="vazio">Nada por aqui ainda.</div>'}
  </div>`;
}

function inputCampo([k, rot, tipo, o = {}], v) {
  const val = v ?? '';
  const req = o.req ? 'required' : '';
  let h;
  if (tipo === 'textarea') h = `<textarea name="${k}" ${req}>${esc(val)}</textarea>`;
  else if (tipo === 'select') h = `<select name="${k}" ${req}><option value="">—</option>${(o.opFn ? o.opFn() : o.op).map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(val) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>`;
  else if (tipo === 'bool') return `<div class="campo"><label class="check"><input type="checkbox" name="${k}" ${val ? 'checked' : ''}> ${esc(rot)}</label></div>`;
  else if (tipo === 'foto') h = `<input type="hidden" name="${k}" value="${esc(val)}"><img class="miniatura" id="prev_${k}" src="${esc(safeUrl(val))}" alt="" ${val ? '' : 'hidden'} style="width:120px;height:120px;margin-bottom:8px"><input type="file" accept="image/*" data-foto="${k}"><div class="ajuda">Escolha uma foto do celular.</div>`;
  else h = `<input name="${k}" type="${tipo === 'number' ? 'number" step="0.01' : tipo === 'tel' ? 'tel' : tipo}" value="${esc(tipo === 'date' ? String(val).slice(0, 10) : val)}" placeholder="${esc(o.ph || '')}" ${req}>`;
  return `<div class="campo"><label>${esc(rot)}${o.req ? ' *' : ''}</label>${h}</div>`;
}

async function telaEditar(ent, id) {
  const E = ENT[ent]; if (!E) return telaConteudo();
  let r = { ...(E.novo || {}) };
  if (id !== 'novo') { const { data } = await sb.from(ent).select('*').eq('id', id).single(); if (data) r = data; }
  setTimeout(() => {
    const f = $('#fEditar');
    $$('[data-foto]', f).forEach((inp) => inp.addEventListener('change', async () => {
      const arq = inp.files[0]; if (!arq) return;
      toast('Enviando foto…');
      const nome = `${ent}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${(arq.name.split('.').pop() || 'jpg').toLowerCase()}`;
      const { error } = await sb.storage.from('fotos').upload(nome, arq, { contentType: arq.type || 'image/jpeg' });
      if (error) return toast('A foto não subiu: ' + error.message);
      const url = sb.storage.from('fotos').getPublicUrl(nome).data.publicUrl;
      f.elements[inp.dataset.foto].value = url;
      const p = $('#prev_' + inp.dataset.foto); p.src = url; p.hidden = false; toast('Foto pronta ✔');
    }));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dados = {};
      for (const [k, , tipo] of E.campos) {
        const el = f.elements[k];
        if (tipo === 'bool') dados[k] = el.checked;
        else if (tipo === 'number') dados[k] = el.value === '' ? null : Number(el.value);
        else dados[k] = el.value.trim() === '' ? null : el.value.trim();
      }
      if (ent === 'achadinhos' && dados.status === 'publicado' && !r.publicado_em) dados.publicado_em = new Date().toISOString();
      if (id === 'novo' && E.novo?.fonte) dados.fonte = E.novo.fonte;
      const q = id === 'novo' ? sb.from(ent).insert(dados) : sb.from(ent).update(dados).eq('id', id);
      const { error } = await q;
      if (error) return toast('Não salvou: ' + error.message);
      toast('Salvo! 💗'); history.back();
    });
    const del = $('#btnApagar');
    if (del) del.addEventListener('click', async () => {
      if (!confirm('Apagar de vez? Isso não tem volta.')) return;
      const { error } = await sb.from(ent).delete().eq('id', id);
      if (error) return toast('Não apagou: ' + error.message);
      toast('Apagado'); location.hash = '#/lista/' + ent;
    });
  });
  return topo(id === 'novo' ? `Novo · ${E.nome}` : 'Editar') + `<div class="pcorpo">
    <a class="voltar" href="#/lista/${ent}">‹ ${E.nome}</a>
    <form id="fEditar" class="item">${E.campos.map((c) => inputCampo(c, r[c[0]])).join('')}
      <button class="btn" type="submit">Salvar</button>
      ${id !== 'novo' ? '<button type="button" class="btn perigo" id="btnApagar">Apagar</button>' : ''}
    </form>
  </div>`;
}

async function telaAjustes() {
  const { data } = await sb.from('config').select('*');
  const c = Object.fromEntries((data || []).map((r) => [r.chave, r.valor || '']));
  const campos = [
    ['link_comunidade', 'Link de convite da comunidade no WhatsApp', 'text'],
    ['link_canal', 'Link do Canal de Achadinhos', 'text'],
    ['instagram', 'Instagram da Liga', 'text'],
    ['whatsapp_contato', 'WhatsApp de contato da Liga', 'tel'],
    ['texto_hero', 'Frase da página inicial', 'textarea'],
    ['preco_parceira', 'Preço do plano Parceira (R$/mês)', 'number'],
    ['preco_destaque', 'Preço do plano Destaque (R$/mês)', 'number'],
    ['logo_url', 'Logo', 'foto'],
  ];
  setTimeout(() => {
    const f = $('#fAjustes');
    $$('[data-foto]', f).forEach((inp) => inp.addEventListener('change', async () => {
      const arq = inp.files[0]; if (!arq) return;
      const nome = `site/logo-${Date.now()}.${(arq.name.split('.').pop() || 'png').toLowerCase()}`;
      const { error } = await sb.storage.from('fotos').upload(nome, arq, { contentType: arq.type });
      if (error) return toast('A foto não subiu: ' + error.message);
      const url = sb.storage.from('fotos').getPublicUrl(nome).data.publicUrl;
      f.elements.logo_url.value = url; const p = $('#prev_logo_url'); p.src = url; p.hidden = false;
    }));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const linhas = campos.map(([k]) => ({ chave: k, valor: f.elements[k].value.trim(), atualizado_em: new Date().toISOString() }));
      const { error } = await sb.from('config').upsert(linhas);
      toast(error ? 'Não salvou: ' + error.message : 'Ajustes salvos 💗');
    });
    $('#fSenha').addEventListener('submit', async (e) => {
      e.preventDefault();
      const s = e.target.elements.nova.value;
      if (s.length < 8) return toast('Use pelo menos 8 caracteres.');
      const { error } = await sb.auth.updateUser({ password: s });
      toast(error ? 'Não trocou: ' + error.message : 'Senha trocada ✔'); e.target.reset();
    });
    $('#btnSair').addEventListener('click', async () => { await sb.auth.signOut(); rota(); });
  });
  return topo('Ajustes') + `<div class="pcorpo">
    <form id="fAjustes" class="item"><h3>Site</h3>${campos.map((cp) => inputCampo(cp, c[cp[0]])).join('')}<button class="btn">Salvar ajustes</button></form>
    <form id="fSenha" class="item"><h3>Trocar minha senha</h3><div class="campo"><input name="nova" type="password" autocomplete="new-password" placeholder="Nova senha (mín. 8)"></div><button class="btn sec">Trocar senha</button></form>
    <button class="btn perigo" id="btnSair">Sair do painel</button>
  </div>`;
}

/* ---------- Roteador ---------- */
async function rota() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return telaLogin();
  const { data: ok } = await sb.rpc('is_admin');
  if (!ok) {
    $('#abas').hidden = true;
    app.innerHTML = `<div class="login"><h1>Quase lá</h1><p>Seu e-mail entrou, mas ainda não tem acesso ao painel. Peça para o Cecells liberar.</p><button class="btn sec" id="sair">Sair</button></div>`;
    $('#sair').onclick = async () => { await sb.auth.signOut(); rota(); };
    return;
  }
  $('#abas').hidden = false;
  const { data: temas } = await sb.from('temas').select('*').order('inicio', { ascending: true, nullsFirst: false });
  TEMAS = temas || [];
  const partes = location.hash.replace(/^#\/?/, '').split('/');
  const aba = partes[0] || 'inicio';
  $$('#abas a').forEach((a) => a.classList.toggle('ativo', a.dataset.aba === (aba === 'lista' && partes[1] === 'leads' ? 'leads' : aba === 'lista' || aba === 'editar' ? 'conteudo' : aba)));
  app.innerHTML = '<div class="carregando">Carregando…</div>';
  try {
    app.innerHTML = await ({
      inicio: telaInicio, aprovar: telaAprovar, conteudo: telaConteudo, ajustes: telaAjustes,
      lista: () => telaLista(partes[1]), editar: () => telaEditar(partes[1], partes[2]),
    }[aba] || telaInicio)();
  } catch (e) { console.error(e); app.innerHTML = `<div class="pcorpo"><div class="vazio">Algo deu errado: ${esc(e.message)}</div></div>`; }
  window.scrollTo(0, 0);
  const d = $('#dias'); if (d) d.addEventListener('change', () => { sessionStorage.setItem('dias', d.value); rota(); });
}
window.addEventListener('hashchange', rota);
rota();
