// Robô SOMENTE LEITURA dos grupos da Liga das Mamães.
// - Entra no WhatsApp do chip do robô como "aparelho conectado" (igual ao WhatsApp Web).
// - Pega as mensagens novas só dos grupos ativados no painel e manda para o banco da Liga.
// - NUNCA envia mensagem, nunca marca como lida, nunca aparece "online".
// - Não escreve no log nenhum nome, número ou texto de mensagem (o log do GitHub é público).
//
// Uso:  node coletar.mjs            (rodada normal, 2x por dia pelo GitHub Actions)
//       node coletar.mjs --parear   (primeira vez: mostra o código de 8 letras para digitar no celular do chip)
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import makeWASocket, { Browsers, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from 'baileys';
import pino from 'pino';
import { desempacotar, empacotar, extrairMensagem, radar } from './lib.mjs';

const SUPABASE_URL = 'https://hrgvtdfsqtjlfzhsdcnk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WK084yz0hOSX7uVE79YNHw_GcPJiBRR'; // chave pública do site (não é segredo)
const CHAVE = process.env.ROBO_WHATS_CHAVE;
const PAREAR = process.argv.includes('--parear');
const MAX_MS = PAREAR ? 5 * 60e3 : 6 * 60e3; // tempo máximo conectado
const SILENCIO_MS = 40e3;                     // encerra depois de 40 s sem mensagem nova

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function rpc(nome, corpo) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}`, {
    method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Banco respondeu ${r.status} em ${nome}: ${txt.slice(0, 200)}`);
  return txt ? JSON.parse(txt) : null;
}

async function main() {
  if (!CHAVE) throw new Error('Falta o segredo ROBO_WHATS_CHAVE no GitHub (veja o passo a passo).');
  const ini = await rpc('whats_inicio', { chave: CHAVE });
  const NUMERO = (ini.numero_chip || '').replace(/\D/g, '');
  if (PAREAR && NUMERO.length < 12) throw new Error('Cadastre o número do chip no painel (Grupos > Robô) com 55 + DDD + número.');
  if (ini.pausado && !PAREAR) { log('Robô pausado no painel. Nada a fazer.'); return; }
  if (!ini.sessao && !PAREAR) {
    log('O robô ainda não foi conectado ao chip. No GitHub, rode o robô escolhendo "parear".');
    await rpc('whats_fim', { chave: CHAVE, dados: { status: 'Aguardando pareamento do chip' } });
    return;
  }
  const ativos = new Set(ini.grupos_ativos || []);
  log(`Grupos ativados no painel: ${ativos.size}`);

  const dir = mkdtempSync(join(tmpdir(), 'sessao-'));
  desempacotar(ini.sessao, dir);
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  if (PAREAR && state.creds.registered) log('Atenção: já existe um chip conectado. Ele será mantido.');

  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));
  const mensagens = new Map();
  let grupos = [];
  let aberto = false; let fim = false; let ultimaMsg = Date.now(); let pendentesOk = false;
  let desconectado = false; let status = 'ok'; let sock;
  let codigoPedido = false;

  const conectar = () => {
    sock = makeWASocket({
      auth: state,
      version,
      browser: Browsers.macOS('Chrome'),
      logger: pino({ level: 'silent' }),
      markOnlineOnConnect: false,          // nunca aparece "online"
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false, // não baixa histórico antigo
      fireInitQueries: true,
      generateHighQualityLinkPreview: false,
      getMessage: async () => undefined,
    });
    // Trava de segurança: este robô não envia mensagens. Nunca.
    const bloqueado = async () => { throw new Error('Robô somente leitura: envio bloqueado.'); };
    sock.sendMessage = bloqueado;
    sock.readMessages = async () => {};

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', ({ messages }) => {
      for (const m of messages) {
        const x = extrairMensagem(m, ativos, CHAVE);
        if (x) { mensagens.set(x.id, x); ultimaMsg = Date.now(); }
      }
    });
    sock.ev.on('connection.update', async (u) => {
      if (u.qr && PAREAR && !state.creds.registered && !codigoPedido) {
        codigoPedido = true;
        try {
          const codigo = await sock.requestPairingCode(NUMERO);
          console.log('\n==============================================');
          console.log(`  CÓDIGO PARA DIGITAR NO CELULAR DO CHIP:  ${codigo.slice(0, 4)}-${codigo.slice(4)}`);
          console.log('  WhatsApp > Configurações > Aparelhos conectados > Conectar aparelho');
          console.log('  > "Conectar com número de telefone". Você tem uns 2 minutos.');
          console.log('==============================================\n');
        } catch (e) { status = 'Erro ao gerar código: ' + e.message; fim = true; }
      }
      if (u.receivedPendingNotifications) pendentesOk = true;
      if (u.connection === 'open') {
        aberto = true; ultimaMsg = Date.now();
        log('Conectado ao WhatsApp (somente leitura).');
        try {
          const todos = await sock.groupFetchAllParticipating();
          grupos = Object.values(todos).map((g) => ({ jid: g.id, nome: g.subject, participantes: g.participants?.length || null }));
          log(`O chip está em ${grupos.length} grupo(s).`);
        } catch (e) { log('Não deu para listar os grupos agora.'); }
      }
      if (u.connection === 'close') {
        const cod = u.lastDisconnect?.error?.output?.statusCode;
        if (fim) return;
        if (cod === DisconnectReason.loggedOut) {
          desconectado = true; status = 'O chip desconectou o robô (aparelho removido). Precisa parear de novo.'; fim = true;
        } else if (cod === DisconnectReason.restartRequired || cod === DisconnectReason.connectionLost || cod === DisconnectReason.connectionClosed) {
          log(`Reconectando (código ${cod})…`); aberto = false; setTimeout(conectar, 1500);
        } else {
          status = `Conexão fechada (código ${cod ?? '?'})`; fim = true;
        }
      }
    });
  };
  conectar();

  const inicio = Date.now();
  while (!fim && Date.now() - inicio < MAX_MS) {
    await espera(2000);
    if (!aberto) continue;
    if (PAREAR) { if (Date.now() - ultimaMsg > 60e3) break; continue; }
    if (pendentesOk && Date.now() - ultimaMsg > SILENCIO_MS) break;
    if (!pendentesOk && Date.now() - ultimaMsg > 2 * SILENCIO_MS) break;
  }
  fim = true;
  if (!aberto && status === 'ok') status = PAREAR ? 'O código não foi digitado a tempo. Rode de novo.' : 'Não conectou ao WhatsApp nesta rodada.';
  try { sock.end(undefined); } catch {}
  await espera(1500);

  const lista = [...mensagens.values()];
  const { resumos, pendencias } = radar(lista);
  const me = state.creds.me?.id || '';
  const dados = {
    status: status === 'ok' ? `ok: ${lista.length} mensagens lidas` : status,
    sessao: state.creds.registered && !desconectado ? empacotar(dir) : null,
    desconectado: desconectado ? 'sim' : 'nao',
    numero_final: me ? me.split(':')[0].split('@')[0].slice(-4) : null,
    grupos, mensagens: lista, pendencias, resumos,
  };
  const r = await rpc('whats_fim', { chave: CHAVE, dados });
  rmSync(dir, { recursive: true, force: true });
  log(`Gravado no painel: ${r.mensagens} mensagens novas, ${r.pendencias} pedidos sem resposta, ${r.resolvidas} pedidos respondidos.`);
  if (status !== 'ok') { log(status); if (!aberto) process.exitCode = 1; }
}

main().then(() => process.exit(process.exitCode || 0)).catch((e) => { console.error('Erro:', e.message); process.exit(1); });
