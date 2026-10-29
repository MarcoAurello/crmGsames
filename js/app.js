/* Interface do CRM: views (Hoje, Funil, Lista, Objeções), cadastro e ficha do lead. */

(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  const ui = {
    view: 'hoje',
    leadAberto: null,
    etapaVista: null,
    timer: { seg: 0, id: null }
  };

  /* ================= utilidades ================= */

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function hoje() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function toDate(s) {
    if (!s) return null;
    if (s instanceof Date) return s;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  function isoDia(d) {
    d = toDate(d);
    if (!d) return '';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function addDias(d, n) {
    const r = new Date(toDate(d));
    r.setDate(r.getDate() + n);
    r.setHours(0, 0, 0, 0);
    return r;
  }

  function diffDias(d) {
    const a = toDate(d);
    if (!a) return null;
    const b = new Date(a); b.setHours(0, 0, 0, 0);
    return Math.round((b - hoje()) / 86400000);
  }

  function quando(d) {
    const n = diffDias(d);
    if (n === null) return '';
    if (n === 0) return 'hoje';
    if (n === 1) return 'amanhã';
    if (n === -1) return 'ontem';
    if (n < 0) return `há ${-n} dias`;
    if (n < 7) return `em ${n} dias`;
    return toDate(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }

  function fmtData(d, comHora) {
    d = toDate(d);
    if (!d) return '';
    const o = { day: '2-digit', month: '2-digit', year: '2-digit' };
    if (comHora) Object.assign(o, { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleString('pt-BR', o);
  }

  function normalizarInstagram(v) {
    v = String(v || '').trim();
    const m = v.match(/instagram\.com\/([^/?#\s]+)/i);
    if (m) v = m[1];
    return v.replace(/^@+/, '').replace(/\/+$/, '').toLowerCase();
  }

  function telWhats(t) {
    let d = String(t || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.length <= 11) d = '55' + d;
    return d;
  }

  function prioridade(lead) {
    const q = lead.qualificacao || {};
    return ['atividades', 'alunos', 'pais'].filter(k => q[k]).length;
  }

  function etapa(id) {
    return ETAPAS.find(e => e.id === Number(id)) || ETAPAS[0];
  }

  function toast(msg, acao) {
    const t = $('#toast');
    t.innerHTML = `<span>${esc(msg)}</span>` + (acao ? `<button type="button" class="link-btn">${esc(acao.label)}</button>` : '');
    t.hidden = false;
    t.classList.add('show');
    if (acao) $('button', t).onclick = () => { acao.fn(); esconder(); };
    clearTimeout(toast._t);
    toast._t = setTimeout(esconder, acao ? 6000 : 2500);
    function esconder() {
      t.classList.remove('show');
      setTimeout(() => { t.hidden = true; }, 200);
    }
  }

  async function copiar(texto) {
    try {
      await navigator.clipboard.writeText(texto);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast('Mensagem copiada');
  }

  /* ================= variáveis das mensagens ================= */

  function variaveis(lead) {
    const s = Store.settings;
    const clinica = lead.tipo === 'Clínica';
    const demo = toDate(lead.demoEm);
    return {
      nome: lead.nome,
      instituicao: lead.instituicao,
      detalhe: lead.detalhe,
      indicadoPor: lead.indicadoPor,
      meuNome: s.meuNome,
      empresa: s.empresa,
      horario1: s.horario1,
      horario2: s.horario2,
      publico: clinica ? 'pacientes' : 'alunos',
      grupoPiloto: lead.grupoPiloto || (clinica ? 'alguns pacientes' : 'uma turma'),
      horaDemo: demo && lead.demoEm.includes('T') ? demo.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
      pilotoQtd: lead.pilotoQtd,
      acertoAntes: lead.acertoAntes,
      acertoDepois: lead.acertoDepois,
      valor: lead.valor
    };
  }

  function preencher(tpl, lead) {
    const v = variaveis(lead);
    return tpl.replace(/\{(\w+)\}/g, (_, k) => (v[k] ? String(v[k]) : `[${k}]`));
  }

  function templatePrimeira(lead) {
    if (lead.canal === 'wpp_indicacao') return 'wpp_indicacao';
    if (lead.canal === 'wpp_frio') return 'wpp_frio';
    return lead.tipo === 'Clínica' ? 'instagram_Clínica' : 'instagram_Escola';
  }

  /* ================= próxima ação ================= */

  function proximaAcao(lead) {
    const base = lead.primeiraMsgEm || lead.ultimoContatoEm || lead.criadoEm;
    if (lead.status === 'perdido') return null;
    if (lead.status === 'pausado') return { data: lead.retomarEm || addDias(lead.atualizadoEm, 30), texto: 'Retomar contato' };
    if (lead.status === 'ganho' || lead.etapa === 7) {
      return lead.indicacaoPedida ? null : { data: lead.atualizadoEm, texto: 'Pedir indicação' };
    }
    switch (lead.etapa) {
      case 0: {
        const feito = AQUECIMENTO.every(a => lead.aquecimento[a.key]);
        return feito
          ? { data: hoje(), texto: 'Enviar a 1ª mensagem' }
          : { data: addDias(lead.criadoEm, 2), texto: 'Concluir o aquecimento' };
      }
      case 1:
        return lead.primeiraMsgEm
          ? { data: addDias(lead.primeiraMsgEm, 2), texto: 'Sem resposta em 48h? Ir para follow-up' }
          : { data: hoje(), texto: 'Enviar a 1ª mensagem' };
      case 2:
        return { data: lead.ultimoContatoEm || lead.atualizadoEm, texto: 'Responder conforme a reação' };
      case 3:
        if (!lead.demoEm) return { data: lead.ultimoContatoEm || hoje(), texto: 'Enviar convite com 2 horários' };
        if (!lead.vesperaOk) return { data: addDias(lead.demoEm, -1), texto: 'Confirmar a demo na véspera' };
        return { data: lead.demoEm, texto: 'Demonstração' };
      case 4: {
        if (lead.demoEm && diffDias(lead.demoEm) >= 0 && !lead.demoFeita) {
          return { data: lead.demoEm, texto: 'Demonstração' + (variaveis(lead).horaDemo ? ' às ' + variaveis(lead).horaDemo : '') };
        }
        const p = MSG.posDemo.find(f => !lead.posDemo[f.key]);
        if (p && lead.demoEm) return { data: addDias(lead.demoEm, p.dia), texto: 'Pós-demo: ' + p.titulo.toLowerCase() };
        return { data: hoje(), texto: 'Propor o piloto de 14 dias' };
      }
      case 5: {
        const f = MSG.followups.find(x => !lead.followups[x.key]);
        if (f) return { data: addDias(base, f.dia), texto: 'Follow-up ' + f.titulo.toLowerCase() };
        return { data: hoje(), texto: '4 tentativas sem resposta: pausar 30 dias' };
      }
      case 6: {
        if (!lead.pilotoInicio) return { data: hoje(), texto: 'Definir início do piloto' };
        const p = PILOTO_PASSOS.find(x => !lead.piloto[x.key]);
        if (p) return { data: addDias(lead.pilotoInicio, p.dia - 1), texto: `Piloto dia ${p.dia}: ${p.txt.toLowerCase()}` };
        return { data: hoje(), texto: 'Enviar mensagem de fechamento' };
      }
    }
    return null;
  }

  /* ================= filtros ================= */

  function filtrados() {
    const busca = $('#f-busca').value.trim().toLowerCase().replace(/^@/, '');
    const tipo = $('#f-tipo').value;
    const status = $('#f-status').value;
    return Store.leads.filter(l => {
      if (tipo && l.tipo !== tipo) return false;
      if (status && l.status !== status) return false;
      if (busca) {
        const alvo = [l.instagram, l.nome, l.instituicao, l.cidade].join(' ').toLowerCase();
        if (!alvo.includes(busca)) return false;
      }
      return true;
    });
  }

  /* ================= cards ================= */

  function badgeEtapa(lead) {
    const e = etapa(lead.etapa);
    return `<span class="badge c-${e.cor}">${esc(e.nome)}</span>`;
  }

  function badgeStatus(lead) {
    if (lead.status === 'ativo' || (lead.status === 'ganho' && lead.etapa === 7)) return '';
    return `<span class="badge st-${lead.status}">${esc(STATUS[lead.status])}</span>`;
  }

  function dots(lead) {
    const p = prioridade(lead);
    return `<span class="prio" title="Qualificação ${p}/3" aria-label="Qualificação ${p} de 3">${[0, 1, 2].map(i => `<i class="${i < p ? 'on' : ''}"></i>`).join('')}</span>`;
  }

  function card(lead, opts = {}) {
    const acao = proximaAcao(lead);
    const n = acao ? diffDias(acao.data) : null;
    const cls = n === null ? '' : n < 0 ? 'late' : n === 0 ? 'today' : '';
    return `
      <article class="card ${lead.status !== 'ativo' ? 'dim' : ''}" data-open="${esc(lead.id)}" ${opts.drag ? `draggable="true" data-drag="${esc(lead.id)}"` : ''} tabindex="0" role="button" aria-label="Abrir @${esc(lead.instagram)}">
        <div class="card-top">
          <span class="handle">@${esc(lead.instagram)}</span>
          ${dots(lead)}
        </div>
        <h3 class="card-title">${esc(lead.instituicao)}</h3>
        <p class="card-sub">${esc([lead.nome, lead.tipo, CANAIS[lead.canal] && lead.canal !== 'instagram' ? CANAIS[lead.canal] : ''].filter(Boolean).join(' · '))}</p>
        <div class="card-tags">${opts.etapa ? badgeEtapa(lead) : ''}${badgeStatus(lead)}</div>
        ${acao ? `<p class="next ${cls}"><span>${esc(acao.texto)}</span><time>${esc(quando(acao.data))}</time></p>` : ''}
      </article>`;
  }

  function vazio(msg, comBotao) {
    return `<div class="empty"><p>${esc(msg)}</p>${comBotao ? '<button type="button" class="btn primary" data-novo>Cadastrar primeiro lead</button>' : ''}</div>`;
  }

  /* ================= views ================= */

  function renderHoje() {
    const itens = Store.leads
      .map(l => ({ l, a: proximaAcao(l) }))
      .filter(x => x.a && x.l.status !== 'perdido')
      .map(x => Object.assign(x, { n: diffDias(x.a.data) }))
      .sort((a, b) => a.n - b.n || prioridade(b.l) - prioridade(a.l));

    const grupos = [
      { t: 'Atrasadas', f: x => x.n < 0 },
      { t: 'Hoje', f: x => x.n === 0 },
      { t: 'Próximos 7 dias', f: x => x.n > 0 && x.n <= 7 }
    ];

    const urgentes = itens.filter(x => x.n <= 0).length;
    const b = $('#badge-hoje');
    b.hidden = !urgentes;
    b.textContent = urgentes;

    if (!Store.leads.length) {
      $('#hoje-list').innerHTML = vazio('Nenhum lead ainda. Comece pelo @ de uma escola ou clínica que você vai aquecer.', true);
      return;
    }
    const html = grupos.map(g => {
      const lista = itens.filter(g.f);
      if (!lista.length) return '';
      return `<h3 class="group-title">${g.t} <span class="count">${lista.length}</span></h3>
        <div class="grid">${lista.map(x => card(x.l, { etapa: true })).join('')}</div>`;
    }).join('');
    $('#hoje-list').innerHTML = html || vazio('Tudo em dia! Nenhuma ação para os próximos 7 dias.');
  }

  function renderFunil() {
    const leads = filtrados();
    $('#stage-pills').innerHTML = ETAPAS.map(e => {
      const n = leads.filter(l => l.etapa === e.id).length;
      return `<button type="button" class="pill c-${e.cor}" data-goto="${e.id}">${esc(e.curto)} <b>${n}</b></button>`;
    }).join('');

    $('#board').innerHTML = ETAPAS.map(e => {
      const col = leads.filter(l => l.etapa === e.id).sort((a, b) => prioridade(b) - prioridade(a));
      return `
        <section class="col ${col.length ? '' : 'is-empty'}" id="col-${e.id}" data-drop="${e.id}" aria-label="${esc(e.nome)}">
          <header class="col-head c-${e.cor}"><h3>${e.id}. ${esc(e.nome)}</h3><span class="count">${col.length}</span></header>
          <div class="col-body">${col.map(l => card(l, { drag: true })).join('') || '<p class="col-empty">Arraste um lead para cá</p>'}</div>
        </section>`;
    }).join('');
  }

  function renderLista() {
    const leads = filtrados().slice().sort((a, b) => String(b.atualizadoEm).localeCompare(String(a.atualizadoEm)));
    $('#lista').innerHTML = leads.length
      ? `<div class="grid">${leads.map(l => card(l, { etapa: true })).join('')}</div>`
      : vazio(Store.leads.length ? 'Nenhum lead com esses filtros.' : 'Nenhum lead cadastrado.', !Store.leads.length);
  }

  function renderObjecoes() {
    $('#objecoes').innerHTML = OBJECOES.map(o => `
      <details class="obj">
        <summary>“${esc(o.obj)}”</summary>
        <p>${esc(o.resp)}</p>
        ${o.alerta ? `<p class="alert">${esc(o.alerta)}</p>` : ''}
        <button type="button" class="btn sm" data-copy-text="${esc(o.resp)}">Copiar resposta</button>
      </details>`).join('');
  }

  function render() {
    renderHoje();
    renderFunil();
    renderLista();
    if (ui.leadAberto) {
      if (Store.get(ui.leadAberto)) renderLead(); else $('#dlg-lead').close();
    }
  }

  function trocarView(v) {
    ui.view = v;
    $$('.tab').forEach(t => {
      const on = t.dataset.view === v;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-current', on ? 'page' : 'false');
    });
    $$('.view').forEach(s => s.classList.toggle('is-active', s.id === 'view-' + v));
    $('#toolbar').hidden = v === 'scripts' || v === 'hoje';
    try { localStorage.setItem('crm_view', v); } catch (e) { /* sem persistência */ }
  }

  /* ================= cadastro ================= */

  function abrirForm(lead, preset) {
    const f = $('#lead-form');
    f.reset();
    $('#err-instagram').hidden = true;
    const dados = Object.assign({ tipo: 'Escola', canal: 'instagram' }, preset, lead);
    $('#form-title').textContent = lead ? 'Editar lead' : 'Novo lead';
    ['id', 'instagram', 'instituicao', 'nome', 'telefone', 'cidade', 'indicadoPor', 'detalhe'].forEach(k => {
      f.elements[k].value = dados[k] || '';
    });
    f.elements.canal.value = dados.canal;
    $$('input[name="tipo"]', f).forEach(r => { r.checked = r.value === dados.tipo; });
    const q = dados.qualificacao || {};
    f.elements.q_atividades.checked = !!q.atividades;
    f.elements.q_alunos.checked = !!q.alunos;
    f.elements.q_pais.checked = !!q.pais;
    toggleCanal();
    $('#dlg-form').showModal();
    setTimeout(() => f.elements.instagram.focus(), 50);
  }

  function toggleCanal() {
    const f = $('#lead-form');
    $$('[data-show-canal]', f).forEach(el => {
      el.hidden = el.dataset.showCanal !== f.elements.canal.value;
    });
  }

  function salvarForm(ev) {
    ev.preventDefault();
    const f = ev.target;
    const ig = normalizarInstagram(f.elements.instagram.value);
    const err = $('#err-instagram');
    const id = f.elements.id.value;

    if (!/^[a-z0-9._]{1,30}$/.test(ig)) {
      err.textContent = 'Informe um @ válido (letras, números, ponto e sublinhado).';
      err.hidden = false;
      f.elements.instagram.focus();
      return;
    }
    const dup = Store.leads.find(l => l.instagram === ig && l.id !== id);
    if (dup) {
      err.innerHTML = `@${esc(ig)} já está cadastrado. <button type="button" class="link-btn" data-open="${esc(dup.id)}">Abrir ficha</button>`;
      err.hidden = false;
      return;
    }
    if (!f.elements.instituicao.value.trim()) {
      f.elements.instituicao.focus();
      f.elements.instituicao.setAttribute('aria-invalid', 'true');
      return;
    }

    const base = id ? Object.assign({}, Store.get(id)) : { etapa: 0, status: 'ativo', historico: [{ em: new Date().toISOString(), txt: 'Lead cadastrado' }] };
    Object.assign(base, {
      instagram: ig,
      instituicao: f.elements.instituicao.value.trim(),
      nome: f.elements.nome.value.trim(),
      tipo: f.elements.tipo.value,
      canal: f.elements.canal.value,
      telefone: f.elements.telefone.value.trim(),
      cidade: f.elements.cidade.value.trim(),
      indicadoPor: f.elements.indicadoPor.value.trim(),
      detalhe: f.elements.detalhe.value.trim(),
      qualificacao: { atividades: f.elements.q_atividades.checked, alunos: f.elements.q_alunos.checked, pais: f.elements.q_pais.checked }
    });
    if (!id && base.canal !== 'instagram') base.etapa = 1; // WhatsApp não tem aquecimento

    const salvo = Store.salvar(base);
    $('#dlg-form').close();
    toast(id ? 'Lead atualizado' : 'Lead cadastrado');
    if (!id) abrirLead(salvo.id);
  }

  /* ================= ficha do lead ================= */

  function abrirLead(id) {
    ui.leadAberto = id;
    ui.etapaVista = null;
    renderLead();
    const d = $('#dlg-lead');
    if (!d.open) d.showModal();
  }

  function atualizar(lead, mudancas, log) {
    Object.assign(lead, mudancas);
    if (log) lead.historico = [{ em: new Date().toISOString(), txt: log }].concat(lead.historico || []);
    Store.salvar(lead);
  }

  function moverEtapa(lead, nova, extra) {
    nova = Number(nova);
    if (nova === lead.etapa && !extra) return;
    const mud = Object.assign({ etapa: nova }, extra);
    if (nova === 7) mud.status = 'ganho';
    else if (lead.status === 'ganho') mud.status = 'ativo';
    ui.etapaVista = null;
    atualizar(lead, mud, `Movido para ${etapa(nova).nome}`);
    toast(`Movido para ${etapa(nova).nome}`);
  }

  function msgBox(id, titulo, tpl, lead, opts = {}) {
    const texto = preencher(tpl, lead);
    const wa = telWhats(lead.telefone);
    const ehWhats = lead.canal !== 'instagram' || opts.whats;
    return `
      <div class="msg" ${opts.feito ? 'data-feito' : ''}>
        <div class="msg-head">
          <strong>${esc(titulo)}</strong>
          ${opts.quando ? `<span class="muted">${esc(opts.quando)}</span>` : ''}
          ${opts.feito ? '<span class="badge st-ok">Enviado</span>' : ''}
        </div>
        ${opts.dica ? `<p class="hint">${esc(opts.dica)}</p>` : ''}
        <textarea id="${id}" data-tpl="${esc(tpl)}" rows="${Math.min(7, Math.ceil(texto.length / 55) + 1)}" aria-label="${esc(titulo)}">${esc(texto)}</textarea>
        <div class="msg-actions">
          <button type="button" class="btn sm" data-copy="${id}">Copiar</button>
          ${wa ? `<button type="button" class="btn sm ${ehWhats ? 'whats' : ''}" data-whats="${id}">WhatsApp</button>` : ''}
          ${lead.canal === 'instagram' && !opts.whats ? `<button type="button" class="btn sm insta" data-direct="${id}">Copiar e abrir Direct</button>` : ''}
          ${opts.acao ? `<button type="button" class="btn sm primary" ${opts.acao.attr}>${esc(opts.acao.label)}</button>` : ''}
        </div>
      </div>`;
  }

  function campo(lead, key, label, opts = {}) {
    const v = lead[key] ?? '';
    const tipo = opts.type || 'text';
    return `<div class="field ${opts.full ? 'full' : ''}">
      <label for="fd-${key}">${esc(label)}</label>
      ${tipo === 'textarea'
        ? `<textarea id="fd-${key}" data-field="${key}" rows="2" placeholder="${esc(opts.ph || '')}">${esc(v)}</textarea>`
        : `<input id="fd-${key}" type="${tipo}" data-field="${key}" value="${esc(v)}" placeholder="${esc(opts.ph || '')}" ${opts.attrs || ''}>`}
      ${opts.hint ? `<p class="hint">${esc(opts.hint)}</p>` : ''}
    </div>`;
  }

  function check(grupo, key, on, txt, sub) {
    return `<label class="check-row">
      <input type="checkbox" data-check="${grupo}" data-key="${key}" ${on ? 'checked' : ''}>
      <span><span class="check-txt">${esc(txt)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</span>
    </label>`;
  }

  function painelEtapa(lead, e) {
    const pub = variaveis(lead).publico;
    switch (e) {
      case 0: {
        const feitos = AQUECIMENTO.filter(a => lead.aquecimento[a.key]).length;
        return `
          <p class="lead-in">1 a 3 dias antes da 1ª mensagem, faça o perfil notar você. Assim o direct chega de alguém conhecido, e não de um vendedor.</p>
          <div class="progress" aria-label="${feitos} de ${AQUECIMENTO.length}"><span style="width:${feitos / AQUECIMENTO.length * 100}%"></span></div>
          <div class="checklist">${AQUECIMENTO.map(a => check('aquecimento', a.key, lead.aquecimento[a.key], a.txt, a.ex)).join('')}</div>
          ${campo(lead, 'detalhe', 'Detalhe real do perfil', { full: true, ph: 'a feira de ciências', hint: 'Usado na 1ª mensagem.' })}
          <h4 class="sub-title">Qualificação rápida</h4>
          <p class="muted small">Priorize perfis que postam atividades, mostram ${pub} e falam com os pais.</p>
          <div class="checklist">
            ${check('qualificacao', 'atividades', lead.qualificacao.atividades, 'Posta atividades')}
            ${check('qualificacao', 'alunos', lead.qualificacao.alunos, `Mostra ${pub}`)}
            ${check('qualificacao', 'pais', lead.qualificacao.pais, 'Fala com os pais')}
          </div>
          <div class="actions"><button type="button" class="btn primary" data-mover="1">Aquecimento feito → 1ª mensagem</button></div>`;
      }
      case 1: {
        const atual = lead.tplPrimeira || templatePrimeira(lead);
        const t = MSG.primeira[atual];
        return `
          <p class="lead-in">Até 4 linhas: elogio real, contexto e uma pergunta fácil de responder.</p>
          <div class="field full">
            <label for="sel-tpl">Modelo</label>
            <select id="sel-tpl" data-field="tplPrimeira">
              ${Object.entries(MSG.primeira).map(([k, m]) => `<option value="${k}" ${k === atual ? 'selected' : ''}>${esc(m.titulo)}</option>`).join('')}
            </select>
          </div>
          ${msgBox('m-primeira', t.titulo, t.texto, lead, {
            whats: atual.startsWith('wpp'),
            feito: !!lead.primeiraMsgEm,
            quando: lead.primeiraMsgEm ? 'enviada ' + quando(lead.primeiraMsgEm) : '',
            acao: lead.primeiraMsgEm ? null : { label: 'Marcar como enviada', attr: 'data-act="primeira-enviada"' }
          })}
          <p class="alert">Se não houver resposta em 48 horas, siga para os follow-ups.</p>
          <div class="actions">
            <button type="button" class="btn primary" data-mover="2">Respondeu → Etapa 2</button>
            <button type="button" class="btn" data-mover="5">Sem resposta → Follow-up</button>
          </div>`;
      }
      case 2: {
        const r = lead.reacao;
        return `
          <p class="lead-in">Gancho visual: vídeo de 30 a 60 s com o app já usando o logo do cliente (abertura com a marca, um jogo rodando e um relatório).</p>
          <div class="field full"><span class="label">O que a pessoa respondeu?</span>
            <div class="chips" role="radiogroup">
              ${Object.entries(MSG.reacao).map(([k, m]) => `<button type="button" class="chip ${r === k ? 'on' : ''}" role="radio" aria-checked="${r === k}" data-reacao="${k}">${esc(m.titulo)}</button>`).join('')}
            </div>
          </div>
          ${r ? msgBox('m-reacao', 'Resposta: ' + MSG.reacao[r].titulo, MSG.reacao[r].texto, lead, { dica: MSG.reacao[r].dica }) : '<p class="muted">Escolha a reação para ver a resposta sugerida.</p>'}
          <div class="form-grid">
            ${r === 'outra' ? campo(lead, 'plataformaAtual', 'Plataforma que usam hoje') : ''}
            ${campo(lead, 'qtdPublico', `Quantos ${pub}`, { type: 'number', attrs: 'min="0" inputmode="numeric"' })}
            ${campo(lead, 'desafio', 'Maior desafio', { full: true, ph: `engajar os ${pub}, acompanhar a evolução, mostrar resultado aos pais` })}
          </div>
          <div class="actions"><button type="button" class="btn primary" data-mover="3">Convidar para demo → Etapa 3</button></div>`;
      }
      case 3:
        return `
          <p class="lead-in">Ofereça duas opções de horário e deixe claro que dura só 15 minutos. Pergunta aberta adia a decisão.</p>
          ${msgBox('m-convite', 'Convite', MSG.convite[lead.tipo] || MSG.convite.Escola, lead, { dica: 'Os horários vêm das Configurações.' })}
          <div class="form-grid">${campo(lead, 'demoEm', 'Demo marcada para', { type: 'datetime-local' })}</div>
          ${msgBox('m-aceite', 'Depois que aceitar', MSG.convite.aceite, lead, { dica: 'Pedir o logo cria compromisso com o encontro.' })}
          ${lead.demoEm ? msgBox('m-vespera', 'Na véspera', MSG.convite.vespera, lead, {
            quando: fmtData(addDias(lead.demoEm, -1)),
            feito: !!lead.vesperaOk,
            acao: lead.vesperaOk ? null : { label: 'Confirmado', attr: 'data-act="vespera"' }
          }) : ''}
          <div class="checklist">${check('flag', 'logoRecebido', lead.logoRecebido, 'Recebi o logo e preparei o app personalizado')}</div>
          <div class="actions"><button type="button" class="btn primary" data-mover="4">Demo marcada → Etapa 4</button></div>`;
      case 4:
        return `
          <div class="form-grid">
            ${campo(lead, 'demoEm', 'Data e hora da demo', { type: 'datetime-local' })}
            ${campo(lead, 'desafio', 'Maior desafio (ouvir nos 2 primeiros minutos)', { full: true })}
          </div>
          <div class="timer" aria-live="off">
            <span class="timer-num" id="timer-num">${fmtTimer(ui.timer.seg)}</span>
            <button type="button" class="btn sm" data-timer="toggle">${ui.timer.id ? 'Pausar' : 'Iniciar'}</button>
            <button type="button" class="btn sm ghost" data-timer="reset">Zerar</button>
          </div>
          <ol class="roteiro" id="roteiro">
            ${ROTEIRO_DEMO.map((r, i) => {
              const de = i ? ROTEIRO_DEMO[i - 1].ate : 0;
              return `<li data-de="${de * 60}" data-ate="${r.ate * 60}"><span class="tempo">${de}–${r.ate} min</span><strong>${esc(r.faz)}</strong><p>“${esc(preencher(r.diz, lead))}”</p></li>`;
            }).join('')}
          </ol>
          <p class="alert">Ligue cada parte ao desafio que a pessoa contou. Fale menos de recursos e mais do resultado.</p>
          <div class="checklist">${check('flag', 'demoFeita', lead.demoFeita, 'Demonstração realizada')}</div>
          <h4 class="sub-title">Se ficou de pensar</h4>
          ${MSG.posDemo.map(p => msgBox('m-' + p.key, p.titulo, p.texto, lead, {
            whats: true,
            quando: lead.demoEm ? fmtData(addDias(lead.demoEm, p.dia)) : '',
            feito: !!lead.posDemo[p.key],
            acao: lead.posDemo[p.key] ? null : { label: 'Marcar enviado', attr: `data-enviado="posDemo" data-key="${p.key}"` }
          })).join('')}
          <div class="actions"><button type="button" class="btn primary" data-mover="6">Aceitou o piloto → Etapa 6</button></div>`;
      case 5: {
        const base = lead.primeiraMsgEm || isoDia(lead.ultimoContatoEm || lead.criadoEm);
        const feitos = MSG.followups.filter(f => lead.followups[f.key]).length;
        return `
          <p class="lead-in">Cada follow-up traz algo novo. Depois de 4 tentativas sem resposta, pause o contato por 30 dias.</p>
          <div class="form-grid">${campo(Object.assign({}, lead, { primeiraMsgEm: base }), 'primeiraMsgEm', 'Contagem a partir de (1ª mensagem)', { type: 'date' })}</div>
          ${MSG.followups.map(f => msgBox('m-' + f.key, f.titulo, f.texto, lead, {
            quando: fmtData(addDias(base, f.dia)),
            feito: !!lead.followups[f.key],
            acao: lead.followups[f.key] ? null : { label: 'Marcar enviado', attr: `data-enviado="followups" data-key="${f.key}"` }
          })).join('')}
          <p class="muted small">A mensagem de despedida costuma gerar respostas, porque tira a pressão da conversa.</p>
          <div class="actions">
            <button type="button" class="btn primary" data-mover="2">Respondeu → Etapa 2</button>
            <button type="button" class="btn ${feitos >= 4 ? 'primary' : ''}" data-act="pausar">Pausar 30 dias</button>
          </div>`;
      }
      case 6: {
        const ini = lead.pilotoInicio;
        return `
          <p class="lead-in">O piloto transforma o “preciso pensar” em um “sim” pequeno. O objetivo é gerar um resultado que a própria ${lead.tipo === 'Clínica' ? 'clínica' : 'escola'} possa mostrar.</p>
          <div class="form-grid">
            ${campo(lead, 'grupoPiloto', 'Grupo do piloto', { ph: lead.tipo === 'Clínica' ? 'alguns pacientes' : 'uma turma' })}
            ${campo(lead, 'pilotoInicio', 'Início do piloto', { type: 'date' })}
          </div>
          ${msgBox('m-piloto', 'Proposta do piloto', MSG.piloto, lead)}
          <h4 class="sub-title">Condução</h4>
          <div class="checklist">${PILOTO_PASSOS.map(p => check('piloto', p.key, lead.piloto[p.key], `Dia ${p.dia}: ${p.txt}`, ini ? fmtData(addDias(ini, p.dia - 1)) : '')).join('')}</div>
          <h4 class="sub-title">Fechamento</h4>
          <div class="form-grid">
            ${campo(lead, 'pilotoQtd', `Nº de ${pub} que jogaram`, { type: 'number', attrs: 'min="0" inputmode="numeric"' })}
            ${campo(lead, 'valor', 'Valor do plano', { ph: 'R$ 490/mês' })}
            ${campo(lead, 'acertoAntes', 'Acertos antes (%)', { type: 'number', attrs: 'min="0" max="100" inputmode="numeric"' })}
            ${campo(lead, 'acertoDepois', 'Acertos depois (%)', { type: 'number', attrs: 'min="0" max="100" inputmode="numeric"' })}
          </div>
          ${msgBox('m-fechamento', 'Mensagem de fechamento', MSG.fechamento, lead)}
          <div class="actions">
            <button type="button" class="btn primary" data-mover="7">Fechou! → Cliente</button>
            <button type="button" class="btn" data-objecoes>Ver objeções</button>
          </div>`;
      }
      case 7:
        return `
          <p class="lead-in">Depois de fechar, peça uma indicação. Indicações entram direto no script de WhatsApp com indicação.</p>
          ${msgBox('m-indicacao', 'Pedido de indicação', MSG.indicacao, lead, {
            feito: !!lead.indicacaoPedida,
            acao: lead.indicacaoPedida ? null : { label: 'Pedi indicação', attr: 'data-act="indicacao"' }
          })}
          <div class="actions"><button type="button" class="btn primary" data-act="nova-indicacao">Cadastrar indicação</button></div>`;
    }
    return '';
  }

  function renderLead() {
    const lead = Store.get(ui.leadAberto);
    if (!lead) return;
    const vista = ui.etapaVista ?? lead.etapa;
    const e = etapa(vista);
    const acao = proximaAcao(lead);
    const wa = telWhats(lead.telefone);
    const box = $('#lead-detail');
    const corpo = $('.sheet-body', box);
    const scroll = corpo ? corpo.scrollTop : 0;

    box.innerHTML = `
      <header class="sheet-head lead-head">
        <div class="lead-id">
          <a class="handle big" href="https://instagram.com/${encodeURIComponent(lead.instagram)}" target="_blank" rel="noopener">@${esc(lead.instagram)}</a>
          <h2 id="lead-title">${esc(lead.instituicao)}</h2>
          <p class="muted small">${esc([lead.nome, lead.tipo, CANAIS[lead.canal], lead.cidade].filter(Boolean).join(' · '))}</p>
        </div>
        <button type="button" class="icon-btn" data-close aria-label="Fechar">✕</button>
      </header>
      <div class="sheet-body">
        <div class="quick">
          <a class="btn sm insta" href="https://ig.me/m/${encodeURIComponent(lead.instagram)}" target="_blank" rel="noopener">Direct</a>
          ${wa ? `<a class="btn sm whats" href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
          <button type="button" class="btn sm" data-act="editar">Editar</button>
          ${dots(lead)}
        </div>

        <nav class="stepper" aria-label="Etapas do funil">
          ${ETAPAS.map(s => `<button type="button" class="step c-${s.cor} ${s.id === lead.etapa ? 'current' : ''} ${s.id === vista ? 'viewing' : ''} ${s.id < lead.etapa ? 'past' : ''}" data-ver="${s.id}" aria-current="${s.id === lead.etapa ? 'step' : 'false'}" title="${esc(s.nome)}"><span>${s.id}</span><em>${esc(s.curto)}</em></button>`).join('')}
        </nav>

        ${vista !== lead.etapa ? `<div class="preview-bar"><span>Visualizando <b>${esc(e.nome)}</b> — o lead está em ${esc(etapa(lead.etapa).nome)}.</span><button type="button" class="btn sm primary" data-mover="${vista}">Mover para cá</button></div>` : ''}

        ${acao && vista === lead.etapa ? `<div class="next-box ${diffDias(acao.data) < 0 ? 'late' : diffDias(acao.data) === 0 ? 'today' : ''}"><span>Próxima ação</span><strong>${esc(acao.texto)}</strong><time>${esc(quando(acao.data))}</time></div>` : ''}

        <section class="stage-panel">
          <h3 class="panel-title c-${e.cor}">Etapa ${e.id}: ${esc(e.nome)}</h3>
          ${painelEtapa(lead, vista)}
        </section>

        <section class="status-box">
          <h3 class="sub-title">Situação</h3>
          <div class="form-grid">
            <div class="field">
              <label for="fd-status">Situação</label>
              <select id="fd-status" data-field="status">
                ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${lead.status === k ? 'selected' : ''}>${v}</option>`).join('')}
              </select>
            </div>
            ${lead.status === 'pausado' ? campo(lead, 'retomarEm', 'Retomar em', { type: 'date' }) : ''}
            ${lead.status === 'perdido' ? campo(lead, 'motivoPerda', 'Motivo', { ph: 'não é o momento, preço…' }) : ''}
            ${campo(lead, 'telefone', 'WhatsApp', { type: 'tel', attrs: 'inputmode="tel"' })}
          </div>
        </section>

        <section class="notes">
          <h3 class="sub-title">Anotações e histórico</h3>
          <form class="note-form" data-nota>
            <label class="sr-only" for="nova-nota">Nova anotação</label>
            <textarea id="nova-nota" rows="2" placeholder="O que aconteceu? Ex.: respondeu pedindo preço"></textarea>
            <button type="submit" class="btn sm primary">Anotar</button>
          </form>
          <ul class="timeline">
            ${(lead.historico || []).map(h => `<li><time>${esc(fmtData(h.em, true))}</time><span>${esc(h.txt)}</span></li>`).join('')}
          </ul>
        </section>

        <div class="danger-zone">
          <button type="button" class="btn ghost danger" data-act="excluir">Excluir lead</button>
          <span class="muted small">Criado ${esc(fmtData(lead.criadoEm))} · atualizado ${esc(fmtData(lead.atualizadoEm, true))}</span>
        </div>
      </div>`;

    const novoCorpo = $('.sheet-body', box);
    if (novoCorpo) novoCorpo.scrollTop = scroll;
    destacarRoteiro();
  }

  /* --- timer da demonstração --- */
  function fmtTimer(s) {
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function destacarRoteiro() {
    const n = $('#timer-num');
    if (n) n.textContent = fmtTimer(ui.timer.seg);
    $$('#roteiro li').forEach(li => {
      li.classList.toggle('now', ui.timer.seg >= +li.dataset.de && ui.timer.seg < +li.dataset.ate && (ui.timer.id || ui.timer.seg));
    });
  }

  function timer(acao) {
    if (acao === 'reset') {
      clearInterval(ui.timer.id);
      ui.timer = { seg: 0, id: null };
    } else if (ui.timer.id) {
      clearInterval(ui.timer.id);
      ui.timer.id = null;
    } else {
      ui.timer.id = setInterval(() => { ui.timer.seg++; destacarRoteiro(); }, 1000);
    }
    renderLead();
  }

  /* --- eventos da ficha --- */
  function onLeadClick(ev) {
    const lead = Store.get(ui.leadAberto);
    if (!lead) return;
    const t = ev.target.closest('button, a');
    if (!t) return;
    const d = t.dataset;
    const agora = isoDia(new Date());

    if (d.close !== undefined) { $('#dlg-lead').close(); return; }
    if (d.ver !== undefined) { ui.etapaVista = Number(d.ver) === lead.etapa ? null : Number(d.ver); renderLead(); return; }
    if (d.mover !== undefined) {
      const extra = {};
      if (Number(d.mover) === 6 && !lead.pilotoInicio) extra.pilotoInicio = agora;
      moverEtapa(lead, d.mover, Object.keys(extra).length ? extra : null);
      return;
    }
    if (d.reacao) { atualizar(lead, { reacao: d.reacao, ultimoContatoEm: agora }, 'Reação: ' + MSG.reacao[d.reacao].titulo); return; }
    if (d.copy) { copiar($('#' + d.copy).value); return; }
    if (d.whats) {
      window.open(`https://wa.me/${telWhats(lead.telefone)}?text=${encodeURIComponent($('#' + d.whats).value)}`, '_blank', 'noopener');
      return;
    }
    if (d.direct) {
      copiar($('#' + d.direct).value);
      window.open(`https://ig.me/m/${encodeURIComponent(lead.instagram)}`, '_blank', 'noopener');
      return;
    }
    if (d.enviado) {
      const grupo = Object.assign({}, lead[d.enviado], { [d.key]: agora });
      const item = (d.enviado === 'followups' ? MSG.followups : MSG.posDemo).find(x => x.key === d.key);
      atualizar(lead, { [d.enviado]: grupo, ultimoContatoEm: agora }, `Enviado: ${item.titulo}`);
      return;
    }
    if (d.timer) { timer(d.timer); return; }
    if (d.objecoes !== undefined) { $('#dlg-lead').close(); trocarView('scripts'); return; }

    switch (d.act) {
      case 'editar':
        abrirForm(lead);
        break;
      case 'primeira-enviada':
        atualizar(lead, { primeiraMsgEm: agora, ultimoContatoEm: agora }, '1ª mensagem enviada');
        toast('Anotado. Se não responder em 48h, aparece em Hoje.');
        break;
      case 'vespera':
        atualizar(lead, { vesperaOk: agora }, 'Demo confirmada na véspera');
        break;
      case 'pausar':
        atualizar(lead, { status: 'pausado', retomarEm: isoDia(addDias(new Date(), 30)) }, 'Pausado por 30 dias');
        toast('Pausado por 30 dias');
        break;
      case 'indicacao':
        atualizar(lead, { indicacaoPedida: agora }, 'Indicação pedida');
        break;
      case 'nova-indicacao':
        $('#dlg-lead').close();
        abrirForm(null, { canal: 'wpp_indicacao', indicadoPor: lead.nome ? `${lead.nome} (${lead.instituicao})` : lead.instituicao });
        break;
      case 'excluir': {
        const copia = JSON.parse(JSON.stringify(lead));
        $('#dlg-lead').close();
        Store.remover(lead.id);
        toast(`@${lead.instagram} excluído`, { label: 'Desfazer', fn: () => Store.salvar(copia) });
        break;
      }
    }
  }

  function onLeadChange(ev) {
    const lead = Store.get(ui.leadAberto);
    if (!lead) return;
    const el = ev.target;

    if (el.dataset.check) {
      const grupo = el.dataset.check;
      if (grupo === 'flag') {
        atualizar(lead, { [el.dataset.key]: el.checked ? isoDia(new Date()) : '' });
      } else {
        atualizar(lead, { [grupo]: Object.assign({}, lead[grupo], { [el.dataset.key]: el.checked }) });
      }
      return;
    }
    if (el.dataset.field) {
      const k = el.dataset.field;
      const v = el.value.trim();
      if (lead[k] === v) return;
      const log = k === 'status' ? `Situação: ${STATUS[v]}` : null;
      const mud = { [k]: v };
      if (k === 'status' && v === 'pausado' && !lead.retomarEm) mud.retomarEm = isoDia(addDias(new Date(), 30));
      if (k === 'status' && v === 'ganho') mud.etapa = 7;
      // campos de texto: salva sem redesenhar para não tirar o foco do próximo campo
      if (['text', 'number', 'tel', 'textarea'].includes(el.type) && k !== 'status') {
        Object.assign(lead, mud);
        Store.salvar(lead);
        atualizarMensagens(lead);
        return;
      }
      atualizar(lead, mud, log);
    }
  }

  function atualizarMensagens(lead) {
    $$('#lead-detail textarea[data-tpl]').forEach(ta => {
      if (!ta.dataset.editado) ta.value = preencher(ta.dataset.tpl, lead);
    });
  }

  function onLeadSubmit(ev) {
    if (!ev.target.matches('[data-nota]')) return;
    ev.preventDefault();
    const ta = $('#nova-nota');
    const txt = ta.value.trim();
    if (!txt) return;
    atualizar(Store.get(ui.leadAberto), { ultimoContatoEm: isoDia(new Date()) }, txt);
  }

  /* ================= configurações ================= */

  function abrirSettings() {
    const f = $('#settings-form');
    const s = Store.settings;
    ['meuNome', 'empresa', 'horario1', 'horario2', 'url', 'token'].forEach(k => { f.elements[k].value = s[k] || ''; });
    $('#teste-result').textContent = '';
    $('#dlg-settings').showModal();
  }

  async function testarConexao() {
    const f = $('#settings-form');
    const out = $('#teste-result');
    if (!f.elements.url.value.trim() || !f.elements.token.value.trim()) {
      out.textContent = 'Preencha a URL e o token.';
      return;
    }
    out.textContent = 'Testando…';
    try {
      const r = await Store.testar(f.elements.url.value, f.elements.token.value);
      out.textContent = `Conectado! ${r.total} lead(s) na planilha.`;
    } catch (e) {
      console.error('Teste de conexão falhou', e);
      out.textContent = 'Não conectou. Confira a URL (termina em /exec), o token e se a implantação está como “Qualquer pessoa”.';
    }
  }

  function baixar(nome, conteudo, tipo) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function exportarCSV() {
    const cols = ['instagram', 'instituicao', 'nome', 'tipo', 'canal', 'telefone', 'cidade', 'etapa', 'status', 'detalhe', 'indicadoPor', 'reacao', 'desafio', 'qtdPublico', 'primeiraMsgEm', 'ultimoContatoEm', 'demoEm', 'pilotoInicio', 'valor', 'criadoEm', 'atualizadoEm'];
    const linhas = [cols.concat('proximaAcao', 'prioridade').join(';')].concat(Store.leads.map(l => {
      const a = proximaAcao(l);
      const v = cols.map(c => c === 'etapa' ? etapa(l.etapa).nome : l[c]).concat(a ? `${a.texto} (${isoDia(a.data)})` : '', prioridade(l));
      return v.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';');
    }));
    baixar(`crm-leads-${isoDia(new Date())}.csv`, '﻿' + linhas.join('\r\n'), 'text/csv');
  }

  function importarJSON(ev) {
    const file = ev.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const dados = JSON.parse(r.result);
        const lista = Array.isArray(dados) ? dados : dados.leads;
        if (!Array.isArray(lista)) throw new Error('Formato inválido');
        Store.importar(lista);
        toast(`${lista.length} lead(s) importado(s)`);
      } catch (e) {
        console.error('Falha ao importar', e);
        toast('Arquivo inválido');
      }
      ev.target.value = '';
    };
    r.readAsText(file);
  }

  /* ================= status de sync ================= */

  function renderStatus() {
    const el = $('#sync-status');
    const s = Store.status;
    const n = Store.pendentes;
    const txt = {
      local: 'Local',
      salvando: 'Sincronizando…',
      ok: 'Sincronizado',
      pendente: `${n} pendente${n === 1 ? '' : 's'}`
    }[s];
    el.className = 'sync is-' + s;
    $('.sync-label', el).textContent = txt;
    el.title = s === 'pendente' ? 'Sem conexão com a planilha. Toque para tentar de novo.' : txt;
    $('#banner-local').hidden = Store.conectado();
  }

  /* ================= drag & drop (desktop) ================= */

  function initDnD() {
    const board = $('#board');
    board.addEventListener('dragstart', e => {
      const c = e.target.closest('[data-drag]');
      if (!c) return;
      e.dataTransfer.setData('text/plain', c.dataset.drag);
      e.dataTransfer.effectAllowed = 'move';
      c.classList.add('dragging');
    });
    board.addEventListener('dragend', e => {
      const c = e.target.closest('[data-drag]');
      if (c) c.classList.remove('dragging');
      $$('.col.over').forEach(x => x.classList.remove('over'));
    });
    board.addEventListener('dragover', e => {
      const col = e.target.closest('[data-drop]');
      if (!col) return;
      e.preventDefault();
      $$('.col.over').forEach(x => x !== col && x.classList.remove('over'));
      col.classList.add('over');
    });
    board.addEventListener('drop', e => {
      const col = e.target.closest('[data-drop]');
      if (!col) return;
      e.preventDefault();
      const lead = Store.get(e.dataTransfer.getData('text/plain'));
      if (lead) moverEtapa(lead, col.dataset.drop);
    });
  }

  /* ================= init ================= */

  function init() {
    renderObjecoes();

    $$('.tab').forEach(t => t.addEventListener('click', () => trocarView(t.dataset.view)));
    ['#f-busca', '#f-tipo', '#f-status'].forEach(s => $(s).addEventListener('input', () => { renderFunil(); renderLista(); }));

    document.addEventListener('click', e => {
      const t = e.target;
      const open = t.closest('[data-open]');
      if (open && !t.closest('#lead-detail')) {
        if ($('#dlg-form').open) $('#dlg-form').close();
        abrirLead(open.dataset.open);
        return;
      }
      if (t.closest('[data-novo]')) abrirForm();
      if (t.closest('[data-open-settings]')) abrirSettings();
      const goto = t.closest('[data-goto]');
      if (goto) $('#col-' + goto.dataset.goto).scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      const ct = t.closest('[data-copy-text]');
      if (ct) copiar(ct.dataset.copyText);
    });

    document.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.card[data-open]')) {
        e.preventDefault();
        abrirLead(e.target.dataset.open);
      }
    });

    // fecha diálogos ao tocar fora e pelos botões [data-close]
    $$('dialog').forEach(d => {
      d.addEventListener('click', e => {
        if (e.target === d) d.close();
        if (e.target.closest('[data-close]') && d.id !== 'dlg-lead') d.close();
      });
    });
    $('#dlg-lead').addEventListener('close', () => { ui.leadAberto = null; });

    $('#btn-novo').addEventListener('click', () => abrirForm());
    $('#lead-form').addEventListener('submit', salvarForm);
    $('#lead-form').elements.canal.addEventListener('change', toggleCanal);
    $('#lead-form').elements.instagram.addEventListener('blur', e => { e.target.value = normalizarInstagram(e.target.value); });

    const det = $('#lead-detail');
    det.addEventListener('click', onLeadClick);
    det.addEventListener('change', onLeadChange);
    det.addEventListener('submit', onLeadSubmit);
    det.addEventListener('input', e => { if (e.target.dataset.tpl) e.target.dataset.editado = '1'; });

    $('#btn-settings').addEventListener('click', abrirSettings);
    $('#btn-testar').addEventListener('click', testarConexao);
    $('#settings-form').addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      const antes = Store.settings.url + Store.settings.token;
      Store.salvarSettings(Object.fromEntries(['meuNome', 'empresa', 'horario1', 'horario2', 'url', 'token'].map(k => [k, f.elements[k].value.trim()])));
      $('#dlg-settings').close();
      toast('Configurações salvas');
      if (antes !== Store.settings.url + Store.settings.token) Store.pull();
      render();
    });
    $('#btn-export-csv').addEventListener('click', exportarCSV);
    $('#btn-export-json').addEventListener('click', () => baixar(`crm-backup-${isoDia(new Date())}.json`, JSON.stringify({ leads: Store.leads }, null, 2), 'application/json'));
    $('#in-import').addEventListener('change', importarJSON);
    $('#btn-push-all').addEventListener('click', async () => {
      if (!Store.conectado()) { toast('Configure a URL e o token primeiro'); return; }
      await Store.enviarTudo();
      toast(Store.pendentes ? 'Não foi possível enviar agora' : 'Tudo enviado para a planilha');
    });
    $('#sync-status').addEventListener('click', () => (Store.conectado() ? Store.pull() : abrirSettings()));

    Store.on(tipo => {
      if (tipo === 'status') renderStatus();
      else render();
    });

    initDnD();
    let inicial = 'hoje';
    try { inicial = localStorage.getItem('crm_view') || 'hoje'; } catch (e) { /* padrão */ }
    trocarView(inicial);
    render();
    renderStatus();
    Store.pull();

    window.addEventListener('online', () => Store.flush());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) Store.pull(); });
    setInterval(() => { if (Store.pendentes) Store.flush(); }, 30000);
  }

  init();
})();
