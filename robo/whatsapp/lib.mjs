// Funções puras do robô (sem WhatsApp nem internet), para dar para testar.
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Sessão do WhatsApp: a pasta inteira vira um texto compactado, guardado no banco da Liga.
export function empacotar(dir) {
  const arquivos = {};
  for (const nome of readdirSync(dir)) arquivos[nome] = readFileSync(join(dir, nome), 'utf8');
  return gzipSync(Buffer.from(JSON.stringify(arquivos))).toString('base64');
}
export function desempacotar(texto, dir) {
  mkdirSync(dir, { recursive: true });
  if (!texto) return 0;
  const arquivos = JSON.parse(gunzipSync(Buffer.from(texto, 'base64')).toString('utf8'));
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    if (nome.includes('/') || nome.includes('..')) continue;
    writeFileSync(join(dir, nome), conteudo);
  }
  return Object.keys(arquivos).length;
}

// Código embaralhado da pessoa: dá para saber se quem respondeu é outra pessoa, sem guardar o número.
export const codigoPessoa = (jid, sal) => (jid ? createHash('sha256').update(sal + '|' + jid).digest('hex').slice(0, 16) : null);

const tsParaData = (ts) => new Date(Number(typeof ts === 'object' && ts !== null ? ts.low ?? ts : ts) * 1000);

// Desembrulha mensagens "efêmeras", "ver uma vez", editadas etc.
function conteudo(m) {
  let c = m || {};
  for (let i = 0; i < 5; i++) {
    const dentro = c.ephemeralMessage?.message || c.viewOnceMessage?.message || c.viewOnceMessageV2?.message
      || c.documentWithCaptionMessage?.message || c.editedMessage?.message;
    if (!dentro) break;
    c = dentro;
  }
  return c;
}

// Transforma a mensagem do WhatsApp no mínimo que a Liga precisa. Devolve null para o que não interessa.
export function extrairMensagem(msg, gruposAtivos, sal) {
  const jid = msg?.key?.remoteJid;
  if (!jid || !jid.endsWith('@g.us') || !gruposAtivos.has(jid)) return null;
  if (msg.key.fromMe) return null;
  const c = conteudo(msg.message);
  let texto = null; let tipo = 'texto'; let ctx = null;
  if (c.conversation) texto = c.conversation;
  else if (c.extendedTextMessage) { texto = c.extendedTextMessage.text; ctx = c.extendedTextMessage.contextInfo; }
  else if (c.imageMessage) { tipo = 'foto'; texto = c.imageMessage.caption || ''; ctx = c.imageMessage.contextInfo; }
  else if (c.videoMessage) { tipo = 'video'; texto = c.videoMessage.caption || ''; ctx = c.videoMessage.contextInfo; }
  else if (c.documentMessage) { tipo = 'arquivo'; texto = c.documentMessage.caption || ''; ctx = c.documentMessage.contextInfo; }
  else if (c.audioMessage) { tipo = 'audio'; texto = ''; ctx = c.audioMessage.contextInfo; }
  else if (c.pollCreationMessage || c.pollCreationMessageV3) { tipo = 'enquete'; texto = (c.pollCreationMessage || c.pollCreationMessageV3).name || ''; }
  else return null; // figurinhas, reações, avisos do sistema, etc.
  if (tipo === 'texto' && !texto?.trim()) return null;
  return {
    id: msg.key.id,
    grupo_jid: jid,
    enviada_em: tsParaData(msg.messageTimestamp).toISOString(),
    autor: (msg.pushName || '').slice(0, 60) || 'Alguém',
    autor_hash: codigoPessoa(msg.key.participant || msg.key.participantAlt || msg.participant, sal),
    texto: (texto || '').trim().slice(0, 2000),
    tipo,
    responde_a: ctx?.stanzaId || null,
  };
}

// Pedidos de indicação, dúvidas e afins.
const PEDIDO = /\b(indica(m|ção|cao|ções|coes)?|algu[eé]m (conhece|sabe|tem|indica|recomenda|j[aá])|recomenda(m|ção|cao)?|procuro|procurando|preciso de|onde (encontro|acho|compro|tem|fica)|quem (conhece|faz|vende|tem)|me ajudem|socorro|dica de|sugest[aã]o de)\b/i;
export function pareceDuvida(t) {
  const s = (t || '').trim();
  return PEDIDO.test(s) || (/\?\s*$/.test(s) && s.length >= 15);
}

// Resumo simples do robô para cada grupo (o Claude escreve o resumo completo depois).
export function radar(mensagens) {
  const porGrupo = new Map();
  for (const m of mensagens) {
    if (!porGrupo.has(m.grupo_jid)) porGrupo.set(m.grupo_jid, []);
    porGrupo.get(m.grupo_jid).push(m);
  }
  const resumos = []; const pendencias = [];
  for (const [grupo, lista] of porGrupo) {
    lista.sort((a, b) => a.enviada_em.localeCompare(b.enviada_em));
    const pessoas = new Set(lista.map((m) => m.autor_hash || m.autor));
    let abertas = 0;
    for (const m of lista) {
      if (m.tipo !== 'texto' && m.tipo !== 'foto') continue;
      if (!pareceDuvida(m.texto)) continue;
      const respondida = lista.some((r) => r.responde_a === m.id && r.autor_hash !== m.autor_hash);
      if (respondida) continue;
      abertas++;
      pendencias.push({ grupo_jid: grupo, msg_id: m.id, autor: m.autor, texto: m.texto.slice(0, 600), enviada_em: m.enviada_em,
        tipo: /indic|recomend|conhece|quem faz|quem vende|onde/i.test(m.texto) ? 'indicacao' : 'duvida' });
    }
    resumos.push({
      grupo_jid: grupo, de: lista[0].enviada_em, ate: lista[lista.length - 1].enviada_em, total: lista.length, pessoas: pessoas.size,
      resumo: `${lista.length} mensage${lista.length === 1 ? 'm' : 'ns'} de ${pessoas.size} pessoa${pessoas.size === 1 ? '' : 's'}.`
        + (abertas ? ` ${abertas} pedido(s) ou dúvida(s) sem resposta marcada.` : ''),
    });
  }
  return { resumos, pendencias };
}
