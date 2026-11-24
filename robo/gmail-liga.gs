/**
 * Robô de e-mails da Liga das Mamães (Google Apps Script, grátis).
 * Roda dentro do Gmail da Liga, todo dia às 6h, e manda para o painel da Jaque
 * os e-mails importantes: programas de afiliados, lojas, parcerias e cadastros.
 * E-mails de segurança (códigos, senhas, login) entram só com o assunto.
 *
 * Instalação (uma vez só):
 * 1. Cole este código em script.google.com (logado no Gmail da Liga).
 * 2. Engrenagem "Configurações do projeto" > Propriedades do script > Adicionar:
 *    nome CHAVE_LIGA, valor = a chave que aparece no painel em Ajustes > Robô de e-mails.
 * 3. Escolha a função "instalar" lá em cima e toque em Executar. Autorize.
 */
const SUPABASE_URL = 'https://hrgvtdfsqtjlfzhsdcnk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WK084yz0hOSX7uVE79YNHw_GcPJiBRR'; // chave pública do site (não é segredo)

const BUSCA = 'newer_than:3d -in:chats (' + [
  'from:(shopee OR mercadolivre OR mercadolibre OR mercadopago OR amazon OR magazineluiza OR magalu OR lomadee OR awin OR rakuten OR hotmart OR kiwify OR eduzz OR monetizze OR natura OR boticario OR aliexpress OR temu OR shein OR instagram OR canva)',
  'subject:(afiliado OR afiliados OR afiliada OR comissão OR comissao OR parceria OR parceira OR publi OR patrocínio OR patrocinio OR cadastro OR pagamento OR saque)',
].join(' OR ') + ')';

const SEGURANCA = /c[óo]digo|code|verifica|senha|password|login|acesso|2fa|token|seguran/i;

function categoria(de, assunto) {
  const t = (de + ' ' + assunto).toLowerCase();
  if (SEGURANCA.test(assunto)) return 'seguranca';
  if (/comiss|pagamento|saque|repasse/.test(t)) return 'dinheiro';
  if (/afiliad|lomadee|awin|rakuten|hotmart|kiwify|eduzz|monetizze/.test(t)) return 'afiliados';
  if (/parceri|publi|patroc/.test(t)) return 'parcerias';
  if (/shopee|mercadoli|mercadopago|amazon|magalu|magazineluiza|aliexpress|temu|shein|natura|boticario/.test(t)) return 'lojas';
  if (/instagram|canva/.test(t)) return 'redes';
  return 'outros';
}

function buscarEmails() {
  const chave = PropertiesService.getScriptProperties().getProperty('CHAVE_LIGA');
  if (!chave) throw new Error('Falta a propriedade CHAVE_LIGA (veja o passo 2 no topo do código).');
  const emails = [];
  GmailApp.search(BUSCA, 0, 60).forEach(function (th) {
    th.getMessages().forEach(function (m) {
      if (Date.now() - m.getDate().getTime() > 3 * 864e5) return;
      const assunto = m.getSubject() || '(sem assunto)';
      const de = m.getFrom() || '';
      const cat = categoria(de, assunto);
      const corpo = cat === 'seguranca' ? '(e-mail de segurança: o conteúdo não foi guardado)'
        : (m.getPlainBody() || '').replace(/https?:\/\/\S+/g, '[link]').replace(/\s+/g, ' ').trim().slice(0, 1500);
      emails.push({ gmail_id: m.getId(), recebido_em: m.getDate().toISOString(), remetente: de, assunto: assunto,
        trecho: corpo, categoria: cat, link: th.getPermalink() });
    });
  });
  if (!emails.length) return 0;
  const r = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/registrar_emails', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: SUPABASE_KEY },
    payload: JSON.stringify({ chave: chave, emails: emails }),
  });
  if (r.getResponseCode() >= 300) throw new Error('Supabase respondeu ' + r.getResponseCode() + ': ' + r.getContentText());
  Logger.log('E-mails novos enviados ao painel: ' + r.getContentText());
  return Number(r.getContentText());
}

function instalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('buscarEmails').timeBased().everyDays(1).atHour(6).inTimezone('America/Sao_Paulo').create();
  ScriptApp.newTrigger('buscarEmails').timeBased().everyDays(1).atHour(18).inTimezone('America/Sao_Paulo').create();
  const n = buscarEmails();
  Logger.log('Pronto! O robô roda todo dia às 6h e às 18h. Agora foram ' + n + ' e-mail(s) para o painel.');
}
