import { sb, esc, $, $$, brl, dataBR, safeUrl, waLink, toast } from '../assets/lib.js';
import { CATEGORIAS, CIDADES } from '../assets/config.js';

const app = $('#app');
let TEMAS = [];
const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const temaAtivo = (t) => (!t.inicio || t.inicio <= hoje()) && (!t.fim || t.fim >= hoje());
let AGENTES = [];
const nomeAgente = (slug) => { const a = AGENTES.find((x) => x.slug === slug); return a ? `${a.emoji} ${a.nome}` : slug; };
const nomeTema = (id) => { const t = TEMAS.find((x) => x.id === id); return t ? `${t.emoji || ''} ${t.nome}` : ''; };

// Legenda que vai junto com a FOTO do produto (estilo escolhido pela Jaque):
//   🔥 NOME DO PRODUTO 📉
//   Comentário/chamada (linhas da descrição sem •)
//
//   💵 R$ 39 (antes R$ 62)
//   🧾 Cupom: CODIGO
//   • dicas (linhas da descrição com •)
//
//   🛒 Vendido por Loja
//   📌 Link: url
//
//   💗 Convide outras mamães para a Liga: site
const precoCurto = (v) => 'R$ ' + (Number(v) % 1 ? Number(v).toFixed(2).replace('.', ',') : String(Math.round(Number(v))));
function textoWhats(o) {
  const linhasDesc = String(o.descricao || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const ehDica = (l) => /^[•\-*]/.test(l);
  const dicas = linhasDesc.filter(ehDica).map((l) => '• ' + l.replace(/^[•\-*]\s*/, ''));
  const comentario = linhasDesc.filter((l) => !ehDica(l)).join('\n');
  const caiu = o.preco && o.preco_antigo > o.preco;
  const topo = [`🔥 *${String(o.titulo).toUpperCase().replace(/\*/g, '')}*${caiu ? ' 📉' : ''}`];
  if (comentario) topo.push(comentario);
  const valores = [];
  if (o.preco) valores.push(`💵 ${precoCurto(o.preco)}${caiu ? ` (antes ${precoCurto(o.preco_antigo)})` : ''}`);
  if (o.cupom) valores.push(`🧾 Cupom: *${o.cupom}*`);
  valores.push(...dicas);
  const link = [o.loja ? `🛒 Vendido por ${o.loja}` : '', `📌 Link: ${o.link}`].filter(Boolean);
  const site = new URL('../', location.href).href;
  return [topo.join('\n\n'), valores.join('\n'), link.join('\n'), `💗 Convide outras mamães para a Liga:\n${site}`, '_link de afiliado_']
    .filter(Boolean).join('\n\n');
}
async function fotoComoArquivo(url) {
  try {
    const r = await fetch(url, { mode: 'cors' });
    if (!r.ok) return null;
    const b = await r.blob();
    if (!b.type.startsWith('image/')) return null;
    return new File([b], 'achadinho.' + (b.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg'), { type: b.type });
  } catch { return null; }
}
async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { return false; }
}
// Abre uma tela com a foto e a legenda. No iPhone o WhatsApp manda a foto e ignora o texto,
// então a legenda já fica copiada: é só colar no campo "Adicionar legenda" antes de enviar.
async function enviarWhats(o) {
  const texto = textoWhats(o);
  const foto = o.imagem_url ? safeUrl(o.imagem_url) : '';
  const tela = document.createElement('div');
  tela.className = 'envio';
  tela.innerHTML = `<div class="envio-caixa">
      <button class="envio-fechar" aria-label="Fechar">✕</button>
      <h3>Enviar no Achadinhos</h3>
      ${foto ? `<img class="envio-foto" src="${esc(foto)}" alt="">` : '<p class="small" style="color:#b3261e">Esta oferta está sem foto. Toque em Editar e coloque a foto do produto antes de enviar.</p>'}
      <pre class="envio-texto">${esc(texto)}</pre>
      <ol class="small envio-passos">
        <li>Toque em <b>Enviar foto</b> e escolha o WhatsApp e o grupo.</li>
        <li>Na tela da foto, toque em <b>Adicionar legenda</b>, segure e toque em <b>Colar</b>.</li>
        <li>Envie. 💗</li>
      </ol>
      <div class="acoes">
        ${foto ? '<button class="btn zap" data-env="foto">📷 Enviar foto</button>' : ''}
        <button class="btn sec" data-env="copiar">Copiar legenda</button>
        <button class="btn sec" data-env="texto">Enviar só o texto</button>
      </div>
      <p class="small muted">Se a foto não for: toque e segure na foto acima › Compartilhar.</p>
    </div>`;
  document.body.appendChild(tela);
  const fechar = () => tela.remove();
  tela.addEventListener('click', (e) => { if (e.target === tela) fechar(); });
  tela.querySelector('.envio-fechar').addEventListener('click', fechar);
  const arquivo = foto ? fotoComoArquivo(foto) : Promise.resolve(null); // já começa a baixar
  tela.querySelectorAll('[data-env]').forEach((b) => b.addEventListener('click', async () => {
    const acao = b.dataset.env;
    const copiou = await copiar(texto);
    try {
      if (acao === 'foto') {
        const f = await arquivo;
        if (f && navigator.canShare && navigator.canShare({ files: [f] })) {
          toast(copiou ? 'Legenda copiada ✔ Cole no campo de legenda.' : 'Toque em Copiar legenda depois.');
          await navigator.share({ files: [f] });
        } else {
          toast('Não deu para anexar a foto daqui. Toque e segure na foto › Compartilhar. A legenda já está copiada.');
        }
      } else if (acao === 'texto') {
        if (navigator.share) await navigator.share({ text: texto });
        else window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
      } else {
        toast(copiou ? 'Legenda copiada ✔' : 'Toque e segure no texto para copiar.');
      }
    } catch (e) { if (e.name !== 'AbortError') toast('Não deu: ' + e.message); }
  }));
}
window.__resolverEmail = async (id) => {
  const { error } = await sb.from('emails_liga').update({ status: 'resolvido' }).eq('id', id);
  if (error) return toast('Não deu: ' + error.message);
  toast('Resolvido ✔'); rota();
};
window.__filaRobo = async (id, st) => {
  const { error } = await sb.from('achadinhos').update({ envio_status: st, envio_erro: null }).eq('id', id);
  if (error) return toast('Não deu: ' + error.message);
  toast(st === 'na_fila' ? 'Na fila: o robô posta no grupo 💗' : 'Tirei da fila do robô'); rota();
};
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
    extra: (r) => r.status === 'publicado' ? `<div class="acoes">
      ${r.envio_status === 'na_fila' ? `<span class="small">🤖 Na fila do robô</span><button class="btn sec peq" onclick="__filaRobo('${r.id}','cancelado')">Tirar da fila</button>`
        : r.envio_status === 'enviado' ? `<span class="small">✅ Postado pelo robô${r.envio_em ? ' ' + esc(horaBR(r.envio_em)) : ''}</span>`
        : `${r.envio_status === 'erro' ? '<span class="small" style="color:#b3261e">⚠️ O robô não conseguiu postar</span>' : ''}${'envio_status' in r ? `<button class="btn sec peq" onclick="__filaRobo('${r.id}','na_fila')">Robô posta</button>` : ''}`}
      <button class="btn zap peq" onclick="__enviarWhats('${r.id}')">Enviar eu mesma</button></div>` : '',
    campos: [
      ['titulo', 'Produto', 'text', { req: true }], ['link', 'Link de afiliado', 'text', { req: true }],
      ['tema_id', 'Tema', 'select', { opFn: () => TEMAS.map((t) => [t.id, `${t.emoji || ''} ${t.nome}${temaAtivo(t) ? '' : ' (fora de época)'}`]) }],
      ['loja', 'Loja', 'select', { op: op(['Shopee', 'Mercado Livre', 'Amazon', 'Magalu', 'Outra']) }],
      ['preco', 'Preço (R$)', 'number'], ['preco_antigo', 'Preço antes (R$)', 'number'], ['cupom', 'Cupom', 'text'],
      ['imagem_url', 'Foto do produto', 'foto'], ['descricao', 'Comentário e dicas', 'textarea', { ph: 'Por que vale a pena (ex.: sai a 6 reais cada pote!)\n• dica 1 (comece com •)\n• dica 2' }],
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
    extra: (r) => (r.desenvolvimento ? `<div class="small" style="white-space:pre-wrap;background:#fff7fa;border-radius:12px;padding:10px">✨ ${esc(r.desenvolvimento)}</div>` : '') + (r.agente ? `<a class="small" href="#/equipe/${esc(r.agente)}">👉 Com: ${esc(nomeAgente(r.agente))}</a>` : ''),
    campos: [
      ['texto', 'Ideia', 'textarea', { req: true }],
      ['desenvolvimento', 'Desenvolvimento (Claude)', 'textarea'],
      ['agente', 'Quem cuida', 'select', { opFn: () => AGENTES.map((a) => [a.slug, `${a.emoji} ${a.nome}`]) }],
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
      ['palavras', 'O que buscar (palavras separadas por vírgula)', 'textarea'], ['preco_max', 'Preço máximo (R$)', 'number'], ['meta_semana', 'Meta de ofertas por semana', 'number'],
      ['publicado', 'Mostrar no site', 'bool'],
    ],
    novo: { publicado: true, meta_semana: 8 },
  },
  lancamentos: {
    nome: 'Financeiro', icone: '💰', titulo: (r) => `${r.tipo === 'saida' ? '−' : '+'} ${brl(r.valor)} · ${r.descricao}`, ordem: ['data', false],
    sub: (r) => [dataBR(r.data), r.categoria, r.recebido ? '' : 'a receber'].filter(Boolean).join(' · '),
    campos: [
      ['tipo', 'Tipo', 'select', { op: [['entrada', 'Entrou dinheiro'], ['saida', 'Saiu dinheiro']] }],
      ['valor', 'Valor (R$)', 'number', { req: true }], ['descricao', 'Descrição', 'text', { req: true, ph: 'Plano Parceira · Óticas Lures' }],
      ['categoria', 'Categoria', 'select', { op: op(['Plano do Guia', 'Afiliados', 'Feira da Liga', 'Publi e parceria', 'Material', 'Anúncios', 'Ferramentas', 'Outros']) }],
      ['data', 'Data', 'date'], ['recebido', 'Já caiu na conta', 'bool'],
    ],
    novo: { tipo: 'entrada', recebido: true },
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
  emails_liga: {
    nome: 'E-mails da Liga', icone: '📬', titulo: (r) => r.assunto || '(sem assunto)', ordem: ['recebido_em', false], semNovo: true,
    sub: (r) => [r.remetente, dataBR(r.recebido_em), { afiliados: 'afiliados', dinheiro: '💰 dinheiro', parcerias: 'parceria', lojas: 'loja', redes: 'redes', seguranca: '🔒 segurança', outros: '' }[r.categoria], { novo: 'novo', resumido: 'para ver', resolvido: 'resolvido', arquivado: 'arquivado' }[r.status]].filter(Boolean).join(' · '),
    extra: (r) => `${r.resumo ? `<div class="resposta">${esc(r.resumo)}</div>` : ''}${r.acao ? `<div class="small"><b>👉 ${esc(r.acao)}</b></div>` : ''}<div class="acoes">${r.link ? `<a class="btn sec peq" target="_blank" rel="noopener" href="${esc(safeUrl(r.link))}">Abrir no Gmail</a>` : ''}${r.status !== 'resolvido' ? `<button class="btn verde peq" onclick="__resolverEmail('${r.id}')">Feito ✔</button>` : ''}</div>`,
    campos: [
      ['resumo', 'Resumo (Claude)', 'textarea'], ['acao', 'O que fazer', 'textarea'],
      ['status', 'Situação', 'select', { op: [['novo', 'Novo'], ['resumido', 'Para ver'], ['resolvido', 'Resolvido'], ['arquivado', 'Arquivado']] }],
    ],
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
  const em = sb.from('emails_liga').select('id', { count: 'exact', head: true }).in('status', ['novo', 'resumido']).not('acao', 'is', null);
  const [n, a, v, l, e, w] = await Promise.all([c('negocios', 'status', 'pendente'), c('achadinhos', 'status', 'sugerido'), c('conteudos', 'status', 'ideia'), c('leads', 'status', 'novo'), em, c('wa_pendencias', 'status', 'aberta')]);
  const p = { negocios: n.count || 0, achadinhos: a.count || 0, conteudos: v.count || 0, leads: l.count || 0, emails: e.count || 0, grupos: w.count || 0 };
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
  const { data: tarefas } = await sb.from('tarefas').select('*').eq('feito', false).order('ordem').order('criado_em');
  const pendTarefas = (tarefas || []).filter((t) => !t.para || t.para <= hoje());
  const painelTarefas = pendTarefas.length ? `<div class="item"><h3>✅ Pra fazer (${pendTarefas.length})</h3><p class="small muted" style="margin:0">Toque em cada uma para ver o passo a passo.</p></div>` + pendTarefas.map((t) => `
    <details class="item tarefa"><summary><div class="linha"><b>${esc(t.titulo)}</b><span class="small muted">${esc(t.tempo || '')}</span></div></summary>
      <div class="small" style="white-space:pre-wrap">${esc(t.passos || '')}</div>
      ${t.link ? `<a class="btn sec peq" target="_blank" rel="noopener" href="${esc(safeUrl(t.link))}">Abrir ↗</a>` : ''}
      <textarea data-resp="${t.id}" placeholder="Responder (opcional)">${esc(t.resposta || '')}</textarea>
      <div class="acoes"><button class="btn verde peq" data-feito="${t.id}">Feito ✔</button></div></details>`).join('') : '';
  setTimeout(() => $$('[data-feito]').forEach((b) => b.addEventListener('click', async () => {
    const id = b.dataset.feito; const resp = $(`[data-resp="${id}"]`).value.trim();
    b.disabled = true;
    const { error } = await sb.from('tarefas').update({ feito: true, feito_em: new Date().toISOString(), resposta: resp || null }).eq('id', id);
    if (error) { b.disabled = false; return toast('Não deu: ' + error.message); }
    toast('Feito! 💗'); rota();
  })));
  const dia = m.por_dia || []; const maxd = Math.max(1, ...dia.map((d) => d.visitas));
  const pendTxt = [
    pend.negocios && `<a class="item" href="#/aprovar" style="text-decoration:none;color:inherit"><b>📒 ${pend.negocios} indicação(ões) para aprovar</b></a>`,
    pend.achadinhos && `<a class="item" href="#/aprovar" style="text-decoration:none;color:inherit"><b>🎁 ${pend.achadinhos} achadinho(s) para aprovar</b></a>`,
    pend.conteudos && `<a class="item" href="#/aprovar" style="text-decoration:none;color:inherit"><b>🎬 ${pend.conteudos} ideia(s) de vídeo para aprovar</b></a>`,
    pend.emails && `<a class="item" href="#/lista/emails_liga" style="text-decoration:none;color:inherit"><b>📬 ${pend.emails} e-mail(s) da Liga pedem ação</b></a>`,
    pend.grupos && `<a class="item" href="#/grupos" style="text-decoration:none;color:inherit"><b>🙋 ${pend.grupos} pedido(s) sem resposta nos grupos</b></a>`,
    pend.leads && `<a class="item" href="#/lista/leads" style="text-decoration:none;color:inherit"><b>💬 ${pend.leads} pedido(s) novo(s) de anunciante</b></a>`,
  ].filter(Boolean).join('');
  return topo('Oi, Jaque! 💗', `<select id="dias" style="width:auto">${[7, 30, 90].map((d) => `<option value="${d}" ${d === dias ? 'selected' : ''}>${d} dias</option>`).join('')}</select>`) + `
  <div class="pcorpo">
    ${painelTarefas}
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
  // Achadinhos: filtro por loja (a busca diária traz até 20 de cada)
  const todos = a.data || [];
  const lojaSel = sessionStorage.getItem('f_loja_aprovar') || '';
  const lojas = [...new Set(todos.map((r) => r.loja || 'Outra'))].sort();
  const chips = todos.length ? `<div class="acoes" style="flex-wrap:wrap">${[['', `Todas (${todos.length})`], ...lojas.map((l) => [l, `${l} (${todos.filter((r) => (r.loja || 'Outra') === l).length})`])]
    .map(([v, t]) => `<button class="btn ${v === lojaSel ? '' : 'sec'} peq" data-loja="${esc(v)}">${esc(t)}</button>`).join('')}</div>` : '';
  const achados = lojaSel ? todos.filter((r) => (r.loja || 'Outra') === lojaSel) : todos;
  const linkBox = (r) => r.precisa_link ? `
      <div class="item" style="background:#FFF6EE;margin:.5rem 0">
        <p class="small"><b>Falta o link de afiliado.</b> 1) Toque em Abrir no app. 2) Na barra de afiliados, toque em Compartilhar e copie o link. 3) Cole aqui e salve.</p>
        <a class="btn sec peq" href="${esc(safeUrl(r.link_produto || r.link))}" target="_blank" rel="noopener">Abrir no app ↗</a>
        <input type="url" inputmode="url" placeholder="Cole aqui o link de afiliado" data-linkinput="${r.id}" style="width:100%;margin:.5rem 0">
        <button class="btn peq" data-salvarlink="${r.id}">Salvar link</button>
      </div>` : '';
  const bloco = (titulo, itens, ent, sim, nao, simTxt) => `<h2 class="titulo-sec">${titulo}</h2>` + (itens.length ? itens.map((r) => `
    <div class="item"><div class="linha">${r.imagem_url ? `<img class="miniatura" src="${esc(safeUrl(r.imagem_url))}" alt="">` : ''}<div style="flex:1"><h3>${esc(ENT[ent].titulo(r))}</h3><div class="small muted">${esc(ENT[ent].sub(r))}</div></div></div>
      ${r.descricao ? `<p class="small">${esc(r.descricao)}</p>` : ''}${r.roteiro ? `<p class="small">${esc(r.roteiro)}</p>` : ''}
      ${r.indicado_por ? `<p class="small muted">Indicado por ${esc(r.indicado_por)}${r.contato_indicacao ? ' · ' + esc(r.contato_indicacao) : ''}</p>` : ''}
      ${ent === 'achadinhos' && (r.nota || r.vendas) ? `<p class="small muted">${r.nota ? '⭐ ' + esc(r.nota) : ''}${r.vendas ? ' · ' + esc(r.vendas) + ' vendidos' : ''}${r.preco_antigo ? ' · antes ' + esc(brl(r.preco_antigo)) : ''}</p>` : ''}
      ${r.link && ent === 'achadinhos' && !r.precisa_link ? `<a class="small" href="${esc(safeUrl(r.link))}" target="_blank" rel="noopener">Abrir oferta ↗</a>` : ''}
      ${ent === 'achadinhos' ? linkBox(r) : ''}
      <div class="acoes"><button class="btn verde peq" data-acao="${ent}|${r.id}|${sim}" ${ent === 'achadinhos' && r.precisa_link ? 'disabled title="Cole o link de afiliado primeiro"' : ''}>${simTxt}</button><a class="btn sec peq" href="#/editar/${ent}/${r.id}">Editar</a><button class="btn perigo peq" data-acao="${ent}|${r.id}|${nao}">Descartar</button></div>
    </div>`).join('') : '<p class="muted small">Nada pendente.</p>');
  setTimeout(() => {
    const fN = $('#fNorte');
    if (fN) fN.addEventListener('submit', async (e) => {
      e.preventDefault();
      const assunto = fN.elements.assunto.value.trim();
      const extras = fN.elements.palavras.value.split(',').map((x) => x.trim()).filter(Boolean);
      if (!assunto) return;
      const palavras = [assunto, ...extras.filter((x) => x.toLowerCase() !== assunto.toLowerCase())].join(', ');
      const fim = new Date(Date.now() - 3 * 3600e3 + 14 * 864e5).toISOString().slice(0, 10);
      const { data: novo, error } = await sb.from('temas').insert({ nome: assunto, emoji: '🎯', palavras, inicio: hoje(), fim, meta_semana: 5, publicado: false }).select().single();
      if (error) return toast('Não deu: ' + error.message);
      TEMAS.push(novo);
      toast('Pedido anotado ✔ Entra na próxima busca do robô.'); rota();
    });
    $$('[data-loja]').forEach((b) => b.addEventListener('click', () => { sessionStorage.setItem('f_loja_aprovar', b.dataset.loja); rota(); }));
    $$('[data-salvarlink]').forEach((b) => b.addEventListener('click', async () => {
      const id = b.dataset.salvarlink;
      const v = ($(`[data-linkinput="${id}"]`).value || '').trim();
      const m = v.match(/https?:\/\/\S+/);
      if (!m) return toast('Cole o link que começa com https://');
      b.disabled = true;
      const { error } = await sb.from('achadinhos').update({ link: m[0], precisa_link: false }).eq('id', id);
      if (error) { b.disabled = false; return toast('Não salvou: ' + error.message); }
      toast('Link salvo ✔ Agora é só publicar.'); rota();
    }));
  });
  setTimeout(() => $$('[data-acao]').forEach((b) => b.addEventListener('click', async () => {
    const [ent, id, st] = b.dataset.acao.split('|');
    const upd = { status: st }; if (ent === 'achadinhos' && st === 'publicado') upd.publicado_em = new Date().toISOString();
    b.disabled = true;
    const { error } = await sb.from(ent).update(upd).eq('id', id);
    if (error) { b.disabled = false; return toast('Não deu: ' + error.message); }
    toast(st === 'descartado' || st === 'arquivado' ? 'Descartado' : 'Aprovado! 💗');
    if (ent === 'achadinhos' && st === 'publicado') {
      const { data: sit } = await sb.rpc('situacao_robo_whats');
      if (sit && sit.envio_ligado) toast('Aprovado! O robô posta no grupo 💗');
      else if (confirm('Publicado no site! Quer enviar agora no WhatsApp?')) await window.__enviarWhats(id);
    }
    rota();
  })));
  const especiais = TEMAS.filter((t) => t.emoji === '🎯' && temaAtivo(t));
  const norte = `<form id="fNorte" class="item"><h3>🎯 Busca especial</h3>
      <p class="small muted">Escreva um assunto (ex.: cabelo maluco, dia do amigo, festa junina). O robô procura ofertas disso nas próximas 2 semanas, além das categorias fixas.</p>
      <input name="assunto" placeholder="Ex.: cabelo maluco" maxlength="60" required style="width:100%;margin:.5rem 0">
      <input name="palavras" placeholder="Palavras extras, separadas por vírgula (opcional)" maxlength="300" style="width:100%;margin-bottom:.5rem">
      <button class="btn peq">Pedir busca</button>
      ${especiais.length ? `<p class="small" style="margin-top:.5rem">Buscando agora: ${especiais.map((t) => `${esc(t.nome)} (até ${esc(dataBR(t.fim))})`).join(', ')}</p>` : ''}
    </form>`;
  return topo('Aprovar') + `<div class="pcorpo">
    ${norte}${chips}${bloco('🎁 Achadinhos', achados, 'achadinhos', 'publicado', 'descartado', 'Publicar no site')}
    ${bloco('📒 Indicações para o Guia', n.data || [], 'negocios', 'aprovado', 'arquivado', 'Aprovar')}
    ${bloco('🎬 Ideias de vídeo', v.data || [], 'conteudos', 'aprovado', 'descartado', 'Aprovar ideia')}
  </div>`;
}

function telaConteudo() {
  return topo('Conteúdo') + `<div class="pcorpo">${['ideias', 'emails_liga', 'temas', 'achadinhos', 'negocios', 'episodios', 'eventos', 'conteudos', 'lancamentos'].map((k) => `
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
  if (tipo === 'textarea') h = `<textarea name="${k}" placeholder="${esc(o.ph || '')}" ${req}>${esc(val)}</textarea>`;
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
    $('#verChave').addEventListener('click', async () => {
      const { data: k, error } = await sb.rpc('chave_robo_emails');
      if (error || !k) return toast('Não deu para pegar a chave');
      $('#chave').textContent = k; $('#chave').hidden = false;
      try { await navigator.clipboard.writeText(k); toast('Chave copiada ✔'); } catch { toast('Toque e segure na chave para copiar'); }
    });
    $('#btnSair').addEventListener('click', async () => { await sb.auth.signOut(); rota(); });
  });
  return topo('Ajustes') + `<div class="pcorpo">
    <form id="fAjustes" class="item"><h3>Site</h3>${campos.map((cp) => inputCampo(cp, c[cp[0]])).join('')}<button class="btn">Salvar ajustes</button></form>
    <div class="item"><h3>📬 Robô de e-mails</h3><p class="small muted" style="margin:0">Chave para colar no robô do Gmail da Liga (propriedade CHAVE_LIGA). Não mande essa chave por WhatsApp nem no chat.</p>
      <div class="acoes"><button class="btn sec peq" id="verChave" type="button">Mostrar e copiar a chave</button></div><code id="chave" hidden style="word-break:break-all;font-size:.85rem"></code></div>
    <form id="fSenha" class="item"><h3>Trocar minha senha</h3><div class="campo"><input name="nova" type="password" autocomplete="new-password" placeholder="Nova senha (mín. 8)"></div><button class="btn sec">Trocar senha</button></form>
    <button class="btn perigo" id="btnSair">Sair do painel</button>
  </div>`;
}

/* ---------- Resumo dos grupos (robô do WhatsApp, só leitura) ---------- */
const ACOES_ROBO = 'https://github.com/Jaque-Ligadasmamaes/liga-das-mamaes/actions/workflows/robo-whatsapp.yml';
const horaBR = (d) => d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
const AVISO_GRUPO = 'Oi, mamães! 💗 Para a gente não perder nenhum pedido de indicação na correria, a Liga agora tem uma *assistente de resumo* (o número "Liga · Resumos"). Neste grupo ela só lê, nunca manda mensagem, não guarda fotos nem áudios e apaga o texto em 3 dias. Serve só para a Jaque ver rapidinho o que ficou sem resposta. Qualquer dúvida, é só me chamar!';
async function telaGrupos() {
  const [{ data: grupos }, { data: pend }, { data: resumos }, { data: sit }] = await Promise.all([
    sb.from('wa_grupos').select('*').order('nome'),
    sb.from('wa_pendencias').select('*').eq('status', 'aberta').order('enviada_em', { ascending: false }).limit(40),
    sb.from('wa_resumos').select('*').order('criado_em', { ascending: false }).limit(60),
    sb.rpc('situacao_robo_whats'),
  ]);
  const gs = grupos || []; const ativos = gs.filter((g) => g.ativo);
  const nomeGrupo = (jid) => (gs.find((g) => g.jid === jid) || {}).nome || 'Grupo';
  const rs = resumos || [];
  setTimeout(() => {
    $$('[data-pend]').forEach((b) => b.addEventListener('click', async () => {
      const [id, st] = b.dataset.pend.split('|'); b.disabled = true;
      const { error } = await sb.from('wa_pendencias').update({ status: st, resolvida_em: new Date().toISOString() }).eq('id', id);
      if (error) { b.disabled = false; return toast('Não deu: ' + error.message); }
      toast(st === 'resolvida' ? 'Respondido ✔' : 'Tirei da lista'); rota();
    }));
    $$('[data-grupo]').forEach((c) => c.addEventListener('change', async () => {
      const { error } = await sb.from('wa_grupos').update({ ativo: c.checked }).eq('jid', c.dataset.grupo);
      toast(error ? 'Não salvou: ' + error.message : c.checked ? 'O robô vai ler este grupo a partir da próxima rodada' : 'O robô parou de ler este grupo');
    }));
    const fn = $('#fNumero'); if (fn) fn.addEventListener('submit', async (e) => {
      e.preventDefault(); const n = fn.elements.numero.value.replace(/\D/g, '');
      if (n.length < 12) return toast('Coloque 55 + DDD + número, ex.: 5511987654321');
      const { error } = await sb.rpc('numero_robo_whats', { numero: n });
      toast(error ? 'Não salvou: ' + error.message : 'Número do chip salvo ✔'); if (!error) rota();
    });
    const fE = $('#fEnvio'); if (fE) fE.addEventListener('submit', async (e) => {
      e.preventDefault();
      const grupo = fE.elements.grupo.value; const ligado = fE.elements.ligado.checked;
      if (ligado && !grupo) return toast('Escolha o grupo primeiro.');
      const { error } = await sb.rpc('configurar_envio_whats', { grupo, ligado });
      toast(error ? 'Não salvou: ' + error.message : ligado ? 'Envio automático ligado ✔' : 'Envio automático desligado'); if (!error) rota();
    });
    const bp = $('#pausar'); if (bp) bp.addEventListener('click', async () => {
      const { error } = await sb.rpc('pausar_robo_whats', { pausar: !sit?.pausado });
      toast(error ? 'Não deu: ' + error.message : sit?.pausado ? 'Robô ligado de novo ✔' : 'Robô pausado. Ele não lê nada até você ligar de novo.'); rota();
    });
    const bc = $('#verChaveWhats'); if (bc) bc.addEventListener('click', async () => {
      const { data: k, error } = await sb.rpc('chave_robo_whats');
      if (error || !k) return toast('Não deu para pegar a chave');
      $('#chaveWhats').textContent = k; $('#chaveWhats').hidden = false;
      try { await navigator.clipboard.writeText(k); toast('Chave copiada ✔'); } catch { toast('Toque e segure na chave para copiar'); }
    });
    const ba = $('#copiarAviso'); if (ba) ba.addEventListener('click', async () => {
      try { if (navigator.share) { await navigator.share({ text: AVISO_GRUPO }); return; } } catch (e) { if (e.name === 'AbortError') return; }
      try { await navigator.clipboard.writeText(AVISO_GRUPO); toast('Aviso copiado! Cole no grupo.'); } catch { prompt('Copie o aviso:', AVISO_GRUPO); }
    });
    $$('[data-visto]').forEach((b) => b.addEventListener('click', async () => {
      await sb.from('wa_resumos').update({ visto: true }).eq('id', b.dataset.visto); rota();
    }));
  });
  const cartaoPend = (p) => `<div class="item"><div class="small muted">${esc(p.autor || 'Alguém')} · ${esc(nomeGrupo(p.grupo_jid))} · ${horaBR(p.enviada_em)}</div>
    <div>${esc(p.texto)}</div>
    <div class="acoes"><button class="btn verde peq" data-pend="${p.id}|resolvida">Já foi respondido ✔</button><button class="btn sec peq" data-pend="${p.id}|ignorada">Não é pedido</button></div></div>`;
  const cartaoResumo = (jid) => {
    const doGrupo = rs.filter((r) => r.grupo_jid === jid);
    const ultimo = doGrupo.find((r) => r.fonte === 'claude') || doGrupo[0];
    const robo = doGrupo.find((r) => r.fonte === 'robo');
    const antigos = doGrupo.filter((r) => r.fonte === 'claude' && r !== ultimo).slice(0, 6);
    return `<div class="item"><div class="linha"><h3>👥 ${esc(nomeGrupo(jid))}</h3>${ultimo && !ultimo.visto ? '<span class="selo-novo">novo</span>' : ''}</div>
      ${ultimo ? `<div class="small muted">${ultimo.de ? `${horaBR(ultimo.de)} até ${horaBR(ultimo.ate)}` : horaBR(ultimo.criado_em)}${ultimo.total ? ` · ${ultimo.total} mensagens de ${ultimo.pessoas} pessoas` : ''}</div>
        ${ultimo.atencao ? `<div class="atencao">👉 ${esc(ultimo.atencao)}</div>` : ''}
        ${ultimo.resumo ? `<div class="resposta">${esc(ultimo.resumo)}</div>` : ''}
        ${ultimo.assuntos ? `<div class="small"><b>Assuntos:</b><br>${esc(ultimo.assuntos).replace(/\n/g, '<br>')}</div>` : ''}
        ${ultimo.fonte === 'robo' ? '<div class="small muted">⏳ O resumo completo chega na próxima rodada do Claude (7h e 19h).</div>' : robo && robo.criado_em > ultimo.criado_em ? `<div class="small muted">Depois deste resumo: ${esc(robo.resumo)}</div>` : ''}
        <div class="acoes">${!ultimo.visto ? `<button class="btn sec peq" data-visto="${ultimo.id}">Já li ✔</button>` : ''}</div>
        ${antigos.length ? `<details><summary class="small"><b>Resumos anteriores</b></summary>${antigos.map((r) => `<div class="small" style="margin-top:8px"><b>${horaBR(r.criado_em)}</b>${r.atencao ? `<br>👉 ${esc(r.atencao)}` : ''}<div style="white-space:pre-wrap">${esc(r.resumo || '')}</div></div>`).join('')}</details>` : ''}`
      : '<div class="small muted">Ainda sem resumo. O robô lê às 5h e às 17h, e o Claude resume às 7h e às 19h.</div>'}</div>`;
  };
  const situacao = !sit ? '' : sit.pausado ? '⏸️ Pausado' : sit.conectado ? '🟢 Conectado ao chip' + (sit.numero_final ? ` (final ${esc(sit.numero_final)})` : '') : '⚪ Ainda não conectado ao chip';
  return topo('Grupos') + `<div class="pcorpo">
    <p class="small muted" style="margin:0">O robô só <b>lê</b> os grupos ativados (nunca manda mensagem) e o Claude resume 2x por dia: o que rolou, pedidos sem resposta e o que precisa de você.</p>
    ${(pend || []).length ? `<h2 class="titulo-sec">🙋 Pedidos sem resposta (${pend.length})</h2>${pend.map(cartaoPend).join('')}` : (ativos.length ? '<div class="item"><b>✨ Nenhum pedido sem resposta.</b></div>' : '')}
    ${ativos.length ? `<h2 class="titulo-sec">📝 Resumos</h2>${ativos.map((g) => cartaoResumo(g.jid)).join('')}` : ''}
    <h2 class="titulo-sec">⚙️ Robô</h2>
    <div class="item"><div class="linha"><b>${situacao}</b><button class="btn sec peq" id="pausar" type="button">${sit?.pausado ? 'Ligar' : 'Pausar'}</button></div>
      ${sit?.ultima_execucao ? `<div class="small muted">Última rodada: ${horaBR(sit.ultima_execucao)} · ${esc(sit.ultimo_status || '')}</div>` : ''}</div>
    ${sit && 'envio_ligado' in sit ? `<details class="item" ${sit.envio_ligado ? '' : 'open'}><summary><b>📤 Envio automático dos achadinhos: ${sit.envio_ligado ? 'ligado' : 'desligado'}</b></summary>
      <p class="small muted">Quando ligado, todo achadinho aprovado entra na fila e o robô posta foto + legenda no grupo escolhido: das 8h às 21h, no mínimo 45 min entre posts e no máximo 5 por dia. O chip do robô precisa ser admin do grupo.</p>
      ${sit.envio_ligado ? `<p class="small">Na fila: <b>${sit.na_fila || 0}</b> · Postados hoje: <b>${sit.enviados_hoje || 0}</b> de 5</p>` : ''}
      <form id="fEnvio"><div class="campo"><label>Grupo onde o robô posta</label><select name="grupo"><option value="">—</option>${gs.map((g) => `<option value="${esc(g.jid)}" ${g.jid === sit.grupo_achadinhos ? 'selected' : ''}>${esc(g.nome || 'Grupo sem nome')}</option>`).join('')}</select></div>
        <label class="check"><input type="checkbox" name="ligado" ${sit.envio_ligado ? 'checked' : ''}> Ligar o envio automático</label>
        <button class="btn sec peq" style="margin-top:8px">Salvar</button></form></details>` : ''}
    <details class="item" ${gs.length ? '' : 'open'}><summary><b>👥 Quais grupos o robô lê (${ativos.length} de ${gs.length})</b></summary>
      ${gs.length ? `<p class="small muted">Comece com um grupo só por umas semanas. O robô só enxerga grupos em que o chip dele foi adicionado.</p>${gs.map((g) => `<label class="linha" style="align-items:center;padding:6px 0"><span>${esc(g.nome || 'Grupo sem nome')}${g.participantes ? ` <span class="small muted">· ${g.participantes} pessoas</span>` : ''}</span><input type="checkbox" data-grupo="${esc(g.jid)}" ${g.ativo ? 'checked' : ''} style="width:24px;height:24px"></label>`).join('')}`
        : '<p class="small muted">A lista aparece depois que o chip for conectado e adicionado aos grupos.</p>'}</details>
    <details class="item"><summary><b>📣 Aviso para o grupo</b></summary><div class="resposta">${esc(AVISO_GRUPO)}</div>
      <p class="small muted">Mande do seu número (não do robô) quando adicionar o chip no grupo.</p><div class="acoes"><button class="btn peq" id="copiarAviso" type="button">Copiar aviso</button></div></details>
    <details class="item"><summary><b>🔧 Configurar o robô (Cecells)</b></summary>
      <form id="fNumero"><div class="campo"><label>Número do chip do robô</label><input name="numero" inputmode="numeric" placeholder="55 11 98765-4321" value=""></div>
        ${sit?.tem_numero ? `<p class="small muted">Já cadastrado: final ${esc(sit.numero_final || '')}</p>` : ''}<button class="btn sec peq">Salvar número</button></form>
      <p class="small muted">Chave para o segredo <b>ROBO_WHATS_CHAVE</b> no GitHub. Não mande por WhatsApp nem no chat.</p>
      <div class="acoes"><button class="btn sec peq" id="verChaveWhats" type="button">Mostrar e copiar a chave</button><a class="btn sec peq" target="_blank" rel="noopener" href="${ACOES_ROBO}">Abrir o robô no GitHub ↗</a></div>
      <code id="chaveWhats" hidden style="word-break:break-all;font-size:.85rem"></code></details>
  </div>`;
}

/* ---------- Equipe de agentes ---------- */
async function carregarAgentes() {
  if (AGENTES.length) return AGENTES;
  const { data } = await sb.from('agentes').select('*').order('ordem');
  AGENTES = data || []; return AGENTES;
}
const blocoTexto = (t) => `<div class="small" style="white-space:pre-wrap">${esc(t || '')}</div>`;
function cartaoPergunta(r, mostrarAgente) {
  return `<div class="item">${mostrarAgente ? `<div class="small muted">${esc(nomeAgente(r.agente))} · ${dataBR(r.criado_em)}</div>` : `<div class="small muted">${dataBR(r.criado_em)}</div>`}
    <b>${esc(r.pergunta)}</b>
    ${r.resposta ? `<div class="resposta">${esc(r.resposta)}</div>` : '<div class="small muted">⏳ Na fila. A resposta chega na próxima rodada da equipe.</div>'}</div>`;
}
function formPergunta(slugFixo) {
  setTimeout(() => { const f = $('#fPergunta'); if (f) f.addEventListener('submit', async (e) => {
    e.preventDefault(); const pergunta = f.elements.pergunta.value.trim(); if (!pergunta) return;
    const agente = slugFixo || f.elements.agente.value;
    f.querySelector('button').disabled = true;
    const { error } = await sb.from('perguntas_agentes').insert({ agente, pergunta });
    if (error) { f.querySelector('button').disabled = false; return toast('Não enviou: ' + error.message); }
    toast('Pergunta enviada 💗'); rota();
  }); });
  return `<form class="item" id="fPergunta"><h3>💬 ${slugFixo ? 'Perguntar para ' + esc(nomeAgente(slugFixo)) : 'Perguntar para a equipe'}</h3>
    ${slugFixo ? '' : `<select name="agente">${AGENTES.map((a) => `<option value="${esc(a.slug)}">${esc(a.emoji)} ${esc(a.nome)}${a.slug === 'triagem' ? ' (não sei quem)' : ''}</option>`).join('')}</select>`}
    <textarea name="pergunta" required placeholder="Toque no 🎤 e fale. Ex.: quais os próximos passos para a Feira de dezembro?"></textarea>
    <div class="acoes"><button class="btn peq">Enviar pergunta</button></div></form>`;
}
async function telaEquipe() {
  await carregarAgentes();
  const { data: pergs } = await sb.from('perguntas_agentes').select('*').neq('status', 'arquivada').order('criado_em', { ascending: false }).limit(15);
  const fila = (slug) => (pergs || []).filter((p) => p.agente === slug && p.status === 'aguardando').length;
  return topo('Sua equipe') + `<div class="pcorpo">
    <p class="small muted" style="margin:0">Cada agente cuida de uma parte da Liga. Toque num agente para ver os próximos passos ou pergunte direto.</p>
    ${formPergunta()}
    <div class="agentes">${AGENTES.map((a) => `<a class="item agente" href="#/equipe/${esc(a.slug)}"><span class="emo">${esc(a.emoji)}</span><b>${esc(a.nome)}</b><span class="small muted">${esc(a.missao)}</span>${fila(a.slug) ? `<i>${fila(a.slug)} na fila</i>` : ''}</a>`).join('') || '<div class="vazio">A equipe ainda não foi carregada.</div>'}</div>
    ${(pergs || []).length ? `<h2 class="titulo-sec">Conversas recentes</h2>${pergs.map((r) => cartaoPergunta(r, true)).join('')}` : ''}
  </div>`;
}
async function telaAgente(slug) {
  await carregarAgentes();
  const a = AGENTES.find((x) => x.slug === slug); if (!a) return telaEquipe();
  const [{ data: pergs }, { data: ideias }] = await Promise.all([
    sb.from('perguntas_agentes').select('*').eq('agente', slug).neq('status', 'arquivada').order('criado_em', { ascending: false }).limit(20),
    sb.from('ideias').select('*').eq('agente', slug).in('status', ['desenvolvida', 'virou_acao']).order('criado_em', { ascending: false }).limit(10),
  ]);
  setTimeout(() => { const b = $('#copiarInstr'); if (b) b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(a.instrucoes || ''); toast('Instruções copiadas ✔'); } catch { toast('Não deu para copiar'); }
  }); });
  return topo(`${esc(a.emoji)} ${esc(a.nome)}`) + `<div class="pcorpo">
    <a class="voltar" href="#/equipe">‹ Equipe</a>
    <p style="margin:0">${esc(a.missao)}</p>
    <div class="item"><h3>👣 Próximos passos</h3>${blocoTexto(a.proximos_passos || 'Ainda sem próximos passos.')}<div class="small muted">Atualizado em ${dataBR(a.atualizado_em)}</div></div>
    ${formPergunta(slug)}
    ${(ideias || []).length ? `<h2 class="titulo-sec">Ideias com este agente</h2>${ideias.map((i) => `<a class="item" href="#/editar/ideias/${i.id}" style="text-decoration:none;color:inherit"><b>💡 ${esc(i.texto.length > 90 ? i.texto.slice(0, 90) + '…' : i.texto)}</b></a>`).join('')}` : ''}
    ${(pergs || []).length ? `<h2 class="titulo-sec">Conversas</h2>${pergs.map((r) => cartaoPergunta(r, false)).join('')}` : ''}
    <details class="item"><summary><b>📋 Como este agente trabalha</b></summary>${blocoTexto(a.instrucoes)}
      <p class="small muted">Quando você tiver o seu próprio Claude, copie isto para um Projeto e converse ao vivo.</p>
      <div class="acoes"><button class="btn sec peq" id="copiarInstr" type="button">Copiar instruções</button></div></details>
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
  if ((aba === 'lista' && partes[1] === 'ideias') || aba === 'editar') await carregarAgentes();
  $$('#abas a').forEach((a) => a.classList.toggle('ativo', a.dataset.aba === (aba === 'lista' && partes[1] === 'leads' ? 'leads' : aba === 'lista' || aba === 'editar' ? 'conteudo' : aba)));
  app.innerHTML = '<div class="carregando">Carregando…</div>';
  try {
    app.innerHTML = await ({
      inicio: telaInicio, aprovar: telaAprovar, grupos: telaGrupos, equipe: () => (partes[1] ? telaAgente(partes[1]) : telaEquipe()), conteudo: telaConteudo, ajustes: telaAjustes,
      lista: () => telaLista(partes[1]), editar: () => telaEditar(partes[1], partes[2]),
    }[aba] || telaInicio)();
  } catch (e) { console.error(e); app.innerHTML = `<div class="pcorpo"><div class="vazio">Algo deu errado: ${esc(e.message)}</div></div>`; }
  window.scrollTo(0, 0);
  const d = $('#dias'); if (d) d.addEventListener('change', () => { sessionStorage.setItem('dias', d.value); rota(); });
}
window.addEventListener('hashchange', rota);
rota();
