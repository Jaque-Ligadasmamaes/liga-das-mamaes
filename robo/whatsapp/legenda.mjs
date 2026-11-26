// Legenda do achadinho (mesmo modelo do botão "Enviar no WhatsApp" do painel).
export const SITE = 'https://jaque-ligadasmamaes.github.io/liga-das-mamaes/';
const precoCurto = (v) => 'R$ ' + (Number(v) % 1 ? Number(v).toFixed(2).replace('.', ',') : String(Math.round(Number(v))));

export function legenda(o) {
  const linhasDesc = String(o.descricao || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const ehDica = (l) => /^[•\-*]/.test(l);
  const dicas = linhasDesc.filter(ehDica).map((l) => '• ' + l.replace(/^[•\-*]\s*/, ''));
  const comentario = linhasDesc.filter((l) => !ehDica(l)).join('\n');
  const caiu = o.preco && Number(o.preco_antigo) > Number(o.preco);
  const topo = [`🔥 *${String(o.titulo).toUpperCase().replace(/\*/g, '')}*${caiu ? ' 📉' : ''}`];
  if (comentario) topo.push(comentario);
  const valores = [];
  if (o.preco) valores.push(`💵 ${precoCurto(o.preco)}${caiu ? ` (antes ${precoCurto(o.preco_antigo)})` : ''}`);
  if (o.cupom) valores.push(`🧾 Cupom: *${o.cupom}*`);
  valores.push(...dicas);
  const link = [o.loja ? `🛒 Vendido por ${o.loja}` : '', `📌 Link: ${o.link}`].filter(Boolean);
  return [topo.join('\n\n'), valores.join('\n'), link.join('\n'), `💗 Convide outras mamães para a Liga:\n${SITE}`, '_link de afiliado_']
    .filter(Boolean).join('\n\n');
}
