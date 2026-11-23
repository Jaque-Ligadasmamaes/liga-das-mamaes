import { sb, esc, $, $$, brl, dataLonga, safeUrl, waLink, instaLink, toast } from './lib.js';
import { CATEGORIAS, CIDADES } from './config.js';

const app = $('#app');
let CFG = {};
let TEMAS = [];
const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const temaAtivo = (t) => (!t.inicio || t.inicio <= hoje()) && (!t.fim || t.fim >= hoje());
const temaDe = (id) => TEMAS.find((t) => t.id === id);

/* ---------- Métricas (sem dados pessoais) ---------- */
const vistos = new Set();
function registrar(tipo, alvo, ref_id = null) {
  if (tipo === 'visita') { if (vistos.has(alvo)) return; vistos.add(alvo); }
  sb.from('metricas').insert({ tipo, alvo, ref_id }).then(() => {});
}
// Qualquer link com data-clique registra o clique antes de abrir
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-clique]');
  if (a) registrar('clique', a.dataset.clique, a.dataset.ref || null);
});

/* ---------- Menu ---------- */
$('#btnMenu').addEventListener('click', () => {
  const m = $('#menu'); const ab = m.classList.toggle('aberto');
  $('#btnMenu').setAttribute('aria-expanded', ab);
});

async function carregarConfig() {
  const [{ data }, temas] = await Promise.all([sb.from('config').select('chave, valor'), sb.from('temas').select('*').order('inicio', { ascending: true, nullsFirst: false })]);
  TEMAS = temas.data || [];
  CFG = Object.fromEntries((data || []).map((r) => [r.chave, r.valor || '']));
  if (CFG.logo_url) $('#selo').innerHTML = `<img src="${esc(safeUrl(CFG.logo_url))}" alt="">`;
  const links = [];
  if (CFG.instagram) links.push(`<a href="${esc(instaLink(CFG.instagram))}" target="_blank" rel="noopener" data-clique="instagram">Instagram</a>`);
  if (CFG.whatsapp_contato) links.push(`<a href="${esc(waLink(CFG.whatsapp_contato, 'Oi! Vim pelo site da Liga das Mamães.'))}" target="_blank" rel="noopener" data-clique="contato">Fale com a gente</a>`);
  links.push('<a href="#/anuncie">Anuncie na Liga</a>');
  $('#rodapeLinks').innerHTML = links.join(' · ');
}

/* ---------- Componentes ---------- */
function cartaoNegocio(n) {
  const tags = [`<span class="tag cinza">${esc(n.categoria)}</span>`];
  if (n.cidade) tags.push(`<span class="tag cinza">${esc(n.cidade)}</span>`);
  if (n.plano !== 'gratis') tags.unshift('<span class="tag ouro">★ Parceira da Liga</span>');
  if (n.de_mae) tags.push('<span class="tag">Negócio de mãe</span>');
  const botoes = [];
  const zap = waLink(n.whatsapp, `Oi! Vi seu contato no Guia da Liga das Mamães.`);
  if (zap) botoes.push(`<a class="btn zap peq" href="${esc(zap)}" target="_blank" rel="noopener" data-clique="negocio_whatsapp" data-ref="${n.id}">WhatsApp</a>`);
  if (n.instagram) botoes.push(`<a class="btn sec peq" href="${esc(instaLink(n.instagram))}" target="_blank" rel="noopener" data-clique="negocio_instagram" data-ref="${n.id}">Instagram</a>`);
  if (n.site) botoes.push(`<a class="btn sec peq" href="${esc(safeUrl(n.site))}" target="_blank" rel="noopener" data-clique="negocio_site" data-ref="${n.id}">Site</a>`);
  return `<article class="cartao ${n.plano === 'destaque' ? 'destaque' : ''}">
    ${n.foto_url ? `<img class="capa" src="${esc(safeUrl(n.foto_url))}" alt="" loading="lazy">` : ''}
    <div class="tags">${tags.join('')}</div>
    <h3>${esc(n.nome)}</h3>
    ${n.descricao ? `<p class="muted">${esc(n.descricao)}</p>` : ''}
    ${n.endereco ? `<p class="small muted">📍 ${esc(n.endereco)}</p>` : ''}
    <div class="rodape">${botoes.join('')}</div>
  </article>`;
}

