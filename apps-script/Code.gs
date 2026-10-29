/**
 * Backend do CRM Prospecção no Google Planilhas.
 * Cole este arquivo em Extensões > Apps Script da planilha, rode setup() uma vez
 * e implante como App da Web (veja LEIAME.md).
 */

const ABA = 'Leads';

const COLUNAS = [
  'id', 'instagram', 'instituicao', 'nome', 'tipo', 'canal', 'telefone', 'cidade',
  'etapa', 'status', 'detalhe', 'indicadoPor', 'reacao', 'plataformaAtual', 'qtdPublico', 'desafio',
  'tplPrimeira', 'primeiraMsgEm', 'ultimoContatoEm', 'demoEm', 'vesperaOk', 'logoRecebido', 'demoFeita',
  'grupoPiloto', 'pilotoInicio', 'pilotoQtd', 'acertoAntes', 'acertoDepois', 'valor',
  'indicacaoPedida', 'retomarEm', 'motivoPerda',
  'qualificacao', 'aquecimento', 'followups', 'posDemo', 'piloto', 'historico',
  'criadoEm', 'atualizadoEm'
];

/** Rode uma vez: cria a aba, o cabeçalho e o token de acesso. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(ABA) || ss.insertSheet(ABA);
  garantirCabecalho_(sh);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, sh.getLastColumn())
    .setFontWeight('bold').setBackground('#4f46e5').setFontColor('#ffffff');
  // texto puro: impede o Planilhas de converter datas e tirar o zero de telefones
  sh.getRange(2, 1, sh.getMaxRows() - 1, sh.getMaxColumns()).setNumberFormat('@');

  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty('TOKEN');
  if (!token) {
    token = Utilities.getUuid();
    props.setProperty('TOKEN', token);
  }
  Logger.log('TOKEN (cole nas Configurações do CRM): ' + token);
}

function doGet(e) {
  try {
    autorizar_(e.parameter.token);
    const action = e.parameter.action || 'list';
    if (action === 'ping') return json_({ ok: true, total: listar_().length });
    if (action === 'list') return json_({ ok: true, leads: listar_() });
    return json_({ ok: false, erro: 'Ação inválida' });
  } catch (err) {
    return erro_(err);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    autorizar_(body.token);
    lock.waitLock(20000);

    if (body.action === 'batch') {
      const res = (body.ops || []).map(op => {
        if (op.op === 'upsert') return salvar_(op.lead);
        if (op.op === 'delete') return remover_(op.id);
        return 'ignorado';
      });
      return json_({ ok: true, resultados: res });
    }
    return json_({ ok: false, erro: 'Ação inválida' });
  } catch (err) {
    return erro_(err);
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- internos ---------------- */

function autorizar_(token) {
  const certo = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!certo || token !== certo) throw new Error('NAO_AUTORIZADO');
}

function aba_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA);
  if (!sh) throw new Error('Aba "' + ABA + '" não existe. Rode setup().');
  return sh;
}

function garantirCabecalho_(sh) {
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const atual = sh.getRange(1, 1, 1, lastCol).getValues()[0].filter(String);
  const faltando = COLUNAS.filter(c => atual.indexOf(c) < 0);
  if (faltando.length) {
    sh.getRange(1, atual.length + 1, 1, faltando.length).setValues([faltando]);
  }
  return atual.concat(faltando);
}

function cabecalho_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
}

function listar_() {
  const sh = aba_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const head = cabecalho_(sh);
  const valores = sh.getRange(2, 1, lastRow - 1, head.length).getValues();
  return valores
    .filter(r => r[0])
    .map(r => {
      const o = {};
      head.forEach((h, i) => {
        if (!h) return;
        const v = r[i];
        o[h] = v instanceof Date ? v.toISOString() : v;
      });
      return o;
    });
}

function linhaDoId_(sh, id) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sh.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function salvar_(lead) {
  if (!lead || !lead.id) return 'sem id';
  const sh = aba_();
  const head = garantirCabecalho_(sh);
  const linha = linhaDoId_(sh, lead.id);

  if (linha > 0) {
    // não sobrescreve uma versão mais nova vinda de outro aparelho
    const col = head.indexOf('atualizadoEm') + 1;
    const atual = String(sh.getRange(linha, col).getValue() || '');
    if (atual && lead.atualizadoEm && atual > String(lead.atualizadoEm)) return 'mantido (mais novo na planilha)';
  }

  const row = head.map(h => (lead[h] === undefined || lead[h] === null) ? '' : String(lead[h]));
  const alvo = linha > 0 ? linha : sh.getLastRow() + 1;
  sh.getRange(alvo, 1, 1, head.length).setNumberFormat('@').setValues([row]);
  return linha > 0 ? 'atualizado' : 'criado';
}

function remover_(id) {
  const sh = aba_();
  const linha = linhaDoId_(sh, id);
  if (linha > 0) {
    sh.deleteRow(linha);
    return 'removido';
  }
  return 'não encontrado';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function erro_(err) {
  console.error(err);
  const msg = String(err && err.message) === 'NAO_AUTORIZADO' ? 'Token inválido' : 'Erro ao processar a requisição';
  return json_({ ok: false, erro: msg });
}
