// Robô de ENVIO dos achadinhos aprovados (mesmo chip do robô de leitura).
// - Só posta o que a Jaque aprovou no painel, só no grupo escolhido no painel (Grupos › Envio automático).
// - Uma oferta por rodada; o banco decide se é hora (8h–21h, 45 min entre posts, máx. 5 por dia).
// - Se não tem nada para postar, nem conecta no WhatsApp.
// - Não escreve no log nomes, números nem textos (o log do GitHub é público).
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import makeWASocket, { Browsers, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from 'baileys';
import pino from 'pino';
import { desempacotar, empacotar } from './lib.mjs';
import { legenda } from './legenda.mjs';

const SUPABASE_URL = 'https://hrgvtdfsqtjlfzhsdcnk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WK084yz0hOSX7uVE79YNHw_GcPJiBRR'; // chave pública do site (não é segredo)
const CHAVE = process.env.ROBO_WHATS_CHAVE;
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

async function baixarFoto(url) {
  if (!/^https:\/\//.test(url || '')) return null;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const tipo = r.headers.get('content-type') || '';
    if (!r.ok || !tipo.startsWith('image/')) return null;
    const b = Buffer.from(await r.arrayBuffer());
    return b.length > 1000 && b.length < 8e6 ? b : null;
  } catch { return null; }
}

async function main() {
  if (!CHAVE) { log('Robô ainda não configurado (falta o segredo ROBO_WHATS_CHAVE). Nada a fazer.'); return; }
  const job = await rpc('whats_proximo_envio', { chave: CHAVE });
  if (!job) { log('Nada para postar agora (fila vazia, fora do horário, intervalo ou limite do dia).'); return; }
  const { oferta, grupo } = job;
  if (!/@g\.us$/.test(grupo || '')) throw new Error('O grupo escolhido no painel não é um grupo.');
  const texto = legenda(oferta);
  const foto = await baixarFoto(oferta.imagem_url);
  log(`Vou postar 1 achadinho ${foto ? 'com foto' : 'sem foto (só texto)'}.`);

  const dir = mkdtempSync(join(tmpdir(), 'sessao-'));
  desempacotar(job.sessao, dir);
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

  let ok = false; let erro = ''; let desconectado = false; let sock; let aberto = false; let fim = false;
  const conectar = () => {
    sock = makeWASocket({
      auth: state, version, browser: Browsers.macOS('Chrome'), logger: pino({ level: 'silent' }),
      markOnlineOnConnect: false, syncFullHistory: false, shouldSyncHistoryMessage: () => false,
      generateHighQualityLinkPreview: false, getMessage: async () => undefined,
    });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
      if (u.connection === 'open') aberto = true;
      if (u.connection === 'close' && !fim) {
        const cod = u.lastDisconnect?.error?.output?.statusCode;
        if (cod === DisconnectReason.loggedOut) { desconectado = true; erro = 'O chip desconectou o robô. Precisa parear de novo.'; fim = true; }
        else if ([DisconnectReason.restartRequired, DisconnectReason.connectionLost, DisconnectReason.connectionClosed].includes(cod)) { aberto = false; setTimeout(conectar, 1500); }
        else { erro = `Conexão fechada (código ${cod ?? '?'})`; fim = true; }
      }
    });
  };
  conectar();

  const inicio = Date.now();
  while (!aberto && !fim && Date.now() - inicio < 90e3) await espera(1000);
  if (aberto && !fim) {
    try {
      await espera(4000); // deixa a conexão assentar
      const msg = foto ? { image: foto, caption: texto } : { text: texto };
      await sock.sendMessage(grupo, msg);
      ok = true;
      await espera(5000); // garante que saiu antes de desconectar
    } catch (e) { erro = 'Falha ao postar: ' + e.message; }
  } else if (!erro) erro = 'Não conectou ao WhatsApp nesta rodada.';
  fim = true;
  try { sock.end(undefined); } catch {}
  await espera(1500);

  await rpc('whats_envio_feito', {
    chave: CHAVE, id: oferta.id, ok, erro,
    sessao: state.creds.registered && !desconectado ? empacotar(dir) : null,
    status: ok ? 'ok: 1 achadinho postado' : erro,
  });
  rmSync(dir, { recursive: true, force: true });
  log(ok ? 'Achadinho postado ✔' : erro);
  if (!ok) process.exitCode = 1;
}

main().then(() => process.exit(process.exitCode || 0)).catch((e) => { console.error('Erro:', e.message); process.exit(1); });