function cartaoOferta(o) {
  return `<article class="cartao oferta">
    ${o.imagem_url ? `<img class="capa" src="${esc(safeUrl(o.imagem_url))}" alt="" loading="lazy">` : ''}
    <div class="tags">${temaDe(o.tema_id) ? `<span class="tag">${esc(temaDe(o.tema_id).emoji || '')} ${esc(temaDe(o.tema_id).nome)}</span>` : ''}${o.loja ? `<span class="tag cinza">${esc(o.loja)}</span>` : ''}${o.cupom ? `<span class="tag ouro">Cupom ${esc(o.cupom)}</span>` : ''}</div>
    <h3>${esc(o.titulo)}</h3>
    ${o.descricao ? `<p class="muted small">${esc(o.descricao)}</p>` : ''}
    <div>${o.preco ? `<span class="preco">${brl(o.preco)}</span>` : ''}${o.preco_antigo ? `<span class="antigo">${brl(o.preco_antigo)}</span>` : ''}</div>
    <div class="rodape"><a class="btn peq" href="${esc(safeUrl(o.link))}" target="_blank" rel="sponsored noopener" data-clique="achadinho" data-ref="${o.id}">Ver oferta</a></div>
  </article>`;
}

function cartaoEpisodio(ep) {
  return `<article class="cartao">
    ${ep.capa_url ? `<img class="capa" src="${esc(safeUrl(ep.capa_url))}" alt="" loading="lazy">` : ''}
    <div class="tags"><span class="tag">☕ Episódio ${esc(ep.numero ?? '')}</span>${ep.data ? `<span class="tag cinza">${esc(new Date(ep.data + 'T12:00').toLocaleDateString('pt-BR'))}</span>` : ''}</div>
    <h3>${esc(ep.titulo)}</h3>
    ${ep.convidada ? `<p class="small"><b>Com ${esc(ep.convidada)}</b></p>` : ''}
    ${ep.resumo ? `<p class="muted">${esc(ep.resumo)}</p>` : ''}
    <div class="rodape">${ep.link ? `<a class="btn peq" href="${esc(safeUrl(ep.link))}" target="_blank" rel="noopener" data-clique="episodio" data-ref="${ep.id}">Assistir</a>` : ''}</div>
  </article>`;
}

function cartaoEvento(ev) {
  const icone = ev.tipo === 'feira' ? '🛍️' : ev.tipo === 'role' ? '🎈' : '📌';
  return `<article class="cartao">
    ${ev.capa_url ? `<img class="capa" src="${esc(safeUrl(ev.capa_url))}" alt="" loading="lazy">` : ''}
    <div class="icone">${icone}</div>
    <h3>${esc(ev.titulo)}</h3>
    <p class="small"><b>${esc(dataLonga(ev.data))}${ev.hora ? ' · ' + esc(ev.hora) : ''}</b>${ev.local ? `<br>📍 ${esc(ev.local)}` : ''}</p>
    ${ev.descricao ? `<p class="muted">${esc(ev.descricao)}</p>` : ''}
    <div class="rodape">
      ${ev.link ? `<a class="btn peq" href="${esc(safeUrl(ev.link))}" target="_blank" rel="noopener" data-clique="evento" data-ref="${ev.id}">Saiba mais</a>` : ''}
      ${ev.tipo === 'feira' ? '<a class="btn sec peq" href="#/anuncie?tipo=feira">Quero expor</a>' : ''}
    </div>
  </article>`;
}

const vazio = (txt) => `<div class="vazio">${txt}</div>`;
const btnEntrar = (classe = '') => CFG.link_comunidade
  ? `<a class="btn zap ${classe}" href="${esc(safeUrl(CFG.link_comunidade))}" target="_blank" rel="noopener" data-clique="entrar_comunidade">Entrar na comunidade</a>`
  : `<a class="btn zap ${classe}" href="#/entrar">Entrar na comunidade</a>`;

function chipsTemas(atual) {
  const ativos = TEMAS.filter(temaAtivo);
  if (!ativos.length) return '';
  return `<div class="chips" style="margin-bottom:16px"><a class="chip ${!atual ? 'on' : ''}" href="#/achadinhos" style="text-decoration:none">Todos</a>${ativos.map((t) => `<a class="chip ${atual === t.id ? 'on' : ''}" href="#/achadinhos?tema=${t.id}" style="text-decoration:none">${esc(t.emoji || '')} ${esc(t.nome)}</a>`).join('')}</div>`;
}

