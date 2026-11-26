import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legenda } from './legenda.mjs';

test('legenda no modelo da Jaque', () => {
  const t = legenda({ titulo: 'Kit 10 potes de vidro', preco: 66, preco_antigo: 99.9, loja: 'Mercado Livre', link: 'https://meli.la/x', cupom: 'LIGA10', descricao: 'Sai a 6 reais cada!\n• frete grátis' });
  assert.match(t, /^🔥 \*KIT 10 POTES DE VIDRO\* 📉\n\nSai a 6 reais cada!/);
  assert.match(t, /💵 R\$ 66 \(antes R\$ 99,90\)\n🧾 Cupom: \*LIGA10\*\n• frete grátis/);
  assert.match(t, /🛒 Vendido por Mercado Livre\n📌 Link: https:\/\/meli\.la\/x/);
  assert.match(t, /_link de afiliado_$/);
});

test('sem desconto, sem comentário e sem cupom', () => {
  const t = legenda({ titulo: 'Mordedor', preco: 25.5, link: 'https://x' });
  assert.match(t, /^🔥 \*MORDEDOR\*\n\n💵 R\$ 25,50\n\n📌 Link: https:\/\/x/);
});
