/**
 * SISTEMA DE ACOMPANHAMENTO DE PEDIDOS URGENTES — SeuBoné
 * Backend (Google Apps Script) — funciona como API para os dois painéis (cadastro e estoque)
 *
 * COMO INSTALAR:
 * 1. Crie uma Google Sheet nova (pode chamar de "Pedidos Urgentes - SeuBoné").
 * 2. Extensões > Apps Script.
 * 3. Apague o conteúdo padrão de Code.gs e cole este arquivo inteiro.
 * 4. Rode a função `configurarPlanilha` uma vez (menu Executar > configurarPlanilha).
 *    Isso cria a aba "Pedidos" com os cabeçalhos certos e a pasta no Drive para os manifestos.
 * 5. Implantar > Nova implantação > tipo "App da Web".
 *    - Executar como: Eu (seu usuário)
 *    - Quem tem acesso: Qualquer pessoa
 * 6. Copie a URL gerada (termina em /exec). Essa é a APP_URL que vai nos 3 arquivos HTML.
 */

const SHEET_NAME = 'Pedidos';
const FOLDER_NAME = 'Manifestos - Pedidos Urgentes';
const FOLDER_IMAGENS_NAME = 'Imagens OS - Pedidos Urgentes';

// ---------- SETUP (rodar uma vez) ----------
function configurarPlanilha() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  const headers = [
    'ID', 'OS', 'Cliente', 'LinkCRM', 'Transportadora', 'Modalidade',
    'TipoEnvioAereo', 'AeroportoRetirada', 'OSImagemId',
    'ManifestoLink', 'NotaFiscalLink', 'Prazo', 'Status', 'InseridoPor', 'InseridoEm',
    'DespachadoPor', 'DespachadoEm'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sheet.setFrozenRows(1);

  // cria (ou localiza) as pastas no Drive
  [FOLDER_NAME, FOLDER_IMAGENS_NAME].forEach(nome => {
    const folders = DriveApp.getFoldersByName(nome);
    if (!folders.hasNext()) DriveApp.createFolder(nome);
  });

  SpreadsheetApp.getUi().alert('Configuração concluída. Pode implantar como App da Web.');
}

function getSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}

function getFolder_() {
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(FOLDER_NAME);
}

function getFolderImagens_() {
  const folders = DriveApp.getFoldersByName(FOLDER_IMAGENS_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(FOLDER_IMAGENS_NAME);
}

// salva um arquivo base64 numa pasta do Drive e deixa público (view) — usado por manifesto, NF e imagem da OS
function salvarArquivo_(base64, nome, mimeType, pasta) {
  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, mimeType || 'application/octet-stream', nome);
  const file = pasta.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file;
}

// ---------- LEITURA (GET) ----------
function doGet(e) {
  const action = e.parameter.action || 'list';

  if (action === 'list') {
    const status = e.parameter.status || null; // "Pendente" | "Despachado" | null (todos)
    const desde = e.parameter.desde || null;   // filtro por data de InseridoEm, formato YYYY-MM-DD
    const ate = e.parameter.ate || null;
    return jsonOut_(listarPedidos_(status, desde, ate));
  }

  return jsonOut_({ erro: 'ação inválida' });
}

function listarPedidos_(status, desde, ate) {
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  let pedidos = data.map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  }).filter(p => p.ID); // ignora linhas vazias

  if (status) pedidos = pedidos.filter(p => p.Status === status);

  if (desde) {
    const d = new Date(desde + 'T00:00:00');
    pedidos = pedidos.filter(p => new Date(p.InseridoEm) >= d);
  }
  if (ate) {
    const a = new Date(ate + 'T23:59:59');
    pedidos = pedidos.filter(p => new Date(p.InseridoEm) <= a);
  }

  // datas viram string ISO pra não quebrar no JSON
  pedidos.forEach(p => {
    if (p.Prazo instanceof Date) p.Prazo = p.Prazo.toISOString();
    if (p.InseridoEm instanceof Date) p.InseridoEm = p.InseridoEm.toISOString();
    if (p.DespachadoEm instanceof Date) p.DespachadoEm = p.DespachadoEm.toISOString();
  });

  return pedidos;
}

// ---------- ESCRITA (POST) ----------
function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const action = body.action;

  if (action === 'create') return jsonOut_(criarPedido_(body));
  if (action === 'despachar') return jsonOut_(despacharPedido_(body));

  return jsonOut_({ erro: 'ação inválida' });
}

function criarPedido_(body) {
  const sheet = getSheet_();
  const id = Utilities.getUuid();
  let manifestoLink = '';
  let notaFiscalLink = '';
  let osImagemId = '';

  if (body.manifestoBase64 && body.manifestoNome) {
    const file = salvarArquivo_(body.manifestoBase64, body.manifestoNome, 'application/pdf', getFolder_());
    manifestoLink = file.getUrl();
  }

  if (body.notaFiscalBase64 && body.notaFiscalNome) {
    const fileNf = salvarArquivo_(body.notaFiscalBase64, body.notaFiscalNome, 'application/pdf', getFolder_());
    notaFiscalLink = fileNf.getUrl();
  }

  if (body.osImagemBase64 && body.osImagemNome) {
    const fileImg = salvarArquivo_(body.osImagemBase64, body.osImagemNome, body.osImagemTipo || 'image/jpeg', getFolderImagens_());
    osImagemId = fileImg.getId();
  }

  sheet.appendRow([
    id,
    body.os || '',
    body.cliente || '',
    body.linkCrm || '',
    body.transportadora || '',
    body.modalidade || '',
    body.tipoEnvioAereo || '',
    body.aeroporto || '',
    osImagemId,
    manifestoLink,
    notaFiscalLink,
    body.prazo ? new Date(body.prazo) : '',
    'Pendente',
    body.inseridoPor || '',
    new Date(),
    '',
    ''
  ]);

  return { ok: true, id: id, manifestoLink: manifestoLink, notaFiscalLink: notaFiscalLink, osImagemId: osImagemId };
}

function despacharPedido_(body) {
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('ID');
  const statusCol = headers.indexOf('Status');
  const despPorCol = headers.indexOf('DespachadoPor');
  const despEmCol = headers.indexOf('DespachadoEm');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === body.id) {
      sheet.getRange(i + 1, statusCol + 1).setValue('Despachado');
      sheet.getRange(i + 1, despPorCol + 1).setValue(body.despachadoPor || '');
      sheet.getRange(i + 1, despEmCol + 1).setValue(new Date());
      return { ok: true };
    }
  }
  return { ok: false, erro: 'pedido não encontrado' };
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
