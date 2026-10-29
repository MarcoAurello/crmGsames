/* Persistência: cache local (localStorage) + fila de envio para o Google Planilhas.
   Toda alteração é gravada primeiro no aparelho e entra na fila; a fila é enviada
   quando há URL configurada e conexão. Assim o app funciona offline. */

const Store = (() => {
  const K_LEADS = 'crm_leads';
  const K_QUEUE = 'crm_fila';
  const K_SETTINGS = 'crm_config';
  const CAMPOS_JSON = ['aquecimento', 'qualificacao', 'followups', 'posDemo', 'piloto', 'historico'];

  let leads = ler(K_LEADS, []);
  let fila = ler(K_QUEUE, []);
  let settings = Object.assign({
    meuNome: '', empresa: '', horario1: 'terça às 10h', horario2: 'quinta às 15h', url: '', token: ''
  }, ler(K_SETTINGS, {}));

  let status = 'local';
  let flushing = null;
  const ouvintes = new Set();

  function ler(chave, padrao) {
    try {
      const v = localStorage.getItem(chave);
      return v ? JSON.parse(v) : padrao;
    } catch (e) {
      console.error('Falha ao ler ' + chave, e);
      return padrao;
    }
  }

  function gravar(chave, valor) {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch (e) {
      console.error('Falha ao gravar ' + chave, e);
    }
  }

  function emitir(tipo) {
    ouvintes.forEach(fn => fn(tipo));
  }

  function setStatus(s) {
    status = s;
    emitir('status');
  }

  function conectado() {
    return Boolean(settings.url && settings.token);
  }

  /* --- serialização para a planilha --- */
  function paraPlanilha(lead) {
    const out = {};
    Object.keys(lead).forEach(k => {
      out[k] = CAMPOS_JSON.includes(k) ? JSON.stringify(lead[k] ?? null) : (lead[k] ?? '');
    });
    return out;
  }

  function daPlanilha(row) {
    const lead = Object.assign({}, row);
    CAMPOS_JSON.forEach(k => {
      if (typeof lead[k] === 'string' && lead[k]) {
        try { lead[k] = JSON.parse(lead[k]); } catch (e) { lead[k] = null; }
      }
    });
    lead.etapa = Number(lead.etapa) || 0;
    return normalizar(lead);
  }

  function normalizar(lead) {
    lead.aquecimento = lead.aquecimento || {};
    lead.qualificacao = lead.qualificacao || {};
    lead.followups = lead.followups || {};
    lead.posDemo = lead.posDemo || {};
    lead.piloto = lead.piloto || {};
    lead.historico = Array.isArray(lead.historico) ? lead.historico : [];
    lead.status = lead.status || 'ativo';
    lead.etapa = Number(lead.etapa) || 0;
    return lead;
  }

  /* --- fila --- */
  function enfileirar(op) {
    fila = fila.filter(o => o.id !== op.id);
    fila.push(op);
    gravar(K_QUEUE, fila);
    flush();
  }

  async function request(params, body) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      let res;
      if (body) {
        // text/plain evita o preflight CORS que o Apps Script não responde
        res = await fetch(settings.url, {
          method: 'POST',
          body: JSON.stringify(Object.assign({ token: settings.token }, body)),
          signal: ctrl.signal
        });
      } else {
        const qs = new URLSearchParams(Object.assign({ token: settings.token }, params));
        res = await fetch(settings.url + '?' + qs, { signal: ctrl.signal });
      }
      const data = await res.json();
      if (!data.ok) throw new Error(data.erro || 'Erro na planilha');
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  function flush() {
    if (!conectado()) { setStatus('local'); return Promise.resolve(); }
    if (flushing) return flushing;
    if (!fila.length) { setStatus('ok'); return Promise.resolve(); }

    const lote = fila.slice();
    let enviado = false;
    setStatus('salvando');
    flushing = request(null, {
      action: 'batch',
      ops: lote.map(o => o.op === 'delete' ? { op: 'delete', id: o.id } : { op: 'upsert', lead: paraPlanilha(o.lead) })
    })
      .then(() => {
        // remove só o que foi enviado; alterações feitas durante o envio ficam
        fila = fila.filter(o => !lote.includes(o));
        gravar(K_QUEUE, fila);
        enviado = true;
        setStatus(fila.length ? 'pendente' : 'ok');
      })
      .catch(e => {
        console.error('Falha ao enviar para a planilha', e);
        setStatus('pendente');
      })
      .finally(() => {
        flushing = null;
        if (enviado && fila.length) flush();
      });
    return flushing;
  }

  async function pull() {
    if (!conectado()) { setStatus('local'); return; }
    await flush();
    setStatus('salvando');
    try {
      const data = await request({ action: 'list' });
      const pendentes = new Set(fila.map(o => o.id));
      const remotos = data.leads.map(daPlanilha);
      const locaisPendentes = leads.filter(l => pendentes.has(l.id));
      leads = remotos.filter(l => !pendentes.has(l.id)).concat(locaisPendentes);
      gravar(K_LEADS, leads);
      emitir('leads');
      setStatus(fila.length ? 'pendente' : 'ok');
    } catch (e) {
      console.error('Falha ao carregar da planilha', e);
      setStatus('pendente');
    }
  }

  /* --- API pública --- */
  return {
    get leads() { return leads; },
    get settings() { return settings; },
    get status() { return status; },
    get pendentes() { return fila.length; },
    conectado,
    on(fn) { ouvintes.add(fn); },

    get(id) { return leads.find(l => l.id === id); },

    salvar(lead) {
      lead = normalizar(lead);
      const agora = new Date().toISOString();
      if (!lead.id) {
        lead.id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
        lead.criadoEm = agora;
      }
      lead.atualizadoEm = agora;
      const i = leads.findIndex(l => l.id === lead.id);
      if (i >= 0) leads[i] = lead; else leads.unshift(lead);
      gravar(K_LEADS, leads);
      emitir('leads');
      enfileirar({ op: 'upsert', id: lead.id, lead });
      return lead;
    },

    remover(id) {
      leads = leads.filter(l => l.id !== id);
      gravar(K_LEADS, leads);
      emitir('leads');
      enfileirar({ op: 'delete', id });
    },

    importar(lista) {
      lista.forEach(l => {
        const lead = normalizar(Object.assign({}, l));
        if (!lead.id) return;
        const i = leads.findIndex(x => x.id === lead.id);
        if (i >= 0) leads[i] = lead; else leads.push(lead);
        fila = fila.filter(o => o.id !== lead.id);
        fila.push({ op: 'upsert', id: lead.id, lead });
      });
      gravar(K_LEADS, leads);
      gravar(K_QUEUE, fila);
      emitir('leads');
      flush();
    },

    enviarTudo() {
      leads.forEach(lead => {
        fila = fila.filter(o => o.id !== lead.id);
        fila.push({ op: 'upsert', id: lead.id, lead });
      });
      gravar(K_QUEUE, fila);
      return flush();
    },

    salvarSettings(novo) {
      settings = Object.assign(settings, novo);
      settings.url = (settings.url || '').trim();
      settings.token = (settings.token || '').trim();
      gravar(K_SETTINGS, settings);
      emitir('settings');
    },

    async testar(url, token) {
      const qs = new URLSearchParams({ action: 'ping', token });
      const res = await fetch(url.trim() + '?' + qs);
      const data = await res.json();
      if (!data.ok) throw new Error(data.erro || 'Resposta inválida');
      return data;
    },

    pull,
    flush
  };
})();