/* ---------- Páginas ---------- */
const paginas = {
  async inicio() {
    const [ofertas, eventos, eps] = await Promise.all([
      sb.from('achadinhos').select('*').eq('status', 'publicado').order('publicado_em', { ascending: false }).limit(6),
      sb.from('eventos').select('*').eq('publicado', true).order('data', { ascending: true, nullsFirst: false }).limit(3),
      sb.from('episodios').select('*').eq('publicado', true).order('data', { ascending: false }).limit(3),
    ]);
    return `
    <section class="hero"><div class="wrap">
      <div>
        <span class="chapeu">Atibaia e região · mães de crianças de 0 a 6</span>
        <h1>Nenhuma mãe precisa <em>dar conta sozinha.</em></h1>
        <p class="muted">${esc(CFG.texto_hero)}</p>
        <div class="acoes">${btnEntrar()}<a class="btn sec" href="#/guia">Ver o Guia da Liga</a></div>
      </div>
      <div class="hero-arte"><div><b>370+</b>mães se ajudando todos os dias</div></div>
    </div></section>

    <section class="bloco"><div class="wrap">
      <div class="grade">
        <a class="cartao link" href="#/guia"><span class="icone">📒</span><h3>Guia da Liga</h3><p class="muted">Escolas, pediatras, convênios e serviços indicados por mães de verdade.</p></a>
        <a class="cartao link" href="#/cafe"><span class="icone">☕</span><h3>Café com a Liga</h3><p class="muted">Conversas curtinhas com mães empreendedoras da nossa região.</p></a>
        <a class="cartao link" href="#/agenda"><span class="icone">🛍️</span><h3>Feira e encontros</h3><p class="muted">A Feira da Liga, os Rolês e tudo que vai rolar.</p></a>
        <a class="cartao link" href="#/achadinhos"><span class="icone">🎁</span><h3>Achadinhos</h3><p class="muted">Ofertas que a gente recomendaria para uma amiga.</p></a>
      </div>
    </div></section>

    ${(eventos.data || []).length ? `<section class="bloco"><div class="wrap">
      <div class="cab-secao"><h2>Vem aí</h2><a href="#/agenda">Ver agenda</a></div>
      <div class="grade">${eventos.data.map(cartaoEvento).join('')}</div>
    </div></section>` : ''}

    ${(eps.data || []).length ? `<section class="bloco"><div class="wrap">
      <div class="cab-secao"><h2>Café com a Liga</h2><a href="#/cafe">Todos os episódios</a></div>
      <div class="grade">${eps.data.map(cartaoEpisodio).join('')}</div>
    </div></section>` : ''}

    ${(ofertas.data || []).length ? `<section class="bloco"><div class="wrap">
      <div class="cab-secao"><h2>Achadinhos da vez</h2><a href="#/achadinhos">Ver todos</a></div>
      ${chipsTemas('')}
      <div class="grade">${ofertas.data.map(cartaoOferta).join('')}</div>
    </div></section>` : ''}

    <section class="bloco"><div class="wrap">
      <div class="faixa">
        <div><h2>Tem um negócio que atende mães?</h2><p>Apareça no Guia da Liga para centenas de famílias de Atibaia e região.</p></div>
        <a class="btn" href="#/anuncie">Quero anunciar</a>
      </div>
    </div></section>`;
  },

  async guia(params) {
    const { data, error } = await sb.from('negocios').select('*').eq('status', 'aprovado');
    if (error) return vazio('Não conseguimos carregar o Guia agora. Tente de novo em instantes.');
    const peso = { destaque: 0, parceira: 1, gratis: 2 };
    const lista = (data || []).sort((a, b) => peso[a.plano] - peso[b.plano] || a.nome.localeCompare(b.nome, 'pt-BR'));
    const html = `
    <section class="bloco"><div class="wrap">
      <div class="cab-secao">
        <div><h1>Guia da Liga</h1><p class="muted">Indicações de confiança, feitas por mães da Liga.</p></div>
        <a class="btn sec" href="#/indicar">+ Indicar um negócio</a>
      </div>
      <div class="filtros">
        <input id="busca" type="search" placeholder="Buscar: pediatra, escola, bolo, fotógrafa…" value="${esc(params.get('q') || '')}">
        <div class="chips" id="chipsCat"><button class="chip on" data-cat="">Todas</button>${CATEGORIAS.map((c) => `<button class="chip" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
        <select id="cidade"><option value="">Todas as cidades</option>${CIDADES.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
      </div>
      <div class="grade" id="listaGuia"></div>
      <p class="small muted" style="margin-top:18px">As indicações são de mães da comunidade. Parceiras da Liga apoiam a comunidade e aparecem primeiro.</p>
    </div></section>`;
    setTimeout(() => {
      let cat = '';
      const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const desenhar = () => {
        const q = norm($('#busca').value); const cid = $('#cidade').value;
        const f = lista.filter((n) => (!cat || n.categoria === cat) && (!cid || n.cidade === cid) &&
          (!q || norm([n.nome, n.categoria, n.descricao, n.cidade].join(' ')).includes(q)));
        $('#listaGuia').innerHTML = f.length ? f.map(cartaoNegocio).join('')
          : vazio(lista.length ? 'Nada encontrado com esse filtro. Que tal <a href="#/indicar">indicar um negócio</a>?' : 'O Guia está começando agora! <a href="#/indicar">Indique o primeiro negócio</a> que você confia.');
      };
      $('#busca').addEventListener('input', desenhar);
      $('#cidade').addEventListener('change', desenhar);
      $('#chipsCat').addEventListener('click', (e) => {
        const b = e.target.closest('.chip'); if (!b) return;
        $$('.chip', $('#chipsCat')).forEach((x) => x.classList.toggle('on', x === b));
        cat = b.dataset.cat; desenhar();
      });
      desenhar();
    });
    return html;
  },

  async indicar() {
    setTimeout(() => {
      $('#formIndicar').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target));
        const btn = $('button[type=submit]', e.target); btn.disabled = true;
        const { error } = await sb.from('negocios').insert({
          nome: f.nome.trim(), categoria: f.categoria, cidade: f.cidade || null, descricao: f.descricao.trim() || null,
          whatsapp: f.whatsapp.trim() || null, instagram: f.instagram.trim() || null, de_mae: f.de_mae === 'on',
          indicado_por: f.indicado_por.trim() || null, contato_indicacao: f.contato_indicacao.trim() || null,
        });
        btn.disabled = false;
        if (error) { toast('Ops, não foi. Confira os campos e tente de novo.'); return; }
        e.target.reset();
        $('#formIndicar').outerHTML = `<div class="cartao"><h3>Obrigada! 💗</h3><p>Sua indicação foi enviada. A equipe da Liga confere e publica no Guia em breve.</p><a class="btn sec" href="#/guia">Voltar ao Guia</a></div>`;
      });
    });
    return `<section class="bloco"><div class="wrap">
      <h1>Indicar um negócio</h1>
      <p class="muted">Conhece um lugar ou profissional que fez diferença para a sua família? Conta pra gente. Pode ser o seu próprio negócio!</p>
      <form class="form" id="formIndicar">
        <div class="campo"><label>Nome do negócio ou profissional *</label><input name="nome" required minlength="2" maxlength="120"></div>
        <div class="campo"><label>Categoria *</label><select name="categoria" required><option value="">Escolha…</option>${CATEGORIAS.map((c) => `<option>${esc(c)}</option>`).join('')}</select></div>
        <div class="campo"><label>Cidade</label><select name="cidade"><option value="">Escolha…</option>${CIDADES.map((c) => `<option>${esc(c)}</option>`).join('')}</select></div>
        <div class="campo"><label>Por que você indica?</label><textarea name="descricao" maxlength="600" placeholder="Ex.: Pediatra super paciente, atende por convênio X, responde no WhatsApp."></textarea></div>
        <div class="campo"><label>WhatsApp do negócio</label><input name="whatsapp" inputmode="tel" maxlength="30" placeholder="(11) 9 9999-9999"></div>
        <div class="campo"><label>Instagram do negócio</label><input name="instagram" maxlength="80" placeholder="@perfil"></div>
        <div class="campo"><label class="check"><input type="checkbox" name="de_mae"> É um negócio de mãe</label></div>
        <div class="campo"><label>Seu nome (opcional)</label><input name="indicado_por" maxlength="80"></div>
        <div class="campo"><label>Seu WhatsApp (opcional, só para a equipe tirar dúvidas)</label><input name="contato_indicacao" inputmode="tel" maxlength="80"></div>
        <button class="btn" type="submit">Enviar indicação</button>
      </form>
    </div></section>`;
  },

  async cafe() {
    const { data } = await sb.from('episodios').select('*').eq('publicado', true).order('data', { ascending: false });
    return `<section class="bloco"><div class="wrap">
      <h1>☕ Café com a Liga</h1>
      <p class="muted">A Jaque visita negócios de mães da nossa região para um café e uma conversa de 5 a 10 minutos: como começaram, como conciliam com a maternidade e o que oferecem para a gente.</p>
      <div class="grade" style="margin-top:20px">${(data || []).length ? data.map(cartaoEpisodio).join('') : vazio('O primeiro episódio está sendo gravado. Volte em breve! ☕')}</div>
      <div class="faixa" style="margin-top:32px"><div><h2>Quer receber o Café?</h2><p>Mães empreendedoras da Liga podem se candidatar para um episódio.</p></div><a class="btn" href="#/anuncie?tipo=parceria">Quero participar</a></div>
    </div></section>`;
  },

  async agenda() {
    const { data } = await sb.from('eventos').select('*').eq('publicado', true).order('data', { ascending: true, nullsFirst: false });
    return `<section class="bloco"><div class="wrap">
      <h1>Agenda da Liga</h1>
      <p class="muted">Feira da Liga, Rolês e encontros para mães e crianças.</p>
      <div class="grade" style="margin-top:20px">${(data || []).length ? data.map(cartaoEvento).join('') : vazio('Nenhum encontro marcado agora. Fique de olho no grupo de Avisos!')}</div>
    </div></section>`;
  },

  async achadinhos(params) {
    const tema = params.get('tema') || '';
    let q = sb.from('achadinhos').select('*').eq('status', 'publicado').order('publicado_em', { ascending: false }).limit(60);
    if (tema) q = q.eq('tema_id', tema);
    const { data } = await q;
    const t = temaDe(tema);
    return `<section class="bloco"><div class="wrap">
      <h1>🎁 Achadinhos da Liga</h1>
      <p class="muted">Ofertas escolhidas a dedo, por tema: só entra o que a gente recomendaria para uma amiga.</p>
      ${chipsTemas(tema)}
      ${t ? `<h2>${esc(t.emoji || '')} ${esc(t.nome)}</h2>${t.descricao ? `<p class="muted">${esc(t.descricao)}</p>` : ''}` : ''}
      <p class="aviso">Alguns links são de afiliado: você paga o mesmo preço e a Liga recebe uma pequena comissão que ajuda a manter a comunidade. Preços e estoque podem mudar a qualquer momento.</p>
      <div class="grade" style="margin-top:20px">${(data || []).length ? data.map(cartaoOferta).join('') : vazio(t ? 'Os achadinhos desse tema estão chegando!' : 'Novos achadinhos chegam em breve!')}</div>
      ${CFG.link_canal ? `<p style="margin-top:24px"><a class="btn zap" href="${esc(safeUrl(CFG.link_canal))}" target="_blank" rel="noopener" data-clique="entrar_canal">Seguir o canal de Achadinhos no WhatsApp</a></p>` : ''}
    </div></section>`;
  },

  async anuncie(params) {
    const tipo = params.get('tipo') || 'anuncio';
    const p1 = CFG.preco_parceira || '30'; const p2 = CFG.preco_destaque || '50';
    setTimeout(() => {
      $('#formLead').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target));
        const btn = $('button[type=submit]', e.target); btn.disabled = true;
        const { error } = await sb.from('leads').insert({ nome: f.nome.trim(), negocio: f.negocio.trim() || null, whatsapp: f.whatsapp.trim(), plano: f.plano || null, tipo: f.tipo, mensagem: f.mensagem.trim() || null });
        btn.disabled = false;
        if (error) { toast('Ops, não foi. Confira o WhatsApp e tente de novo.'); return; }
        $('#formLead').outerHTML = `<div class="cartao"><h3>Recebemos! 💗</h3><p>A Jaque vai te chamar no WhatsApp para conversar.</p></div>`;
      });
    });
    return `<section class="bloco"><div class="wrap">
      <h1>Anuncie na Liga</h1>
      <p class="muted">A Liga reúne mais de 370 mães de Atibaia e região, com filhos de 0 a 6 anos, que pedem e trocam indicações todos os dias. Seu negócio pode ser a próxima indicação.</p>
      <div class="planos" style="margin:24px 0">
        <div class="cartao plano"><h3>Indicação</h3><div class="preco">Grátis</div><ul><li>Seu negócio no Guia da Liga</li><li>Botão direto para o seu WhatsApp</li><li>Precisa ser indicado e aprovado pela equipe</li></ul></div>
        <div class="cartao plano"><h3>Parceira da Liga</h3><div class="preco">R$ ${esc(p1)}<span class="small muted">/mês</span></div><ul><li>Selo ★ Parceira da Liga</li><li>Aparece primeiro na sua categoria</li><li>Foto e descrição completa</li><li>Relatório mensal de cliques</li></ul></div>
        <div class="cartao plano destaque"><h3>Destaque</h3><div class="preco">R$ ${esc(p2)}<span class="small muted">/mês</span></div><ul><li>Tudo da Parceira</li><li>Destaque no topo do Guia</li><li>Prioridade para o Café com a Liga</li><li>Menção no resumo semanal da comunidade</li></ul></div>
      </div>
      <h2>Fale com a gente</h2>
      <form class="form" id="formLead">
        <div class="campo"><label>Assunto</label><select name="tipo">
          <option value="anuncio" ${tipo === 'anuncio' ? 'selected' : ''}>Quero anunciar no Guia</option>
          <option value="feira" ${tipo === 'feira' ? 'selected' : ''}>Quero expor na Feira da Liga</option>
          <option value="parceria" ${tipo === 'parceria' ? 'selected' : ''}>Parceria, patrocínio ou Café com a Liga</option>
        </select></div>
        <div class="campo"><label>Plano de interesse</label><select name="plano"><option value="">Ainda não sei</option><option value="parceira">Parceira da Liga</option><option value="destaque">Destaque</option></select></div>
        <div class="campo"><label>Seu nome *</label><input name="nome" required minlength="2" maxlength="80"></div>
        <div class="campo"><label>Nome do negócio</label><input name="negocio" maxlength="120"></div>
        <div class="campo"><label>WhatsApp *</label><input name="whatsapp" required inputmode="tel" minlength="8" maxlength="30" placeholder="(11) 9 9999-9999"></div>
        <div class="campo"><label>Mensagem</label><textarea name="mensagem" maxlength="600"></textarea></div>
        <button class="btn" type="submit">Enviar</button>
      </form>
    </div></section>`;
  },

  async entrar() {
    return `<section class="bloco"><div class="wrap" style="max-width:720px">
      <h1>Entrar na Liga</h1>
      <p>A Liga das Mamães é uma comunidade no WhatsApp para mães de Atibaia e região. Lá dentro tem grupos para cada assunto:</p>
      <div class="grade" style="margin:18px 0">
        <div class="cartao"><b>📣 Avisos</b><span class="muted small">Comunicados e o resumo da semana</span></div>
        <div class="cartao"><b>💗 Liga das Mamães</b><span class="muted small">Apoio, dúvidas e indicações</span></div>
        <div class="cartao"><b>👗 Desapegos da Liga</b><span class="muted small">Compra, venda e troca entre mães</span></div>
        <div class="cartao"><b>🤝 Liga que Conecta</b><span class="muted small">Negócios e serviços de mães</span></div>
        <div class="cartao"><b>🎈 Rolê da Liga</b><span class="muted small">Encontros com as crianças</span></div>
        <div class="cartao"><b>🎁 Achadinhos da Liga</b><span class="muted small">Ofertas escolhidas a dedo</span></div>
      </div>
      <h3>Nossos combinados</h3>
      <ul><li>Acolhimento sempre: aqui ninguém julga a maternidade de ninguém.</li><li>Cada assunto no seu grupo, para ninguém se perder.</li><li>Divulgação de negócios só no Liga que Conecta.</li></ul>
      <p style="margin-top:20px">${CFG.link_comunidade ? btnEntrar() : `<span class="aviso">O link de entrada é enviado pela equipe. ${CFG.whatsapp_contato ? `<a href="${esc(waLink(CFG.whatsapp_contato, 'Oi! Quero entrar na Liga das Mamães.'))}" target="_blank" rel="noopener" data-clique="pedir_entrada">Peça o seu aqui</a>.` : 'Peça para uma mãe que já participa!'}</span>`}</p>
    </div></section>`;
  },
};

/* ---------- Roteador ---------- */
async function rota() {
  const [caminho, qs] = (location.hash.replace(/^#\/?/, '') || '').split('?');
  const nome = caminho || 'inicio';
  const fn = paginas[nome] || paginas.inicio;
  $$('#menu a').forEach((a) => a.classList.toggle('ativo', a.getAttribute('href') === '#/' + nome));
  $('#menu').classList.remove('aberto');
  app.innerHTML = '<div class="carregando">Carregando…</div>';
  try { app.innerHTML = await fn(new URLSearchParams(qs || '')); }
  catch (e) { console.error(e); app.innerHTML = vazio('Algo deu errado ao carregar. Atualize a página.'); }
  window.scrollTo(0, 0);
  registrar('visita', paginas[nome] ? nome : 'inicio');
}

window.addEventListener('hashchange', rota);
carregarConfig().finally(rota);
