import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { empacotar, desempacotar, extrairMensagem, radar, pareceDuvida } from './lib.mjs';

const G = '120363000000000001@g.us';
const ativos = new Set([G]);
const msg = (id, texto, quem, extra = {}) => ({ key: { id, remoteJid: G, participant: quem + '@lid', fromMe: false }, pushName: quem, messageTimestamp: 1764000000 + Number(id.replace(/\D/g, '') || 0), message: { conversation: texto }, ...extra });

test('sessão vai e volta igual', () => {
  const a = mkdtempSync(join(tmpdir(), 't-')); const b = mkdtempSync(join(tmpdir(), 't-'));
  writeFileSync(join(a, 'creds.json'), '{"x":1}'); writeFileSync(join(a, 'session-1.json'), 'abc');
  assert.equal(desempacotar(empacotar(a), b), 2);
  assert.equal(readFileSync(join(b, 'creds.json'), 'utf8'), '{"x":1}');
});

test('só grupos ativados, sem número de telefone', () => {
  const x = extrairMensagem(msg('m1', 'Bom dia!', 'Ana'), ativos, 'sal');
  assert.equal(x.autor, 'Ana'); assert.equal(x.texto, 'Bom dia!');
  assert.ok(!JSON.stringify(x).includes('@lid'));
  assert.equal(extrairMensagem({ ...msg('m2', 'oi', 'Bia'), key: { id: 'm2', remoteJid: 'outro@g.us' } }, ativos, 'sal'), null);
  assert.equal(extrairMensagem({ key: { id: 'm3', remoteJid: '5511999@s.whatsapp.net' }, message: { conversation: 'privado' } }, ativos, 'sal'), null);
  assert.equal(extrairMensagem({ ...msg('m4', '', 'Ana'), message: { stickerMessage: {} } }, ativos, 'sal'), null);
});

test('resposta marcada e legenda de foto', () => {
  const r = extrairMensagem({ ...msg('m5', '', 'Bia'), message: { extendedTextMessage: { text: 'A Fulana!', contextInfo: { stanzaId: 'm1' } } } }, ativos, 's');
  assert.equal(r.responde_a, 'm1');
  const f = extrairMensagem({ ...msg('m6', '', 'Ana'), message: { ephemeralMessage: { message: { imageMessage: { caption: 'Desapego: carrinho' } } } } }, ativos, 's');
  assert.equal(f.tipo, 'foto'); assert.equal(f.texto, 'Desapego: carrinho');
});

test('reconhece pedidos de indicação', () => {
  for (const t of ['Alguém indica pediatra em Atibaia?', 'Meninas, alguém conhece uma boa diarista', 'Procuro fotógrafa de newborn', 'Indicação de escolinha bilíngue', 'Onde compro fralda de pano mais barato?'])
    assert.ok(pareceDuvida(t), t);
  for (const t of ['Bom dia, mamães!', 'kkkk', 'Obrigada!', 'Tudo bem?']) assert.ok(!pareceDuvida(t), t);
});

test('radar: pedido respondido por outra pessoa sai da lista', () => {
  const m = [
    extrairMensagem(msg('m1', 'Alguém indica pediatra em Atibaia?', 'Ana'), ativos, 's'),
    extrairMensagem({ ...msg('m2', '', 'Bia'), message: { extendedTextMessage: { text: 'Dra. X!', contextInfo: { stanzaId: 'm1' } } } }, ativos, 's'),
    extrairMensagem(msg('m3', 'Alguém conhece uma boa diarista?', 'Carla'), ativos, 's'),
    extrairMensagem(msg('m4', 'Bom dia!', 'Ana'), ativos, 's'),
  ];
  const { resumos, pendencias } = radar(m);
  assert.equal(resumos.length, 1); assert.equal(resumos[0].total, 4); assert.equal(resumos[0].pessoas, 3);
  assert.deepEqual(pendencias.map((p) => p.msg_id), ['m3']);
  assert.equal(pendencias[0].tipo, 'indicacao');
});
