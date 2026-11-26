import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ofertaML, escolher } from './lib.mjs';

const tema = { id: 't1', preco_max: 100 };
const item = (o) => ({ id: 'MLB1', title: 'Mordedor de silicone bebê', price: 30, original_price: 50, condition: 'new', permalink: 'https://produto.mercadolivre.com.br/MLB-1', thumbnail: 'http://http2.mlstatic.com/D_1-I.jpg', shipping: { free_shipping: true }, ...o });

test('oferta boa vira item da fila com falta de link', () => {
  const o = ofertaML(item(), tema);
  assert.equal(o.precisa_link, true);
  assert.equal(o.origem_id, 'ml:MLB1');
  assert.equal(o.preco_antigo, 50);
  assert.equal(o.descricao, '• 40% off\n• frete grátis');
  assert.match(o.imagem_url, /^https:.*-O\.jpg$/);
});

test('filtra proibidos, usados e acima do preço do tema', () => {
  assert.equal(ofertaML(item({ title: 'Air fryer 4L' }), tema), null);
  assert.equal(ofertaML(item({ condition: 'used' }), tema), null);
  assert.equal(ofertaML(item({ price: 150 }), tema), null);
});

test('escolhe no máximo o limite, sem repetir e alternando temas', () => {
  const mk = (id, p) => ({ origem_id: id, _pontos: p });
  const r = escolher([[mk('a', 1), mk('b', 9), mk('c', 5)], [mk('b', 9), mk('d', 2)]], 3);
  assert.deepEqual(r.map((o) => o.origem_id), ['b', 'd', 'c']);
  assert.equal('_pontos' in r[0], false);
});
