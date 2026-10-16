const AREAS = ["Assistencial", "Operacional", "Administrativo", "Diretoria", "Ocupacional", "Qualidade", "Dados"];
const FALLBACK_AREA = AREAS[0];

const AREA_COLORS = {
  "Assistencial": { color: "#ec4899", bg: "#fce7f3" },
  "Operacional":  { color: "#f97316", bg: "#ffedd5" },
  "Administrativo": { color: "#3b82f6", bg: "#dbeafe" },
  "Diretoria":    { color: "#8b5cf6", bg: "#ede9fe" },
  "Ocupacional":  { color: "#10b981", bg: "#d1fae5" },
  "Qualidade":    { color: "#06b6d4", bg: "#cffafe" },
  "Dados":        { color: "#6366f1", bg: "#e0e7ff" }
};

function normalizeArea(area) {
  const raw = String(area || '').trim();
  if (!raw) return FALLBACK_AREA;
  if (raw === 'Geral') return FALLBACK_AREA;
  return AREAS.includes(raw) ? raw : FALLBACK_AREA;
}

let TAG_COLORS = {
  'Crítico': '#ef4444',
  'Atenção': '#f59e0b',
  'Normal': '#10b981',
  'Planejamento': '#6366f1'
};

const COLUMNS = [
  { key: 'A Fazer', label: 'A FAZER' },
  { key: 'Em Andamento', label: 'EM ANDAMENTO' },
  { key: 'Concluídos', label: 'CONCLUÍDOS' },
  { key: 'Suspenso', label: 'SUSPENSO' },
  { key: 'Cancelado', label: 'CANCELADO' }

];

const ACTIVE_CARD_LIMIT = 10;
let MENTION_USERS = [];

function currentUserName() {
  return window.COMGESTOR_SESSION?.usuario?.nome || 'Usuário Atual';
}

function currentUserEmail() {
  return window.COMGESTOR_SESSION?.usuario?.email || '';
}

let currentArea = AREAS[0];
let isArchivedView = false;
let isMyActionsView = false;
let isTimelineView = false;
let myActionsLayout = 'grid';
let cards = [];
let tempActions = [];
let pendingActionTitle = '';
let pendingActionContext = 'drawer';
let activeCardId = null;
let descriptionSaveTimer = null;
let draggedCardId = null;
let cardWasDragged = false;
let activeActionIndex = null;
let isHistoryExpanded = false;
let mentionRefreshTimer = null;
let mentionRefreshInProgress = false;
const persistedCardSnapshots = new Map();
const queuedCardSnapshots = new Map();
let persistQueue = Promise.resolve();

function readStoredJSON(key, fallback) {
  try {
    const stored = localStorage.getItem(userStorageKey(key));
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    console.warn(`Dados salvos inválidos em ${key}.`, error);
    return fallback;
  }
}

function userStorageKey(key) {
  const email = window.COMGESTOR_SESSION?.usuario?.email;
  return email ? `${key}:${email.toLowerCase()}` : key;
}

function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

function init() {
  const customTags = readStoredJSON('converge_v4_tags', {});
  TAG_COLORS = { ...TAG_COLORS, ...customTags };
  renderAreaPills();
  document.getElementById('fArea').innerHTML = areasDisponiveis().map(a => `<option value="${a}">${a}</option>`).join('');
  renderSubareaOptions();
  renderTagOptions();
  render();
}

function areasDisponiveis() {
  const quadros = window.COMGESTOR_SESSION?.quadros || [];
  return quadros.length ? quadros.map(quadro => quadro.nome) : AREAS;
}

function renderSubareaOptions() {
  const options = [...new Set(cards.map(card => card.subarea).filter(Boolean))];
  document.getElementById('subareaOptions').innerHTML = options.map(subarea => `<option value="${esc(subarea)}"></option>`).join('');
}

function openSettings() {
  if (!window.ComGestorConvex.exigirPermissao('TAG_GERENCIAR')) return;
  renderCustomTags();
  document.getElementById('settingsModal').classList.add('open');
  document.getElementById('overlay').classList.add('open');
  document.getElementById('btnSettings')?.classList.add('active');
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('open');
  if (!document.getElementById('cardDrawer').classList.contains('open') &&
      !document.getElementById('actionModal').classList.contains('open') &&
      !document.getElementById('cardDetailModal').classList.contains('open')) {
    document.getElementById('overlay').classList.remove('open');
  }
  document.getElementById('btnSettings')?.classList.remove('active');
}

function renderTagOptions() {
  const container = document.getElementById('tagOptions');
  container.innerHTML = Object.entries(TAG_COLORS).map(([name, color]) => `
    <div class="tag-option" style="background:${color};" onclick="toggleCardTag('${esc(name)}')">
      <span>${esc(name)}</span><span class="tag-check">✓</span>
    </div>
  `).join('');
}

function renderCustomTags() {
  const container = document.getElementById('customTagsList');
  const customTags = readStoredJSON('converge_v4_tags', {});
  const entries = Object.entries(customTags);
  container.innerHTML = entries.length ? entries.map(([name, color]) => `
    <div class="custom-tag-row">
      <span class="badge-tag" style="background:${color};">${esc(name)}</span>
      <button class="ghost" onclick="removeCustomTag('${esc(name)}')">Remover</button>
    </div>
  `).join('') : '<span class="settings-empty">Nenhuma etiqueta personalizada.</span>';
}

function addCustomTag() {
  if (!window.ComGestorConvex.exigirPermissao('TAG_GERENCIAR')) return;
  const input = document.getElementById('newTagName');
  const name = input.value.trim();
  if (!name) { toast('Informe um nome para a etiqueta.'); return; }
  if (TAG_COLORS[name]) { toast('Essa etiqueta já existe.'); return; }

  const customTags = readStoredJSON('converge_v4_tags', {});
  customTags[name] = document.getElementById('newTagColor').value;
  localStorage.setItem(userStorageKey('converge_v4_tags'), JSON.stringify(customTags));
  TAG_COLORS[name] = customTags[name];
  input.value = '';
  renderCustomTags();
  renderTagOptions();
  toast('Etiqueta criada.');
}

function removeCustomTag(name) {
  if (!window.ComGestorConvex.exigirPermissao('TAG_GERENCIAR')) return;
  const customTags = readStoredJSON('converge_v4_tags', {});
  delete customTags[name];
  localStorage.setItem(userStorageKey('converge_v4_tags'), JSON.stringify(customTags));
  delete TAG_COLORS[name];
  cards.forEach(card => { card.tags = (card.tags || []).filter(tag => tag !== name); });
  saveStorage();
  renderCustomTags();
  renderTagOptions();
  render();
  toast('Etiqueta removida.');
}

function renderAreaPills() {
  const container = document.getElementById('areaPills');
  container.innerHTML = areasDisponiveis().map(a => {
    const areaTheme = getAreaTheme(a);
    const isActive = a === currentArea;
    return `
      <button 
        class="area-pill ${isActive ? 'active' : ''}" 
        onclick="selectArea('${a}')"
        ondragover="event.preventDefault(); this.classList.add('drag-over-pill');"
        ondragleave="this.classList.remove('drag-over-pill');"
        ondrop="handleDropOnArea(event, '${a}')"
      >
        <span class="pill-dot" style="background-color: ${areaTheme.color};"></span>
        <span>${a}</span>
      </button>
    `;
  }).join('');
}

function handleDropOnArea(e, targetArea) {
  e.preventDefault();
  e.target.classList.remove('drag-over-pill');
  if (!window.ComGestorConvex.exigirPermissao('CARD_TRANSFERIR')) return;

  const id = Number(e.dataTransfer.getData('text/plain'));
  const cardIndex = cards.findIndex(c => c.id === id);

  if (cardIndex !== -1) {
    const originalCard = cards[cardIndex];

    if (originalCard.area === targetArea) {
      toast(`O card já pertence à área ${targetArea}.`);
      return;
    }

    if (targetArea === originalCard.area) return;
    moveCardToArea(originalCard, targetArea);
    saveStorage();
    render();
    toast(`Card compartilhado com a área ${targetArea}. A cor original foi mantida.`);
  }
}

function selectArea(area) {
  currentArea = area;
  isArchivedView = false;
  showMainBoardUI();
  renderAreaPills();
  render();
}

function showMainBoard() {
  isArchivedView = false;
  showMainBoardUI();
  render();
}

function showMainBoardUI() {
  isMyActionsView = false;
  isTimelineView = false;
  document.getElementById('pageTitle').textContent = `Área ${currentArea}`;
  document.getElementById('areaSelectorContainer').style.display = 'block';
  document.getElementById('toolbar').style.display = 'flex';
  document.getElementById('btnMainBoard').classList.add('active');
  document.getElementById('btnArchived')?.classList.remove('active');
  document.getElementById('btnMyActions').classList.remove('active');
  document.getElementById('btnTimeline').classList.remove('active');
  document.getElementById('btnSettings')?.classList.remove('active');
}

function showArchivedView() {
  isArchivedView = true;
  isMyActionsView = false;
  isTimelineView = false;
  document.getElementById('pageTitle').textContent = 'Cards Arquivados (Suspenso por tempo indeterminado)';
  document.getElementById('areaSelectorContainer').style.display = 'none';
  document.getElementById('toolbar').style.display = 'none';
  document.getElementById('btnMainBoard').classList.remove('active');
  document.getElementById('btnArchived')?.classList.add('active');
  document.getElementById('btnMyActions').classList.remove('active');
  document.getElementById('btnTimeline').classList.remove('active');
  document.getElementById('btnSettings')?.classList.remove('active');
  render();
}

function showMyActions() {
  isArchivedView = false;
  isMyActionsView = true;
  isTimelineView = false;
  document.getElementById('pageTitle').textContent = 'Minhas ações';
  document.getElementById('areaSelectorContainer').style.display = 'none';
  document.getElementById('toolbar').style.display = 'none';
  document.getElementById('btnMainBoard').classList.remove('active');
  document.getElementById('btnArchived')?.classList.remove('active');
  document.getElementById('btnMyActions').classList.add('active');
  document.getElementById('btnTimeline').classList.remove('active');
  render();
}

function showTimeline() {
  isArchivedView = false;
  isMyActionsView = false;
  isTimelineView = true;
  document.getElementById('pageTitle').textContent = 'Linha do tempo';
  document.getElementById('areaSelectorContainer').style.display = 'none';
  document.getElementById('toolbar').style.display = 'none';
  document.getElementById('btnMainBoard').classList.remove('active');
  document.getElementById('btnArchived')?.classList.remove('active');
  document.getElementById('btnMyActions').classList.remove('active');
  document.getElementById('btnTimeline').classList.add('active');
  document.getElementById('btnSettings')?.classList.remove('active');
  render();
}

function calculateProgress(actions) {
  if (!actions || actions.length === 0) return 0;
  const completed = actions.filter(a => a.completed).length;
  return Math.round((completed / actions.length) * 100);
}

function getCardVisibleAreas(card) {
  const sharedAreas = String(card.sharedWith || '')
    .split(',')
    .map(area => area.trim())
    .filter(Boolean);

  return [...new Set([card.area, ...sharedAreas].filter(Boolean))];
}

function getCardProgress(card) {
  if (card.actions && card.actions.length > 0) return calculateProgress(card.actions);
  if (card.status === 'Em Andamento') return 50;
  if (card.status === 'Concluídos') return 100;
  return 0;
}

function getFarolColorClass(pct) {
  if (pct < 40) return 'bg-red';
  if (pct < 70) return 'bg-yellow';
  return 'bg-green';
}

function getDeadlineStatus(actions, isCompletedCard) {
  if (isCompletedCard) {
    return { type: 'completed', text: '✓ Concluído' };
  }
  if (!actions || actions.length === 0) return null;

  const today = new Date(todayISO());
  let minDaysDiff = Infinity;

  actions.forEach(a => {
    if (!a.completed && a.dueDate) {
      const due = new Date(a.dueDate);
      const diffTime = due - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < minDaysDiff) {
        minDaysDiff = diffDays;
      }
    }
  });

  if (minDaysDiff === Infinity) return { type: 'completed', text: '✓ Ações Concluídas' };

  if (minDaysDiff < 0) {
    return { type: 'expired', text: '⚠️ Prazo encerrado' };
  } else if (minDaysDiff === 0) {
    return { type: 'warning', text: '⏰ Prazo termina em 0 dia(s)' };
  } else {
    return { type: 'ok', text: `⏳ Prazo termina em ${minDaysDiff} dia(s)` };
  }
}

function render() {
  const board = document.getElementById('board');
  const q = document.getElementById('search').value.toLowerCase();
  const mentions = getCurrentUserMentions();
  const mentionCount = mentions.length;
  updateMyActionsBadge(mentionCount);

  if (isMyActionsView) {
    const actions = cards.flatMap(card => (card.actions || []).filter(action =>
      isCurrentUserResponsible(action.responsible) && !action.completed
    ).map(action => ({ card, action })));
    board.style.gridTemplateColumns = 'minmax(0, 1fr)';
    board.innerHTML = `
      <div class="my-actions-panel" data-layout="${myActionsLayout}">
        <div class="my-actions-toolbar" role="group" aria-label="Visualização das minhas ações">
          <button type="button" class="my-actions-view-button ${myActionsLayout === 'list' ? 'active' : ''}" aria-pressed="${myActionsLayout === 'list'}" onclick="setMyActionsLayout('list')">☰ Lista</button>
          <button type="button" class="my-actions-view-button ${myActionsLayout === 'grid' ? 'active' : ''}" aria-pressed="${myActionsLayout === 'grid'}" onclick="setMyActionsLayout('grid')">▦ Grade</button>
        </div>
        <div class="my-actions-section">
        <div class="col-head"><span>PENDÊNCIAS DE ${esc(currentUserName().toUpperCase())}</span><span class="count">${actions.length}</span></div>
        <div class="my-actions-items">${actions.length ? actions.map(({ card, action }) => `<button class="my-action-row" onclick="openCardDetailModal(${card.id})"><strong>${esc(action.title)}</strong><span>${esc(card.title)} · ${esc(card.area)}${card.subarea ? ` / ${esc(card.subarea)}` : ''}</span><small>Prazo: ${esc(action.dueDate)}</small></button>`).join('') : '<p class="empty-state">Nenhuma pendência atribuída a você.</p>'}</div>
        </div>
        <div class="my-actions-section">
        <div class="col-head" style="margin-top:20px;"><span>MENÇÕES E AVISOS PARA VOCÊ</span><span class="count">${mentionCount}</span></div>
        <div class="my-actions-items">${mentionCount ? mentions.map(item => `<button class="my-action-row" onclick="openMentionedCard(${item.card.id}, ${item.actionIndex ?? 'null'})"><strong>${esc(item.context)}</strong><span>${esc(item.card.title)} · ${esc(item.card.area)}${item.card.subarea ? ` / ${esc(item.card.subarea)}` : ''}</span><small>${esc(item.author || 'Usuário')} · ${esc(item.date || '')}</small><span>${esc(item.preview)}</span></button>`).join('') : '<p class="empty-state">Ninguém mencionou você ainda.</p>'}</div>
        </div>
      </div>`;
    return;
  }

  if (isTimelineView) {
    renderTimeline(board);
    return;
  }

  if (isArchivedView) {
    board.style.gridTemplateColumns = 'repeat(5, minmax(200px, 1fr))';
    board.innerHTML = COLUMNS.map(col => {
      const items = cards.filter(c => c.archived && c.status === col.key);
      return `
        <div class="column ${items.length ? 'has-cards' : 'empty-column'}" data-status="${col.key}" ondragover="handleDragOver(event, this)" ondragleave="handleDragLeave(event, this)" ondrop="handleDrop(event, '${col.key}')">
          <div class="col-head">
            <span>${col.label}</span>
            <span class="count">${items.length}</span>
          </div>
          <div class="cards">
            ${items.map(c => cardHTML(c)).join('')}
          </div>
        </div>`;
    }).join('');
    return;
  }

  board.style.gridTemplateColumns = 'repeat(5, minmax(200px, 1fr))';
  const areaCards = cards.filter(c => {
    const visibleAreas = getCardVisibleAreas(c);
    return visibleAreas.includes(currentArea) &&
      (!c.archived || c.status === 'Suspenso' || c.status === 'Cancelado') &&
      (!q || c.title.toLowerCase().includes(q) || (c.actions && c.actions.some(a => a.title.toLowerCase().includes(q))));
  });

  board.innerHTML = COLUMNS.map(col => {
    const items = areaCards.filter(c => c.status === col.key);
    return `
      <div class="column ${items.length ? 'has-cards' : 'empty-column'}" data-status="${col.key}" ondragover="handleDragOver(event, this)" ondragleave="handleDragLeave(event, this)" ondrop="handleDrop(event, '${col.key}')">
        <div class="col-head">
          <span>${col.label}</span>
          <span class="count">${items.length}</span>
        </div>
        <div class="cards">
          ${items.map(c => cardHTML(c)).join('')}
        </div>
      </div>`;
  }).join('');
}

function parseTimelineDate(value) {
  const raw = String(value || '').trim();
  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
  const brazilianDate = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brazilianDate) return `${brazilianDate[3]}-${brazilianDate[2]}-${brazilianDate[1]}`;
  return '';
}

function timelineDateOrdinal(date) {
  const [year, month, day] = date.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function renderTimeline(board) {
  const actions = cards.flatMap(card => (card.actions || []).map((action, index) => {
    const startDate = parseTimelineDate(action.startDate) ||
      parseTimelineDate(action.createdAt) ||
      parseTimelineDate(card.createdAt);
    if (!startDate) return null;
    const dueDate = parseTimelineDate(action.dueDate) ||
      addDays(startDate, Math.max(1, Number(action.days) || 1));
    return { card, action, index, startDate, dueDate };
  }).filter(Boolean));

  board.style.gridTemplateColumns = 'minmax(0, 1fr)';
  if (!actions.length) {
    board.innerHTML = '<section class="timeline-empty"><h2>Nenhuma ação para exibir</h2><p>As ações cadastradas nos cards aparecerão aqui com as datas de início e conclusão previstas.</p></section>';
    return;
  }

  const firstDate = Math.min(...actions.map(item => timelineDateOrdinal(item.startDate)));
  const lastDate = Math.max(...actions.map(item => timelineDateOrdinal(item.dueDate)));
  const start = new Date(firstDate * 86400000);
  const end = new Date(lastDate * 86400000);
  const rangeStart = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1) / 86400000;
  const rangeEnd = Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 1) / 86400000;
  const dayWidth = 28;
  const totalDays = rangeEnd - rangeStart;
  const timelineWidth = totalDays * dayWidth;
  const months = [];
  const dayLabels = [];
  const todayOrdinal = timelineDateOrdinal(todayISO());
  const todayOffset = (todayOrdinal - rangeStart) * dayWidth + dayWidth / 2;
  const todayIsVisible = todayOrdinal >= rangeStart && todayOrdinal < rangeEnd;

  for (let monthDate = new Date(rangeStart * 86400000); monthDate.getTime() < rangeEnd * 86400000;) {
    const year = monthDate.getUTCFullYear();
    const month = monthDate.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    months.push(`<div class="timeline-month" style="width:${daysInMonth * dayWidth}px">${monthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</div>`);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(Date.UTC(year, month, day));
      const dateISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
      const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
      const isToday = dateISO === todayISO();
      dayLabels.push(`<span class="timeline-day ${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}" style="width:${dayWidth}px"${isToday ? ' aria-label="Hoje"' : ''}><small>${weekday}</small><b>${day}</b></span>`);
    }
    monthDate = new Date(Date.UTC(year, month + 1, 1));
  }

  const timelineStyle = `width:${timelineWidth}px;--timeline-day-width:${dayWidth}px`;
  const rows = actions.map(({ card, action, index, startDate, dueDate }) => {
    const areaTheme = getAreaTheme(card.area);
    const offset = (timelineDateOrdinal(startDate) - rangeStart) * dayWidth;
    const duration = Math.max(1, timelineDateOrdinal(dueDate) - timelineDateOrdinal(startDate) + 1) * dayWidth;
    return `
      <div class="timeline-row">
        <button type="button" class="timeline-action-label" style="--area-color:${areaTheme.color};--area-bg:${areaTheme.bg}" onclick="openTimelineAction(${card.id}, ${index})">
          <strong>${esc(action.title)}</strong>
          <span class="timeline-area"><i></i>${esc(card.area)} <span>· ${esc(card.title)}</span></span>
          <small><b>Início</b> ${formatDate(startDate)} <span>→</span> <b>Previsto</b> ${formatDate(dueDate)}</small>
        </button>
        <div class="timeline-track ${todayIsVisible ? 'has-today' : ''}" style="${timelineStyle}${todayIsVisible ? `;--today-offset:${todayOffset}px` : ''}">
          ${todayIsVisible ? '<span class="timeline-today-marker" aria-hidden="true"></span>' : ''}
          <button type="button" class="timeline-bar ${action.completed ? 'completed' : ''}" style="left:${offset}px;width:${duration}px;--area-color:${areaTheme.color}" title="${esc(action.title)} · ${esc(card.area)} · ${formatDate(startDate)} – ${formatDate(dueDate)}" aria-label="Abrir ${esc(action.title)} no card ${esc(card.title)}" onclick="openTimelineAction(${card.id}, ${index})">
            <span>${esc(action.title)}</span>
          </button>
        </div>
      </div>`;
  }).join('');

  board.innerHTML = `
    <section class="timeline-panel">
      <div class="timeline-toolbar">
        <div>
          <h2>Planejamento das ações</h2>
          <p>Compare os prazos por dia. Selecione uma ação para abrir o card correspondente.</p>
        </div>
        <span class="timeline-count">${actions.length} ${actions.length === 1 ? 'ação' : 'ações'}</span>
      </div>
      <div class="timeline-legend"><strong>Áreas</strong>${areasDisponiveis().map(area => {
        const theme = getAreaTheme(area);
        return `<span style="--area-color:${theme.color};--area-bg:${theme.bg}"><i></i>${esc(area)}</span>`;
      }).join('')}</div>
      <div class="timeline-scroll">
        <div class="timeline-grid">
          <div class="timeline-header">
            <strong>Ação</strong>
            <div class="timeline-calendar" style="${timelineStyle}">
              <div class="timeline-months">${months.join('')}</div>
              <div class="timeline-days">${dayLabels.join('')}</div>
            </div>
          </div>
          ${rows}
        </div>
      </div>
    </section>`;
}

function openTimelineAction(cardId, actionIndex) {
  activeActionIndex = actionIndex;
  openCardDetailModal(cardId);
}

function setMyActionsLayout(layout) {
  if (layout !== 'list' && layout !== 'grid') return;
  myActionsLayout = layout;
  if (isMyActionsView) render();
}

function updateMyActionsBadge(mentionCount) {
  const badge = document.getElementById('myActionsBadge');
  const button = document.getElementById('btnMyActions');
  if (!badge || !button) return;
  badge.textContent = mentionCount > 99 ? '99+' : String(mentionCount);
  badge.hidden = mentionCount === 0;
  button.setAttribute(
    'aria-label',
    mentionCount ? `Minhas ações, ${mentionCount} ${mentionCount === 1 ? 'aviso' : 'avisos'} para você` : 'Minhas ações'
  );
}

function isCurrentUserResponsible(responsible) {
  const normalizedResponsible = String(responsible || '').trim().replace(/^@/, '').toLocaleLowerCase();
  return [
    currentUserName(),
    currentUserEmail(),
    'Usuário Atual'
  ].some(identifier => identifier.toLocaleLowerCase() === normalizedResponsible);
}

function containsMention(text, identifier) {
  const escapedIdentifier = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mentionPattern = new RegExp(`(?:^|[^\\p{L}\\p{N}_])@${escapedIdentifier}(?:$|[^\\p{L}\\p{N}_])`, 'iu');
  return mentionPattern.test(stripMarkup(text));
}

function textMentionsCurrentUser(text) {
  const identifiers = [currentUserName(), currentUserEmail()].filter(Boolean);
  return identifiers.some(identifier => containsMention(text, identifier));
}

function commentMentionsCurrentUser(comment) {
  const email = currentUserEmail().toLocaleLowerCase();
  const name = currentUserName().toLocaleLowerCase();
  const recordedMention = (comment.mentions || []).some(mention =>
    Boolean(email && (mention.email || '').toLocaleLowerCase() === email) ||
    Boolean(name && (mention.name || '').toLocaleLowerCase() === name)
  );
  return recordedMention || textMentionsCurrentUser(comment.text);
}

function isCardConclusionReached(card) {
  return card.status === 'Concluídos' ||
    Boolean(card.actions?.length && card.actions.every(action => action.completed));
}

function getCurrentUserMentions() {
  const mentions = [];
  cards.forEach(card => {
    if (isCardConclusionReached(card)) return;

    if (textMentionsCurrentUser(card.title)) {
      const author = card.creator;
      const date = card.createdAt ? formatDate(card.createdAt) : '';
      mentions.push({
        card,
        actionIndex: null,
        context: 'Menção no título do card',
        preview: card.title,
        author,
        date
      });
    }
    if (textMentionsCurrentUser(card.desc)) {
      const author = card.creator;
      const date = card.createdAt ? formatDate(card.createdAt) : '';
      mentions.push({
        card,
        actionIndex: null,
        context: 'Menção na descrição do card',
        preview: stripMarkup(card.desc),
        author,
        date
      });
    }
    (card.comments || []).forEach(comment => {
      if (!commentMentionsCurrentUser(comment)) return;
      mentions.push({
        card,
        actionIndex: null,
        context: 'Menção em comentário do card',
        preview: stripMarkup(comment.text),
        author: displayHistoryAuthor(comment.author),
        date: comment.date
      });
    });
    (card.actions || []).forEach((action, actionIndex) => {
      if (action.completed) return;

      if (isCurrentUserResponsible(action.responsible)) {
        mentions.push({
          card,
          actionIndex,
          context: 'Ação atribuída a você',
          preview: action.title,
          author: displayHistoryAuthor(action.createdBy),
          date: action.createdAt
        });
      }
      if (textMentionsCurrentUser(action.title)) {
        mentions.push({
          card,
          actionIndex,
          context: 'Menção em uma ação',
          preview: action.title,
          author: displayHistoryAuthor(action.createdBy),
          date: action.createdAt
        });
      }
      (action.comments || []).forEach(comment => {
        if (!commentMentionsCurrentUser(comment)) return;
        mentions.push({
          card,
          actionIndex,
          context: `Menção em comentário da ação: ${action.title}`,
          preview: stripMarkup(comment.text),
          author: displayHistoryAuthor(comment.author),
          date: comment.date
        });
      });
    });
  });
  return [...new Map(mentions.map(item => [mentionNotificationKey(item), item])).values()];
}

function mentionNotificationKey(item) {
  return JSON.stringify([
    item.card._convexId || item.card.id,
    item.actionIndex,
    item.context,
    item.author,
    item.date,
    item.preview
  ]);
}

function openMentionedCard(cardId, actionIndex = null) {
  activeActionIndex = actionIndex;
  openCardDetailModal(cardId);
}

function hasLocalCardChanges() {
  return cards.some(card => {
    const key = String(card.id);
    const currentSnapshot = JSON.stringify(card);
    return !card._convexId ||
      persistedCardSnapshots.get(key) !== currentSnapshot ||
      (queuedCardSnapshots.has(key) && queuedCardSnapshots.get(key) !== currentSnapshot);
  });
}

function isCardEditorOpen() {
  return ['cardDrawer', 'cardDetailModal', 'actionModal', 'settingsModal'].some(id =>
    document.getElementById(id)?.classList.contains('open')
  );
}

async function refreshCardsForMentions() {
  if (
    mentionRefreshInProgress ||
    document.visibilityState !== 'visible' ||
    isCardEditorOpen() ||
    hasLocalCardChanges()
  ) return;

  mentionRefreshInProgress = true;
  const sessionEmail = currentUserEmail();
  try {
    const refreshedCards = await window.ComGestorConvex.listarCards(window.COMGESTOR_SESSION.quadros);
    if (
      !refreshedCards.length ||
      sessionEmail !== currentUserEmail() ||
      isCardEditorOpen() ||
      hasLocalCardChanges()
    ) return;

    const refreshedSnapshot = JSON.stringify(refreshedCards);
    if (refreshedSnapshot === JSON.stringify(cards)) return;
    const previousMentionKeys = new Set(getCurrentUserMentions().map(mentionNotificationKey));
    cards = refreshedCards;
    persistedCardSnapshots.clear();
    queuedCardSnapshots.clear();
    for (const card of cards) {
      if (card._convexId) persistedCardSnapshots.set(String(card.id), JSON.stringify(card));
    }
    try {
      localStorage.setItem(userStorageKey('converge_v4_cards'), JSON.stringify(cards));
    } catch (error) {
      console.warn('Não foi possível atualizar o cache local dos cards.', error);
    }
    render();
    const newMentions = getCurrentUserMentions().filter(mention =>
      !previousMentionKeys.has(mentionNotificationKey(mention))
    );
    if (newMentions.length) {
      toast(`Você recebeu ${newMentions.length} ${newMentions.length === 1 ? 'aviso novo' : 'avisos novos'}. Veja em Minhas ações.`);
    }
  } catch (error) {
    console.warn('Não foi possível atualizar as menções recebidas.', error);
  } finally {
    mentionRefreshInProgress = false;
  }
}

function startMentionRefresh() {
  clearInterval(mentionRefreshTimer);
  mentionRefreshTimer = setInterval(refreshCardsForMentions, 30000);
}

function cardHTML(c, isArchived = false) {
  const pct = getCardProgress(c);
  const farolClass = getFarolColorClass(pct);
  const theme = getAreaTheme(getCardOriginArea(c));
  const deadline = getDeadlineStatus(c.actions, c.status === 'Concluídos');
  const isUrgent = c.urgencia === 'Sim';

  const activeDays = c.status === 'Em Andamento' && c.inProgressSince
    ? Math.max(0, Math.floor((new Date(todayISO()) - new Date(c.inProgressSince)) / 86400000))
    : null;

  const tagsHTML = (c.tags || []).map(t => `<span class="badge-tag" style="background:${TAG_COLORS[t] || '#64748b'};">${esc(t)}</span>`).join('');
  const sharedAreas = String(c.sharedWith || '')
    .split(',')
    .map(area => area.trim())
    .filter(Boolean);

  const cardArea = normalizeArea(c.area);

  return `
    <div 
      class="card" 
      style="--area-color: ${theme.color}; --area-bg: ${theme.bg};" 
      draggable="true" 
      ondragstart="startCardDrag(event, ${c.id}, this)" 
      ondragend="finishCardDrag(this)" 
      onclick="openCardFromClick(${c.id})"
    >
      ${deadline ? `<div class="deadline-banner ${deadline.type}">${deadline.text}</div>` : ''}

      <div class="card-header-row">
        <div class="card-title">${esc(c.title)}</div>
      </div>
      <div class="card-desc">${esc(c.desc || 'Sem descrição')}</div>

      <div class="badges">
        <span class="badge-area">${esc(cardArea)}</span>
        <span class="badge ${isUrgent ? 'urgente-sim' : 'urgente-nao'}">Urgência: ${c.urgencia || 'Não'}</span>
        ${c.risco ? `<span class="badge gray">Risco: ${esc(c.risco)}</span>` : ''}
        ${c.esforco ? `<span class="badge gray">Esforço: ${esc(c.esforco)}</span>` : ''}
        ${tagsHTML}
        ${c.subarea ? `<span class="badge gray">↳ ${esc(c.subarea)}</span>` : ''}
        ${sharedAreas.length ? `<span class="badge mirrored">↗ ${esc(sharedAreas.join(', '))}</span>` : ''}
        <span class="badge gray">Criado em: ${formatDate(c.createdAt)}</span>
        ${activeDays !== null ? `<span class="badge active-alert">⏱ ${activeDays} ${activeDays === 1 ? 'dia' : 'dias'} em andamento</span>` : ''}
        <span class="badge gray">☑ ${c.actions ? c.actions.length : 0} ações</span>
      </div>

      <div class="progress-container">
        <div class="progress-label">
          <span>Andamento</span>
          <span class="progress-percentage">${pct}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${farolClass}" style="width: ${pct}%"></div>
        </div>
      </div>

      ${isArchived ? `
        <div style="margin-top:12px;">
          <button class="primary" style="font-size:12px; width:100%; padding:6px 0;" onclick="event.stopPropagation(); reactivateCard(${c.id})">Reativar Card</button>
        </div>` : ''}
    </div>`;
}

function openCardDetailModal(id) {
  activeCardId = id;
  const card = cards.find(c => c.id === id);
  if (!card) return;
  if (card.status === 'A Fazer') {
    if (cards.filter(item => item.area === card.area && item.status === 'Em Andamento' && !item.archived).length >= ACTIVE_CARD_LIMIT) {
      toast(`A área ${card.area} já atingiu o limite de ${ACTIVE_CARD_LIMIT} cards em andamento.`);
    } else {
      addHistory(card, 'Movido de A Fazer para Em Andamento');
      card.inProgressSince = todayISO();
      card.status = 'Em Andamento';

      if (card.mirrorGroupId) {
        cards.forEach(item => {
          if (item.mirrorGroupId === card.mirrorGroupId) {
            item.status = 'Em Andamento';
            item.archived = false;
            item.inProgressSince = card.inProgressSince;
          }
        });
      }

      saveStorage();
      render();
    }
  }

  const areaTheme = getAreaTheme(getCardOriginArea(card));
  document.getElementById('detailHeader').style.background = areaTheme.color;
  document.getElementById('detailHeaderStatus').textContent = card.status.toUpperCase();
  const detailTitle = document.getElementById('detailTitle');
  detailTitle.textContent = card.title;
  detailTitle.dataset.cardId = String(card.id);
  document.getElementById('detailDesc').value = card.desc || '';
  renderCardTags(card.tags || []);
  document.getElementById('detailMeta').innerHTML = `<span><b>Área:</b> ${esc(card.area)}${card.subarea ? ` / ${esc(card.subarea)}` : ''}</span><span><b>Criado em:</b> ${formatDate(card.createdAt)} por ${esc(card.creator || currentUserName())}</span>`;
  setHistoryExpanded(false);
  renderHistory(card);

  renderDetailActions(card);

  renderComments(card.comments || []);

  document.getElementById('overlay').classList.add('open');
  document.getElementById('cardDetailModal').classList.add('open');
}

function setHistoryExpanded(expanded) {
  isHistoryExpanded = expanded;
  const header = document.getElementById('historyToggle');
  const list = document.getElementById('detailHistoryList');
  if (!header || !list) return;

  header.setAttribute('aria-expanded', String(expanded));
  list.classList.toggle('collapsed', !expanded);
  header.querySelector('.history-chevron')?.style.setProperty('transform', expanded ? 'rotate(180deg)' : 'rotate(0deg)');
}

function toggleHistoryExpanded() {
  const nextState = !isHistoryExpanded;
  setHistoryExpanded(nextState);

  const card = cards.find(c => c.id === activeCardId);
  if (card) renderHistory(card);
}

function renderHistory(card) {
  const container = document.getElementById('detailHistoryList');
  const history = getHistoryEntries(card);
  const content = history.length ? history.reverse().map(item => `<div class="history-item"><b>${esc(item.text)}</b><span>${esc(displayHistoryAuthor(item.author))} · ${esc(item.date)}</span></div>`).join('') : '<span class="empty-state">Nenhuma movimentação registrada.</span>';
  container.innerHTML = content;
  setHistoryExpanded(isHistoryExpanded);
}

function displayHistoryAuthor(author) {
  return !author || author === 'Usuário Atual' ? currentUserName() : author;
}

function getHistoryEntries(card) {
  const entries = [...(card.history || [])];
  (card.comments || []).forEach(comment => {
    entries.push({
      text: `Comentário no card: ${stripMarkup(comment.text)}`,
      author: comment.author,
      date: comment.date
    });
  });
  (card.actions || []).forEach(action => {
    if (action.createdAt) {
      entries.push({
        text: `Plano de ação criado: ${action.title} · Responsável: ${action.responsible}`,
        author: action.createdBy || currentUserName(),
        date: action.createdAt
      });
    }
    (action.comments || []).forEach(comment => {
      entries.push({
        text: `Comentário na ação “${action.title}”: ${stripMarkup(comment.text)}`,
        author: comment.author,
        date: comment.date
      });
    });
  });
  return entries.filter((entry, index, list) => list.findIndex(item => item.text === entry.text && item.author === entry.author && item.date === entry.date) === index);
}

function stripMarkup(value) {
  const template = document.createElement('template');
  template.innerHTML = value || '';
  return template.content.textContent.trim();
}

function renderDetailActions(card) {
  const progress = getCardProgress(card);
  const progressFill = document.getElementById('detailActionProgressFill');
  const progressValue = document.getElementById('detailActionProgressValue');
  progressFill.style.width = `${progress}%`;
  progressFill.className = `progress-fill ${getFarolColorClass(progress)}`;
  progressValue.textContent = `${progress}%`;

  const actionsList = document.getElementById('detailActionsList');
  if (card.actions && card.actions.length > 0) {
    actionsList.innerHTML = card.actions.map((a, idx) => `
      <div class="action-item action-item-clickable" onclick="openActionDetail(${idx})">
        <div style="font-weight: bold; font-size: 13px; display:flex; align-items:center; gap:8px;">
          <input type="checkbox" ${a.completed ? 'checked' : ''} onclick="event.stopPropagation()" onchange="toggleModalAction(${idx})">
          <span style="${a.completed ? 'text-decoration:line-through; color:var(--muted)' : ''}">${esc(a.title)}</span>
        </div>
        <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">
          Resp: <b>${esc(a.responsible)}</b> | Prazo: ${a.dueDate} (${a.days} dias)
        </div>
        ${activeActionIndex === idx ? renderInlineActionDetail(a, idx) : ''}
      </div>
    `).join('');
  } else {
    actionsList.innerHTML = '<div style="font-size: 12px; color: var(--muted);">Nenhuma ação cadastrada.</div>';
  }
}

function renderInlineActionDetail(action, index) {
  const attachments = action.attachments || [];
  return `
    <div class="inline-action-detail" onclick="event.stopPropagation()">
      <div class="action-detail-meta">Responsável: <b>${esc(action.responsible)}</b> · Prazo: <b>${esc(action.dueDate)}</b></div>
      <div class="action-attachment-tools">
        <input id="actionFile-${index}" type="file">
        <input id="actionLink-${index}" placeholder="Cole um link da ação">
      </div>
      <div class="inline-action-attachments">
        ${attachments.length ? attachments.map(attachment => `<a href="${esc(attachment.url)}" ${attachment.type === 'file' ? `download="${esc(attachment.name)}"` : 'target="_blank" rel="noopener noreferrer"'}>${attachment.type === 'file' ? '📎' : '🔗'} ${esc(attachment.name)}</a>`).join('') : '<span>Nenhum anexo nesta ação.</span>'}
      </div>
      <div class="comment-input-box action-comment-box">
        <div class="comment-toolbar">
          <span onmousedown="event.preventDefault()" onclick="formatActionComment('Tt')"><b>Tt</b></span>
          <span onmousedown="event.preventDefault()" onclick="formatActionComment('B')"><b>B</b></span>
          <span onmousedown="event.preventDefault()" onclick="formatActionComment('I')"><i>I</i></span>
          <span onmousedown="event.preventDefault()" onclick="formatActionComment('Quote')">❞</span>
        </div>
        <div class="mention-editor-wrap">
          <div id="actionCommentText" class="rich-comment-editor" contenteditable="true" data-placeholder="Escreva um comentário..." oninput="handleMentionInput(event, 'actionCommentText', 'actionCommentMentionSuggestions')" onkeydown="handleMentionKeydown(event, 'actionCommentText', 'actionCommentMentionSuggestions')"></div>
          <div id="actionCommentMentionSuggestions" class="mention-suggestions" role="listbox" aria-label="Pessoas para mencionar"></div>
        </div>
      </div>
      <button type="button" class="primary" onclick="addActionComment()">Salvar Comentário</button>
      <div class="comment-list action-comment-list" id="actionCommentsList"></div>
    </div>`;
}

function openActionDetail(index) {
  const card = cards.find(c => c.id === activeCardId);
  const action = card?.actions?.[index];
  if (!action) return;

  activeActionIndex = activeActionIndex === index ? null : index;
  renderDetailActions(card);
  if (activeActionIndex !== null) renderActionComments(action.comments || []);
}

function closeActionDetail() {
  const actionModal = document.getElementById('actionDetailModal');
  if (actionModal) actionModal.classList.remove('open');
  activeActionIndex = null;
  const card = cards.find(c => c.id === activeCardId);
  if (card) renderDetailActions(card);
}

function renderActionComments(comments) {
  const container = document.getElementById('actionCommentsList');
  if (!comments.length) {
    container.innerHTML = '<div class="action-comments-empty">Nenhum comentário nesta ação.</div>';
    return;
  }

  container.innerHTML = comments.map(comment => `
    <div class="comment-item">
      <div class="avatar">UA</div>
      <div class="comment-content">
        <div><span class="comment-author">${esc(comment.author)}</span><span class="comment-date">${esc(comment.date)}</span></div>
        <div class="comment-bubble">${renderRichComment(comment.text)}</div>
        ${comment.attachment ? `<a class="comment-attachment-link" href="${esc(comment.attachment.url)}" ${comment.attachment.type === 'file' ? `download="${esc(comment.attachment.name)}"` : 'target="_blank" rel="noopener noreferrer"'}>${comment.attachment.type === 'file' ? '📎 Baixar arquivo' : '🔗 Abrir link'}: ${esc(comment.attachment.name)}</a>` : ''}
      </div>
    </div>
  `).join('');
}

function formatActionComment(type) {
  formatRichComment('actionCommentText', type);
}

function saveCommentOnEnter(event, saveFunction) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    saveFunction();
  }
}

function addActionComment() {
  if (!window.ComGestorConvex.exigirPermissao('COMENTARIO_CRIAR')) return;
  const card = cards.find(c => c.id === activeCardId);
  const action = card?.actions?.[activeActionIndex];
  const editor = document.getElementById('actionCommentText');
  const text = editor.textContent.trim();
  const html = editor.innerHTML.trim();
  const fileInput = document.getElementById(`actionFile-${activeActionIndex}`);
  const linkInput = document.getElementById(`actionLink-${activeActionIndex}`);
  const file = fileInput?.files?.[0];
  const linkValue = linkInput?.value.trim();
  if (!action || (!text && !file && !linkValue)) {
    toast('Escreva um comentário ou adicione um anexo/link.');
    return;
  }

  const saveChanges = fileData => {
    const savedAttachments = [];
    if (text) {
      if (!action.comments) action.comments = [];
      const now = new Date();
      const actionComment = {
        author: currentUserName(),
        date: now.toLocaleDateString('pt-BR') + ', ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        text: html,
        mentions: extractMentions(text)
      };
      action.comments.unshift(actionComment);
      addHistory(card, `Comentário na ação “${action.title}”: ${stripMarkup(html)}`, actionComment.author, actionComment.date);
    }

    if (!action.attachments) action.attachments = [];
    if (fileData) {
      const attachment = { type: 'file', name: file.name, url: fileData };
      action.attachments.push(attachment);
      savedAttachments.push(attachment);
    }
    if (linkValue) {
      const normalizedLink = /^https?:\/\//i.test(linkValue) ? linkValue : `https://${linkValue}`;
      try {
        const parsedLink = new URL(normalizedLink);
        if (!['http:', 'https:'].includes(parsedLink.protocol)) throw new Error('invalid protocol');
        const attachment = { type: 'link', name: parsedLink.href, url: parsedLink.href };
        action.attachments.push(attachment);
        savedAttachments.push(attachment);
      } catch {
        toast('Cole um link válido.');
        return;
      }
    }

    addAttachmentActivities(action, savedAttachments);
    saveStorage();
    editor.innerHTML = '';
    if (linkInput) linkInput.value = '';
    if (fileInput) fileInput.value = '';
    renderDetailActions(card);
    renderActionComments(action.comments || []);
    renderHistory(card);
    toast('Alterações salvas!');
  };

  if (file) {
    const reader = new FileReader();
    reader.onload = () => saveChanges(reader.result);
    reader.onerror = () => toast('Não foi possível ler este arquivo.');
    reader.readAsDataURL(file);
  } else {
    saveChanges(null);
  }
}

function addAttachmentActivities(action, attachments) {
  if (!attachments.length) return;
  if (!action.comments) action.comments = [];
  const now = new Date();
  const date = now.toLocaleDateString('pt-BR') + ', ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  attachments.forEach(attachment => {
    const card = cards.find(item => item.id === activeCardId);
    if (card) addHistory(card, `${attachment.type === 'file' ? 'Arquivo' : 'Link'} adicionado à ação “${action.title}”: ${attachment.name}`, currentUserName(), date);
    action.comments.unshift({
      author: currentUserName(),
      date,
      text: attachment.type === 'file' ? 'Arquivo anexado à ação.' : 'Link anexado à ação.',
      attachment
    });
  });
}

function addActionAttachment(index, input) {
  if (!window.ComGestorConvex.exigirPermissao('ANEXO_GERENCIAR')) return;
  const card = cards.find(c => c.id === activeCardId);
  const action = card?.actions?.[index];
  const file = input.files?.[0];
  if (!action || !file) return;

  const reader = new FileReader();
  reader.onload = () => {
    if (!action.attachments) action.attachments = [];
    const attachment = { type: 'file', name: file.name, url: reader.result };
    action.attachments.push(attachment);
    addAttachmentActivities(action, [attachment]);
    saveStorage();
    renderDetailActions(card);
    renderActionComments(action.comments || []);
    toast('Arquivo anexado à ação!');
  };
  reader.onerror = () => toast('Não foi possível ler este arquivo.');
  reader.readAsDataURL(file);
}

function addActionLink(index) {
  if (!window.ComGestorConvex.exigirPermissao('ANEXO_GERENCIAR')) return;
  const card = cards.find(c => c.id === activeCardId);
  const action = card?.actions?.[index];
  const input = document.getElementById(`actionLink-${index}`);
  const value = input?.value.trim();
  if (!action || !value) return;

  const normalizedLink = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let parsedLink;
  try { parsedLink = new URL(normalizedLink); } catch { parsedLink = null; }
  if (!parsedLink || !['http:', 'https:'].includes(parsedLink.protocol)) {
    toast('Cole um link válido.');
    return;
  }

  if (!action.attachments) action.attachments = [];
  const attachment = { type: 'link', name: parsedLink.href, url: parsedLink.href };
  action.attachments.push(attachment);
  addAttachmentActivities(action, [attachment]);
  saveStorage();
  renderDetailActions(card);
  renderActionComments(action.comments || []);
  toast('Link anexado à ação!');
}

function updateDetailDescription() {
  const card = cards.find(c => c.id === activeCardId);
  if (!card) return;

  card.desc = document.getElementById('detailDesc').value;
  if (card.mirrorGroupId) {
    cards.forEach(c => {
      if (c.mirrorGroupId === card.mirrorGroupId) c.desc = card.desc;
    });
  }
  clearTimeout(descriptionSaveTimer);
  descriptionSaveTimer = setTimeout(saveStorage, 250);
}

function refreshAfterDescriptionEdit() {
  clearTimeout(descriptionSaveTimer);
  const card = cards.find(c => c.id === activeCardId);
  if (card) addHistory(card, 'Descrição do card atualizada', currentUserName());
  saveStorage();
  render();
}

function toggleModalAction(idx) {
  const card = cards.find(c => c.id === activeCardId);
  if (card && card.actions[idx]) {
    if (card.status === 'Concluídos' && card.creator !== currentUserEmail() && card.creator !== currentUserName()) {
      toast(`Somente ${card.creator || 'quem criou o card'} pode concluir este card.`);
      openCardDetailModal(activeCardId);
      return;
    }
    card.actions[idx].completed = !card.actions[idx].completed;
    const action = card.actions[idx];
    addHistory(card, `${action.completed ? 'Plano de ação concluído' : 'Plano de ação reaberto'}: ${action.title}`, currentUserName());
    syncCardStatusWithActions(card);
    
    if (card.mirrorGroupId) {
      cards.forEach(c => {
        if (c.mirrorGroupId === card.mirrorGroupId) {
          c.actions = card.actions;
          c.status = card.status;
          c.inProgressSince = card.inProgressSince;
        }
      });
    }

    saveStorage();
    openCardDetailModal(activeCardId);
    render();
  }
}

function syncCardStatusWithActions(card) {
  if (!card.actions?.length || !['A Fazer', 'Em Andamento', 'Concluídos'].includes(card.status)) return;

  const allActionsCompleted = card.actions.every(action => action.completed);
  const nextStatus = allActionsCompleted
    ? 'Concluídos'
    : card.status === 'Concluídos' ? 'Em Andamento' : card.status;
  if (nextStatus === card.status) return;

  addHistory(card, `Movido de ${card.status} para ${nextStatus}`, currentUserName());
  card.status = nextStatus;
  card.inProgressSince = nextStatus === 'Em Andamento' ? todayISO() : '';
}

function togglePopover(id) {
  const popover = document.getElementById(id);
  const isOpen = popover.classList.contains('open');
  document.querySelectorAll('.popover').forEach(p => p.classList.remove('open'));
  if (!isOpen) {
    const triggerIds = {
      popoverTags: 'tagsTrigger',
      popoverLocation: 'locationTrigger',
      popoverAttachment: 'attachmentTrigger'
    };
    const trigger = document.getElementById(triggerIds[id]);
    if (!trigger) return;
    const triggerRect = trigger.getBoundingClientRect();
    const left = Math.min(triggerRect.left, window.innerWidth - popover.offsetWidth - 8);
    const top = Math.min(triggerRect.bottom + 6, window.innerHeight - 220);
    popover.style.left = `${Math.max(8, left)}px`;
    popover.style.top = `${Math.max(8, top)}px`;
    popover.classList.add('open');
  }
}

function openPopover(id) {
  const popover = document.getElementById(id);
  if (!popover) return;
  document.querySelectorAll('.popover').forEach(item => item.classList.remove('open'));
  const triggerIds = {
    popoverTags: 'tagsTrigger',
    popoverLocation: 'locationTrigger',
    popoverAttachment: 'attachmentTrigger'
  };
  const trigger = document.getElementById(triggerIds[id]);
  const triggerRect = trigger?.getBoundingClientRect();
  const left = triggerRect ? Math.min(triggerRect.left, window.innerWidth - 276) : 16;
  const top = triggerRect ? Math.min(triggerRect.bottom + 8, window.innerHeight - 230) : 100;
  popover.style.left = `${Math.max(8, left)}px`;
  popover.style.top = `${Math.max(8, top)}px`;
  popover.classList.add('open');
}

function closePopover(id) {
  document.getElementById(id).classList.remove('open');
}

function renderCardTags(tags) {
  const container = document.getElementById('detailTagsContainer');
  container.innerHTML = tags.map(t => `<span class="badge-tag" style="background:${TAG_COLORS[t] || '#64748b'};">${esc(t)}</span>`).join('');
}

function toggleCardTag(tag) {
  if (!window.ComGestorConvex.exigirPermissao('CARD_EDITAR')) return;
  const card = cards.find(c => c.id === activeCardId);
  if (card) {
    if (!card.tags) card.tags = [];
    const index = card.tags.indexOf(tag);
    if (index > -1) card.tags.splice(index, 1);
    else card.tags.push(tag);

    if (card.mirrorGroupId) {
      cards.forEach(c => { if (c.mirrorGroupId === card.mirrorGroupId) c.tags = card.tags; });
    }

    saveStorage();
    renderCardTags(card.tags);
    render();
  }
}

function addLocation() {
  const loc = document.getElementById('locationInput').value.trim();
  if (!loc) {
    toast('Digite um lugar ou endereço.');
    return;
  }

  const card = cards.find(c => c.id === activeCardId);
  if (!card) {
    toast('Abra um card antes de salvar a localização.');
    return;
  }

  card.location = loc;
  if (card.mirrorGroupId) {
    cards.forEach(c => { if (c.mirrorGroupId === card.mirrorGroupId) c.location = loc; });
  }
  saveStorage();
  renderLocationDisplay(loc);
  closePopover('popoverLocation');
  render();
  toast('Localização salva!');
}

function openGoogleMapsSearch() {
  const location = document.getElementById('locationInput').value.trim();
  if (!location) {
    toast('Digite um lugar ou endereço para abrir no mapa.');
    return;
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  const mapWindow = window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  if (!mapWindow) window.location.assign(mapsUrl);
}

function openLocationModal() {
  const card = cards.find(c => c.id === activeCardId);
  document.getElementById('locationSearchInput').value = card?.location || '';
  updateLocationSearchLink();
  document.getElementById('overlay').classList.add('open');
  document.getElementById('locationSearchModal').classList.add('open');
  setTimeout(() => document.getElementById('locationSearchInput').focus(), 0);
}

function closeLocationModal() {
  document.getElementById('locationSearchModal').classList.remove('open');
  if (!document.getElementById('cardDetailModal').classList.contains('open') &&
  !(document.getElementById('actionDetailModal')?.classList.contains('open'))) {
    document.getElementById('overlay').classList.remove('open');
  }
}

function updateLocationSearchLink() {
  const place = document.getElementById('locationSearchInput').value.trim();
  document.getElementById('locationSearchButton').href = place
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`
    : 'https://www.google.com/maps';
}

function validateLocationSearch(event) {
  if (!document.getElementById('locationSearchInput').value.trim()) {
    event.preventDefault();
    toast('Digite um local antes de consultar.');
    return false;
  }
  return true;
}

function consultLocation() {
  const input = document.getElementById('locationSearchInput');
  if (!input.value.trim()) {
    toast('Digite um local antes de consultar.');
    return;
  }
  document.getElementById('locationSearchButton').click();
}

function updateMapsLink() {
  const location = document.getElementById('locationInput').value.trim();
  const link = document.getElementById('mapsSearchLink');
  link.href = location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
    : 'https://www.google.com/maps';
}

function validateMapsLink(event) {
  if (!document.getElementById('locationInput').value.trim()) {
    event.preventDefault();
    toast('Digite um lugar ou endereço para abrir no mapa.');
    return false;
  }
  return true;
}

function renderLocationDisplay(loc) {
  const container = document.getElementById('locationDisplay');
  if (loc) {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`;
    container.innerHTML = `
      <div style="font-size:12px; background:#e0f2fe; color:#0369a1; padding:8px 12px; border-radius:6px; display:flex; align-items:center; justify-content:space-between;">
        <span>📍 <b>Local:</b> ${esc(loc)}</span>
        <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="color:#0284c7; font-weight:bold; text-decoration:none;">Abrir no Google Maps ↗</a>
      </div>`;
  } else {
    container.innerHTML = '';
  }
}

function openAttachmentModal() {
  document.getElementById('modalFileAttachmentInput').value = '';
  document.getElementById('modalLinkAttachmentInput').value = '';
  document.getElementById('overlay').classList.add('open');
  document.getElementById('attachmentModal').classList.add('open');
}

function openAttachmentPicker() {
  const fileInput = document.getElementById('directFileAttachmentInput');
  fileInput.value = '';
  fileInput.click();
}

function closeAttachmentModal() {
  document.getElementById('attachmentModal').classList.remove('open');
  if (!document.getElementById('cardDetailModal').classList.contains('open')) {
    document.getElementById('overlay').classList.remove('open');
  }
}

function addAttachment(fileId = 'fileAttachmentInput', linkId = 'linkAttachmentInput', closeId = 'popoverAttachment') {
  const fileInput = document.getElementById(fileId);
  const linkInput = document.getElementById(linkId).value.trim();
  const card = cards.find(c => c.id === activeCardId);

  if (!card) { toast('Abra um card antes de adicionar um anexo.'); return; }
  if (!card.attachments) card.attachments = [];

  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      card.attachments.push({ type: 'file', name: file.name, url: reader.result });
      finishAttachmentSave(card, fileId, linkId, closeId);
    };
    reader.onerror = () => toast('Não foi possível ler este arquivo.');
    reader.readAsDataURL(file);
    return;
  } else if (linkInput) {
    const normalizedLink = /^https?:\/\//i.test(linkInput) ? linkInput : `https://${linkInput}`;
    let parsedLink;
    try { parsedLink = new URL(normalizedLink); } catch { parsedLink = null; }
    if (!parsedLink || !['http:', 'https:'].includes(parsedLink.protocol)) {
      toast('Cole um link válido começando com http:// ou https://.');
      return;
    }
    card.attachments.push({ type: 'link', name: parsedLink.href, url: parsedLink.href });
  } else {
    toast('Selecione um arquivo ou cole um link.');
    return;
  }

  finishAttachmentSave(card, fileId, linkId, closeId);
}

function finishAttachmentSave(card, fileId, linkId, closeId) {
  if (card.mirrorGroupId) {
    cards.forEach(c => { if (c.mirrorGroupId === card.mirrorGroupId) c.attachments = card.attachments; });
  }

  saveStorage();
  renderAttachments(card.attachments);
  render();
  document.getElementById(linkId).value = '';
  document.getElementById(fileId).value = '';
  if (closeId === 'attachmentModal') closeAttachmentModal();
  else closePopover(closeId);
  toast('Anexo adicionado!');
}

function renderAttachments(attachments) {
  const container = document.getElementById('detailAttachmentsList');
  if (!attachments || attachments.length === 0) {
    container.innerHTML = '<div style="font-size:12px; color:var(--muted)">Nenhum anexo ou link cadastrado.</div>';
    return;
  }

  container.innerHTML = attachments.map(att => `
    <div class="attachment-item">
      <span>${att.type === 'file' ? '📁' : '🔗'} ${esc(att.name)}</span>
      ${att.url ? `<a href="${esc(att.url)}" ${att.type === 'file' ? `download="${esc(att.name)}"` : 'target="_blank" rel="noopener noreferrer"'} style="color:var(--primary); font-weight:bold; font-size:11px;">${att.type === 'file' ? 'Baixar arquivo' : 'Acessar Link'}</a>` : '<span style="color:var(--muted); font-size:11px;">Arquivo indisponível</span>'}
    </div>
  `).join('');
}

function formatComment(type) {
  formatRichComment('newCommentText', type);
}

let mentionSelectionIndex = 0;

function getMentionQuery(editor) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return null;
  const caretRange = selection.getRangeAt(0).cloneRange();
  const beforeCaret = caretRange.cloneRange();
  beforeCaret.selectNodeContents(editor);
  beforeCaret.setEnd(caretRange.startContainer, caretRange.startOffset);
  const match = beforeCaret.toString().match(/(?:^|\s)@([^\s@]*)$/);
  return match ? match[1].toLowerCase() : null;
}

function handleMentionInput(event, editorId = 'newCommentText', suggestionsId = 'mentionSuggestions') {
  const editor = document.getElementById(editorId);
  const query = getMentionQuery(editor);
  const container = document.getElementById(suggestionsId);
  if (query === null) {
    container.classList.remove('open');
    return;
  }

  const matches = MENTION_USERS.filter(user => user.name.toLowerCase().includes(query));
  mentionSelectionIndex = 0;
  container.innerHTML = matches.length ? matches.map((user, index) => `
    <button type="button" class="mention-option ${index === 0 ? 'active' : ''}" data-user-index="${MENTION_USERS.indexOf(user)}">
      <strong>@${esc(user.name)}</strong><small>${esc(user.area)} · ${esc(user.email)}</small>
    </button>
  `).join('') : '<div class="empty-state" style="padding:8px 10px;">Nenhuma pessoa encontrada.</div>';
  container.querySelectorAll('.mention-option').forEach(option => {
    option.addEventListener('mousedown', clickEvent => {
      clickEvent.preventDefault();
      const user = MENTION_USERS[Number(option.dataset.userIndex)];
      insertMention(user.name, editorId, suggestionsId);
    });
  });
  container.classList.add('open');
}

function handleMentionKeydown(event, editorId = 'newCommentText', suggestionsId = 'mentionSuggestions') {
  const container = document.getElementById(suggestionsId);
  if (container.classList.contains('open')) {
    const options = [...container.querySelectorAll('.mention-option')];
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!options.length) return;
      mentionSelectionIndex = (mentionSelectionIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options.forEach((option, index) => option.classList.toggle('active', index === mentionSelectionIndex));
      return;
    }
    if (event.key === 'Enter' && options.length) {
      event.preventDefault();
      const user = MENTION_USERS[Number(options[mentionSelectionIndex].dataset.userIndex)];
      insertMention(user.name, editorId, suggestionsId);
      return;
    }
    if (event.key === 'Escape') {
      container.classList.remove('open');
      return;
    }
  }
  saveCommentOnEnter(event, editorId === 'actionCommentText' ? addActionComment : addComment);
}

function insertMention(name, editorId = 'newCommentText', suggestionsId = 'mentionSuggestions') {
  const editor = document.getElementById(editorId);
  const selection = window.getSelection();
  if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return;
  const caretRange = selection.getRangeAt(0).cloneRange();
  const beforeCaret = caretRange.cloneRange();
  beforeCaret.selectNodeContents(editor);
  beforeCaret.setEnd(caretRange.startContainer, caretRange.startOffset);
  const beforeCursor = beforeCaret.toString();
  const match = beforeCursor.match(/(?:^|\s)@[^\s@]*$/);
  if (!match) return;
  const startOffset = beforeCursor.length - match[0].length + (match[0].startsWith(' ') ? 1 : 0);
  const textNodes = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let startNode = null;
  let startNodeOffset = 0;
  let textNode;
  while ((textNode = textNodes.nextNode())) {
    if (startOffset <= currentOffset + textNode.textContent.length) {
      startNode = textNode;
      startNodeOffset = startOffset - currentOffset;
      break;
    }
    currentOffset += textNode.textContent.length;
  }
  if (!startNode) return;
  const range = document.createRange();
  range.setStart(startNode, startNodeOffset);
  range.setEnd(caretRange.startContainer, caretRange.startOffset);
  range.deleteContents();
  range.insertNode(document.createTextNode(`@${name} `));
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  document.getElementById(suggestionsId).classList.remove('open');
  editor.focus();
}

function handleTextMentionInput(event, inputId, suggestionsId) {
  const input = document.getElementById(inputId);
  const container = document.getElementById(suggestionsId);
  const beforeCursor = input.value.slice(0, input.selectionStart);
  const match = beforeCursor.match(/(?:^|\s)@([^\s@]*)$/);
  if (!match) {
    container.classList.remove('open');
    return;
  }

  const query = match[1].toLowerCase();
  const matches = MENTION_USERS.filter(user => user.name.toLowerCase().includes(query));
  mentionSelectionIndex = 0;
  container.innerHTML = matches.length ? matches.map((user, index) => `
    <button type="button" class="mention-option ${index === 0 ? 'active' : ''}" data-user-index="${MENTION_USERS.indexOf(user)}">
      <strong>@${esc(user.name)}</strong><small>${esc(user.area)} · ${esc(user.email)}</small>
    </button>
  `).join('') : '<div class="empty-state" style="padding:8px 10px;">Nenhuma pessoa encontrada.</div>';
  container.querySelectorAll('.mention-option').forEach(option => {
    option.addEventListener('mousedown', clickEvent => {
      clickEvent.preventDefault();
      insertTextMention(input, container, MENTION_USERS[Number(option.dataset.userIndex)]);
    });
  });
  container.classList.add('open');
}

function handleTextMentionKeydown(event, inputId, suggestionsId) {
  const container = document.getElementById(suggestionsId);
  if (container.classList.contains('open')) {
    const options = [...container.querySelectorAll('.mention-option')];
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!options.length) return;
      mentionSelectionIndex = (mentionSelectionIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options.forEach((option, index) => option.classList.toggle('active', index === mentionSelectionIndex));
      return;
    }
    if (event.key === 'Enter' && options.length) {
      event.preventDefault();
      const input = document.getElementById(inputId);
      const user = MENTION_USERS[Number(options[mentionSelectionIndex].dataset.userIndex)];
      insertTextMention(input, container, user);
      return;
    }
    if (event.key === 'Escape') {
      container.classList.remove('open');
      return;
    }
  }
}

function insertTextMention(input, container, user) {
  if (!user) return;
  const cursor = input.selectionStart;
  const beforeCursor = input.value.slice(0, cursor);
  const match = beforeCursor.match(/(?:^|\s)@[^\s@]*$/);
  if (!match) return;
  const start = cursor - match[0].length + (match[0].startsWith(' ') ? 1 : 0);
  const mention = `@${user.name} `;
  input.value = `${input.value.slice(0, start)}${mention}${input.value.slice(cursor)}`;
  const nextCursor = start + mention.length;
  input.setSelectionRange(nextCursor, nextCursor);
  container.classList.remove('open');
  input.focus();
}

function extractMentions(text) {
  return MENTION_USERS.filter(user => containsMention(text, user.name)).map(user => ({
    name: user.name,
    email: user.email,
    area: user.area,
    read: false
  }));
}

function handleShareMentionInput() {
  const input = document.getElementById('shareWithInput');
  const container = document.getElementById('shareMentionSuggestions');
  const match = input.value.match(/(?:^|,)\s*@([^\s,]*)$/);
  if (!match) {
    container.classList.remove('open');
    return;
  }
  const query = match[1].toLowerCase();
  const matches = MENTION_USERS.filter(user => user.name.toLowerCase().includes(query));
  container.innerHTML = matches.length ? matches.map(user => `
    <button type="button" class="mention-option" onmousedown="event.preventDefault(); insertShareMention('${esc(user.name)}')">
      <strong>@${esc(user.name)}</strong><small>${esc(user.area)} · ${esc(user.email)}</small>
    </button>
  `).join('') : '<div class="empty-state" style="padding:8px 10px;">Nenhuma pessoa encontrada.</div>';
  container.classList.add('open');
}

function handleShareMentionKeydown(event) {
  const container = document.getElementById('shareMentionSuggestions');
  const option = container.querySelector('.mention-option');
  if (container.classList.contains('open') && event.key === 'Enter' && option) {
    event.preventDefault();
    insertShareMention(option.querySelector('strong').textContent.slice(1));
  }
  if (event.key === 'Escape') container.classList.remove('open');
}

function insertShareMention(name) {
  const input = document.getElementById('shareWithInput');
  input.value = input.value.replace(/(?:^|,)\s*@[^\s,]*$/, value => `${value.startsWith(',') ? ', ' : ''}@${name}`);
  document.getElementById('shareMentionSuggestions').classList.remove('open');
  input.focus();
}

function handleSelectedUsersMentionInput() {
  const input = document.getElementById('fSelectedUsers');
  const container = document.getElementById('selectedUsersMentionSuggestions');
  const match = input.value.match(/(?:^|,)\s*@([^\s,]*)$/);
  if (!match) {
    container.classList.remove('open');
    return;
  }
  const query = match[1].toLowerCase();
  const matches = MENTION_USERS.filter(user => user.name.toLowerCase().includes(query));
  container.innerHTML = matches.length ? matches.map(user => `
    <button type="button" class="mention-option" onmousedown="event.preventDefault(); insertSelectedUsersMention('${esc(user.name)}')">
      <strong>@${esc(user.name)}</strong><small>${esc(user.area)} · ${esc(user.email)}</small>
    </button>
  `).join('') : '<div class="empty-state" style="padding:8px 10px;">Nenhuma pessoa encontrada.</div>';
  container.classList.add('open');
}

function handleSelectedUsersMentionKeydown(event) {
  const container = document.getElementById('selectedUsersMentionSuggestions');
  const option = container.querySelector('.mention-option');
  if (container.classList.contains('open') && event.key === 'Enter' && option) {
    event.preventDefault();
    insertSelectedUsersMention(option.querySelector('strong').textContent.slice(1));
  }
  if (event.key === 'Escape') container.classList.remove('open');
}

function insertSelectedUsersMention(name) {
  const input = document.getElementById('fSelectedUsers');
  input.value = input.value.replace(/(?:^|,)\s*@[^\s,]*$/, value => `${value.startsWith(',') ? ', ' : ''}@${name}`);
  document.getElementById('selectedUsersMentionSuggestions').classList.remove('open');
  input.focus();
}

function handleResponsibleMentionInput() {
  const input = document.getElementById('modalResponsible');
  const container = document.getElementById('responsibleMentionSuggestions');
  const match = input.value.match(/(?:^|\s)@([^\s@]*)$/);
  if (!match) {
    container.classList.remove('open');
    return;
  }
  const query = match[1].toLowerCase();
  const matches = MENTION_USERS.filter(user => user.name.toLowerCase().includes(query));
  container.innerHTML = matches.length ? matches.map(user => `
    <button type="button" class="mention-option" onmousedown="event.preventDefault(); insertResponsibleMention('${esc(user.name)}')">
      <strong>@${esc(user.name)}</strong><small>${esc(user.area)} · ${esc(user.email)}</small>
    </button>
  `).join('') : '<div class="empty-state" style="padding:8px 10px;">Nenhuma pessoa encontrada.</div>';
  container.classList.add('open');
}

function handleResponsibleMentionKeydown(event) {
  const container = document.getElementById('responsibleMentionSuggestions');
  const option = container.querySelector('.mention-option');
  if (container.classList.contains('open') && event.key === 'Enter' && option) {
    event.preventDefault();
    insertResponsibleMention(option.querySelector('strong').textContent.slice(1));
  }
  if (event.key === 'Escape') container.classList.remove('open');
}

function insertResponsibleMention(name) {
  const input = document.getElementById('modalResponsible');
  input.value = input.value.replace(/(?:^|\s)@[^\s@]*$/, value => `${value.startsWith(' ') ? ' ' : ''}@${name}`);
  document.getElementById('responsibleMentionSuggestions').classList.remove('open');
  input.focus();
}

function formatRichComment(editorId, type) {
  const command = { B: 'bold', I: 'italic', Tt: 'formatBlock', Quote: 'formatBlock' }[type];
  const value = type === 'Tt' ? 'h3' : type === 'Quote' ? 'blockquote' : null;
  document.getElementById(editorId).focus();
  document.execCommand(command, false, value);
}

function renderRichComment(content) {
  if (!content || !content.includes('<')) return esc(content);
  const template = document.createElement('template');
  template.innerHTML = content;
  const allowed = ['B', 'STRONG', 'I', 'EM', 'H3', 'BLOCKQUOTE', 'BR', 'DIV', 'P'];
  template.content.querySelectorAll('*').forEach(element => {
    if (!allowed.includes(element.tagName)) {
      element.replaceWith(document.createTextNode(element.textContent || ''));
    }
    [...element.attributes].forEach(attribute => element.removeAttribute(attribute.name));
  });
  return template.innerHTML;
}

function triggerCommentFileUpload() {
  document.getElementById('commentFileInput').click();
}

function handleCommentFileUpload(e) {
  const file = e.target.files[0];
  if (file) {
    const editor = document.getElementById('newCommentText');
    editor.focus();
    document.execCommand('insertText', false, `[Arquivo anexado: ${file.name}]`);
  }
}

function renderComments(comments) {
  const container = document.getElementById('detailCommentsList');
  if (!comments || comments.length === 0) {
    container.innerHTML = '<div style="font-size:12px; color:var(--muted)">Nenhum comentário ainda.</div>';
    return;
  }

  container.innerHTML = comments.map(c => {
    const initials = c.author.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    return `
      <div class="comment-item">
        <div class="avatar">${initials}</div>
        <div class="comment-content">
          <div>
            <span class="comment-author">${esc(c.author)}</span>
            <span class="comment-date">${c.date}</span>
          </div>
          <div class="comment-bubble">${renderRichComment(c.text)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function addComment() {
  if (!window.ComGestorConvex.exigirPermissao('COMENTARIO_CRIAR')) return;
  const editor = document.getElementById('newCommentText');
  const text = editor.textContent.trim();
  const html = editor.innerHTML.trim();
  if (!text) return;

  const card = cards.find(c => c.id === activeCardId);
  if (card) {
    if (!card.comments) card.comments = [];
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR') + ', ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    const newComment = {
      author: currentUserName(),
      date: dateStr,
      text: html,
      mentions: extractMentions(text)
    };

    if (card.mirrorGroupId) {
      cards.forEach(c => {
        if (c.mirrorGroupId === card.mirrorGroupId) {
          if (!c.comments) c.comments = [];
          c.comments.unshift(newComment);
        }
      });
    } else {
      card.comments.unshift(newComment);
    }

    addHistory(card, `Comentário no card: ${stripMarkup(html)}`, newComment.author, dateStr);

    saveStorage();
    renderComments(card.comments);
    renderHistory(card);
    editor.innerHTML = '';
    toast('Comentário adicionado!');
  }
}

function deleteComment(idx) {
  const card = cards.find(c => c.id === activeCardId);
  if (card && card.comments) {
    card.comments.splice(idx, 1);
    if (card.mirrorGroupId) {
      cards.forEach(c => { if (c.mirrorGroupId === card.mirrorGroupId) c.comments = card.comments; });
    }
    saveStorage();
    renderComments(card.comments);
    toast('Comentário excluído.');
  }
}

function editCurrentCardFromModal() {
  closeCardDetailModal();
  openForm(activeCardId);
}

function closeCardDetailModal() {
  document.getElementById('cardDetailModal').classList.remove('open');
  if (!document.getElementById('cardDrawer').classList.contains('open') &&
      !document.getElementById('actionModal').classList.contains('open') &&
      !document.getElementById('settingsModal').classList.contains('open')) {
    document.getElementById('overlay').classList.remove('open');
  }
  document.querySelectorAll('.popover').forEach(p => p.classList.remove('open'));
}

function triggerAddAction() {
  if (!window.ComGestorConvex.exigirPermissao('ACAO_CRIAR')) return;
  const text = document.getElementById('newActionInput').value.trim();
  if (!text) { toast('Preencha o campo de ação antes de configurar o prazo.'); return; }

  pendingActionTitle = text;
  pendingActionContext = 'drawer';
  document.getElementById('modalActionText').value = text;
  document.getElementById('modalStartDate').value = todayISO();
  document.getElementById('modalDays').value = 5;
  document.getElementById('modalResponsible').value = '';
  calculateModalDueDate();

  document.getElementById('overlay').classList.add('open');
  document.getElementById('actionModal').classList.add('open');
}

function startDetailAction() {
  if (!window.ComGestorConvex.exigirPermissao('ACAO_CRIAR')) return;
  pendingActionTitle = '';
  pendingActionContext = 'detail';
  document.getElementById('modalActionText').value = '';
  document.getElementById('modalStartDate').value = todayISO();
  document.getElementById('modalDays').value = 5;
  document.getElementById('modalResponsible').value = '';
  calculateModalDueDate();
  document.getElementById('overlay').classList.add('open');
  document.getElementById('actionModal').classList.add('open');
}

function calculateModalDueDate() {
  const start = document.getElementById('modalStartDate').value;
  const days = document.getElementById('modalDays').value || 1;
  document.getElementById('modalDueDate').value = addDays(start, days);
}

function closeActionModal() {
  document.getElementById('actionModal').classList.remove('open');
  if (!document.getElementById('cardDrawer').classList.contains('open') &&
      !document.getElementById('cardDetailModal').classList.contains('open') &&
      !document.getElementById('settingsModal').classList.contains('open')) {
    document.getElementById('overlay').classList.remove('open');
  }
}

function saveActionFromModal() {
  if (!window.ComGestorConvex.exigirPermissao('ACAO_CRIAR')) return;
  const title = document.getElementById('modalActionText').value.trim();
  const resp = document.getElementById('modalResponsible').value.trim();
  if (!title) { toast('Informe a descrição da ação.'); return; }
  if (!resp) { toast('Informe o responsável pela ação.'); return; }

  const newAction = {
    id: Date.now(),
    title,
    startDate: document.getElementById('modalStartDate').value,
    days: Number(document.getElementById('modalDays').value),
    dueDate: document.getElementById('modalDueDate').value,
    responsible: resp,
    completed: false,
    createdBy: currentUserName(),
    createdAt: formatDateTime(new Date())
  };

  if (pendingActionContext === 'detail') {
    const card = cards.find(c => c.id === activeCardId);
    if (!card) return;
    if (!card.actions) card.actions = [];
    card.actions.push(newAction);
    addHistory(card, `Plano de ação criado: ${newAction.title} · Responsável: ${newAction.responsible}`, currentUserName(), newAction.createdAt);
    syncCardStatusWithActions(card);
    if (card.mirrorGroupId) {
      cards.forEach(c => {
        if (c.mirrorGroupId === card.mirrorGroupId) {
          c.actions = card.actions;
          c.status = card.status;
          c.inProgressSince = card.inProgressSince;
        }
      });
    }
    saveStorage();
    closeActionModal();
    renderDetailActions(card);
    renderHistory(card);
    render();
    toast('Ação criada com sucesso!');
    return;
  }

  tempActions.push(newAction);

  document.getElementById('newActionInput').value = '';
  closeActionModal();
  renderTempActions();
}

function renderTempActions() {
  const container = document.getElementById('actionsList');
  if (!tempActions.length) {
    container.innerHTML = '<div style="font-size:12px; color:var(--muted)">Nenhuma ação adicionada ainda.</div>';
    return;
  }

  container.innerHTML = tempActions.map((a, idx) => `
    <div class="action-item">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <label style="font-size:12px; font-weight:bold; display:flex; align-items:center; gap:6px;">
          <input type="checkbox" ${a.completed ? 'checked' : ''} onchange="toggleActionComplete(${idx})">
          <span style="${a.completed ? 'text-decoration:line-through; color:var(--muted)' : ''}">${esc(a.title)}</span>
        </label>
        <button type="button" class="ghost" style="padding:2px 6px; font-size:11px;" onclick="removeTempAction(${idx})">✕</button>
      </div>
      <div style="font-size:11px; color:var(--muted); margin-top:4px;">
        📅 Início: ${a.startDate} | Prazo: ${a.days}d (Até: ${a.dueDate}) | Resp: <b>${esc(a.responsible)}</b>
      </div>
    </div>
  `).join('');
}

function toggleActionComplete(idx) {
  tempActions[idx].completed = !tempActions[idx].completed;
  renderTempActions();
}

function removeTempAction(idx) {
  tempActions.splice(idx, 1);
  renderTempActions();
}

function openForm(id = null) {
  const permissao = id ? 'CARD_EDITAR' : 'CARD_CRIAR';
  if (!window.ComGestorConvex.exigirPermissao(permissao)) return;
  const escopo = window.COMGESTOR_SESSION.permissoes[permissao];
  if (!id && escopo !== 'TODOS' && currentArea !== window.COMGESTOR_SESSION.quadro.nome) {
    toast('Seu perfil só pode criar cards no quadro da sua área.');
    return;
  }
  const card = cards.find(c => c.id === id);
  document.getElementById('cardId').value = id || '';
  document.getElementById('drawerTitle').textContent = id ? 'Editar Card' : 'Novo Card';
  document.getElementById('fTitle').value = card?.title || '';
  document.getElementById('fDesc').value = card?.desc || '';
  document.getElementById('fArea').value = card?.area || currentArea;
  document.getElementById('fArea').disabled = Boolean(id);
  document.getElementById('fSubarea').value = card?.subarea || '';
  renderSubareaOptions();
  document.getElementById('fCreator').value = card?.creator || window.COMGESTOR_SESSION?.usuario?.email || '';
  document.getElementById('fUrgencia').value = card?.urgencia || 'Não';
  document.getElementById('fVisibility').value = card?.visibility || 'area';
  document.getElementById('fSelectedUsers').value = card?.selectedUsers || '';
  document.getElementById('btnSuspend').style.display = id ? 'block' : 'none';

  toggleUsersSelection();

  document.getElementById('overlay').classList.add('open');
  document.getElementById('cardDrawer').classList.add('open');
}

function closeDrawer() {
  document.getElementById('cardDrawer').classList.remove('open');
  if (!document.getElementById('actionModal').classList.contains('open') &&
      !document.getElementById('cardDetailModal').classList.contains('open') &&
      !document.getElementById('settingsModal').classList.contains('open')) {
    document.getElementById('overlay').classList.remove('open');
  }
}

function closeAll() {
  closeSettings();
  closeDrawer();
  closeActionModal();
  closeActionDetail();
  closeTransferModal();
  closeShareModal();
  closeCardDetailModal();
}

function toggleUsersSelection() {
  const vis = document.getElementById('fVisibility').value;
  document.getElementById('usersField').style.display = vis === 'selected' ? 'block' : 'none';
}

function saveCard() {
  const id = Number(document.getElementById('cardId').value);
  const permissao = id ? 'CARD_EDITAR' : 'CARD_CRIAR';
  if (!window.ComGestorConvex.exigirPermissao(permissao)) return;
  const areaDestino = id
    ? cards.find(c => c.id === id)?.area
    : document.getElementById('fArea').value;
  const escopo = window.COMGESTOR_SESSION.permissoes[permissao];
  if (escopo !== 'TODOS' && areaDestino !== window.COMGESTOR_SESSION.quadro.nome) {
    toast('Seu perfil só pode alterar cards do quadro da sua área.');
    return;
  }
  const title = document.getElementById('fTitle').value.trim();

  if (!title) { toast('O título é obrigatório.'); return; }
  const currentCard = id ? cards.find(c => c.id === id) : null;
  const mirrorGroupId = currentCard?.mirrorGroupId || null;
  const cardArea = currentCard?.area || document.getElementById('fArea').value;
  const createdArea = currentCard ? (currentCard.createdArea || getCardOriginArea(currentCard)) : cardArea;
  const colorArea = currentCard ? getCardOriginArea(currentCard) : cardArea;
  const creator = currentCard?.creator || window.COMGESTOR_SESSION?.usuario?.email || '';
  if (!creator) { toast('Não foi possível identificar o e-mail da sessão atual.'); return; }
  const visibility = document.getElementById('fVisibility').value;
  let selectedUsers = document.getElementById('fSelectedUsers').value;
  if (visibility === 'selected') {
    const requestedNames = selectedUsers.split(',').map(name => name.trim().replace(/^@/, '')).filter(Boolean);
    if (!requestedNames.length) {
      toast('Mencione ao menos uma pessoa com acesso ao ComGestor.');
      return;
    }
    const recipients = requestedNames.map(name => MENTION_USERS.find(user => user.name.toLowerCase() === name.toLowerCase()));
    if (recipients.some(user => !user)) {
      toast('Selecione as pessoas pelas sugestões de usuários com acesso ao ComGestor.');
      return;
    }
    selectedUsers = [...new Map(recipients.map(user => [user.email, `@${user.name}`])).values()].join(', ');
  }

  const finalStatus = id ? currentCard.status : 'A Fazer';

  const cardData = {
    id: id || Date.now(),
    title,
    desc: document.getElementById('fDesc').value.trim(),
    area: cardArea,
    createdArea,
    colorArea,
    subarea: document.getElementById('fSubarea').value.trim(),
    creator,
    createdAt: currentCard?.createdAt || todayISO(),
    urgencia: document.getElementById('fUrgencia').value,
    risco: currentCard?.risco || '',
    esforco: currentCard?.esforco || '',
    visibility,
    selectedUsers,
    sharedWith: currentCard?.sharedWith || (document.getElementById('fVisibility').value === 'area' ? 'Equipe' : document.getElementById('fSelectedUsers').value),
    actions: currentCard?.actions || [],
    status: finalStatus,
    inProgressSince: currentCard?.inProgressSince || (finalStatus === 'Em Andamento' ? todayISO() : ''),
    archived: currentCard?.archived || false,
    mirrorGroupId,
    comments: currentCard?.comments || [],
    tags: currentCard?.tags || [],
    attachments: currentCard?.attachments || [],
    location: currentCard?.location || '',
    history: currentCard?.history || [{ text: `Card criado na área ${cardArea}`, date: formatDateTime(new Date()) }]
  };

  if (id) {
    const idx = cards.findIndex(c => c.id === id);
    cards[idx] = cardData;
    addHistory(cardData, `Card atualizado: ${cardData.title}`);

    if (mirrorGroupId) {
      cards.forEach(c => {
        if (c.mirrorGroupId === mirrorGroupId && c.id !== id) {
          c.title = cardData.title;
          c.desc = cardData.desc;
          c.urgencia = cardData.urgencia;
          c.risco = cardData.risco;
          c.esforco = cardData.esforco;
          c.visibility = cardData.visibility;
          c.selectedUsers = cardData.selectedUsers;
          c.actions = cardData.actions;
          c.status = cardData.status;
        }
      });
    }
  } else {
    cards.push(cardData);
  }

  saveStorage();
  closeDrawer();
  render();
  toast(id ? 'Card atualizado com sucesso!' : 'Card criado com sucesso!');
}

function suspendCurrentCard() {
  const id = Number(document.getElementById('cardId').value);
  if (!id) return;

  const card = cards.find(c => c.id === id);
  if (card) {
    addHistory(card, 'Card suspenso por tempo indeterminado');
    card.status = 'Suspenso';
    card.archived = true;

    if (card.mirrorGroupId) {
      cards.forEach(c => {
        if (c.mirrorGroupId === card.mirrorGroupId) {
          c.status = 'Suspenso';
          c.archived = true;
        }
      });
    }

    saveStorage();
    closeDrawer();
    render();
    toast('Card suspenso por tempo indeterminado!');
  }
}

function reactivateCard(id) {
  const card = cards.find(c => c.id === id);
  if (card) {
    const status = calculateProgress(card.actions) === 100 ? 'Concluídos' : 'A Fazer';
    addHistory(card, `Card reativado em ${status}`);
    
    if (card.mirrorGroupId) {
      cards.forEach(c => {
        if (c.mirrorGroupId === card.mirrorGroupId) {
          c.archived = false;
          c.status = status;
        }
      });
    } else {
      card.archived = false;
      card.status = status;
    }

    saveStorage();
    render();
    toast('Card reativado!');
  }
}

function handleDrop(e, targetStatus) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.remove('drag-over');
  const transferredId = e.dataTransfer ? e.dataTransfer.getData('text/plain') : '';
  const id = draggedCardId || Number(transferredId);
  const card = cards.find(c => c.id === id);
  if (card && card.status !== targetStatus) {
    if (targetStatus === 'Em Andamento' && cards.filter(item => item.area === card.area && item.status === 'Em Andamento' && !item.archived).length >= ACTIVE_CARD_LIMIT) {
      toast(`A área ${card.area} já atingiu o limite de ${ACTIVE_CARD_LIMIT} cards em andamento.`);
      draggedCardId = null;
      return;
    }
    if (targetStatus === 'Concluídos' && card.creator !== currentUserEmail() && card.creator !== currentUserName()) {
      toast(`Somente ${card.creator || 'quem criou o card'} pode concluir este card.`);
      draggedCardId = null;
      return;
    }
    addHistory(card, `Movido de ${card.status} para ${targetStatus}`);
    card.inProgressSince = targetStatus === 'Em Andamento' ? todayISO() : '';
    card.status = targetStatus;
    card.archived = targetStatus === 'Suspenso';

    if (card.mirrorGroupId) {
      cards.forEach(c => {
        if (c.mirrorGroupId === card.mirrorGroupId) {
          c.status = targetStatus;
          c.archived = card.archived;
          c.inProgressSince = card.inProgressSince;
        }
      });
    }

    saveStorage();
    render();
  }
  draggedCardId = null;
}

function addHistory(card, text, author = currentUserName(), date = formatDateTime(new Date())) {
  if (!card.history) card.history = [];
  card.history.push({ text, author, date });
}

function getCardOriginArea(card) {
  const latestAreaMove = [...(card.history || [])].reverse().find(item => /^Transferido de .+ para .+/.test(item.text || ''));
  const movedArea = latestAreaMove?.text.match(/ para (.+)$/)?.[1]?.trim();
  if (movedArea && AREA_COLORS[movedArea]) return normalizeArea(movedArea);
  if (card.colorArea && AREA_COLORS[card.colorArea]) return normalizeArea(card.colorArea);
  if (card.createdArea && AREA_COLORS[card.createdArea]) return normalizeArea(card.createdArea);
  const creationEvent = (card.history || []).find(item => item.text?.startsWith('Card criado na área '));
  const historyArea = creationEvent?.text?.replace('Card criado na área ', '').trim();
  return AREA_COLORS[historyArea] ? normalizeArea(historyArea) : normalizeArea(card.area);
}

function getAreaTheme(area) {
  const normalizedArea = normalizeArea(area);
  return AREA_COLORS[normalizedArea] || { color: '#2563eb', bg: '#eff6ff' };
}

function transferCard(card, targetArea) {
  addHistory(card, `Transferido de ${card.area} para ${targetArea}`);
  card.area = targetArea;
  card.colorArea = targetArea;
  card.sharedWith = '';
}

function moveCardToArea(card, targetArea) {
  addHistory(card, `Movido de ${card.area} para ${targetArea}`);
  card.area = targetArea;
}

function openShareCard() {
  if (!window.ComGestorConvex.exigirPermissao('COMPARTILHAMENTO_GERENCIAR')) return;
  const currentCardId = Number(activeCardId ?? document.getElementById('detailTitle')?.dataset?.cardId ?? 0);
  const card = cards.find(item => item.id === currentCardId) || cards.find(item => item.id === activeCardId);
  if (!card || !card.id) {
    toast('Selecione um card antes de compartilhar.');
    return;
  }

  activeCardId = card.id;
  const select = document.getElementById('shareAreaSelect');
  if (!select) {
    toast('Modal de compartilhamento indisponível.');
    return;
  }

  const options = window.COMGESTOR_SESSION.quadrosCompartilhamento
    .map(quadro => quadro.nome)
    .filter(area => area !== card.area);
  const currentSharedValue = String(card.sharedWith || '').split(',').map(item => item.trim()).filter(Boolean).find(area => AREAS.includes(area) && area !== card.area);

  select.innerHTML = options.map(area => `<option value="${area}">${area}</option>`).join('');
  if (currentSharedValue) {
    select.value = currentSharedValue;
  } else if (options.length) {
    select.value = options[0];
  }

  document.getElementById('overlay').classList.add('open');
  document.getElementById('shareModal').classList.add('open');
}

function closeShareModal() {
  const shareModal = document.getElementById('shareModal');
  const cardDetailModal = document.getElementById('cardDetailModal');
  if (shareModal) shareModal.classList.remove('open');
  if (!cardDetailModal || !cardDetailModal.classList.contains('open')) {
    const overlay = document.getElementById('overlay');
    if (overlay) overlay.classList.remove('open');
  }
}

async function confirmShareCard() {
  if (!window.ComGestorConvex.exigirPermissao('COMPARTILHAMENTO_GERENCIAR')) return;
  const currentCardId = Number(activeCardId ?? document.getElementById('detailTitle')?.dataset?.cardId ?? 0);
  const card = cards.find(item => item.id === currentCardId) || cards.find(item => item.id === activeCardId);
  const select = document.getElementById('shareAreaSelect');
  const value = select?.value || '';

  if (!card || !card.id) {
    toast('Selecione um card antes de compartilhar.');
    return;
  }

  if (!value) {
    toast('Selecione uma área para compartilhar.');
    return;
  }

  const quadroDestino = window.COMGESTOR_SESSION.quadrosCompartilhamento
    .find(quadro => quadro.nome === value);
  if (!quadroDestino) {
    toast('Você não tem acesso a esse quadro para compartilhar.');
    return;
  }
  try {
    await persistQueue;
    if (!card._convexId) throw new Error('O card ainda não foi salvo no Convex.');
    await window.ComGestorConvex.compartilharCard(card._convexId, quadroDestino);
  } catch (error) {
    console.error('Não foi possível compartilhar o card no Convex.', error);
    toast(error instanceof Error ? error.message : 'Não foi possível compartilhar o card.');
    return;
  }

  const colorAreaBeforeShare = getCardOriginArea(card);
  card.sharedWith = value.trim();
  card.colorArea = colorAreaBeforeShare;
  addHistory(card, `Compartilhado com ${card.sharedWith}`);
  saveStorage();
  closeShareModal();
  openCardDetailModal(card.id);
  render();
  toast(`Card compartilhado com ${card.sharedWith}.`);
}

function openTransferCard() {
  if (!window.ComGestorConvex.exigirPermissao('CARD_TRANSFERIR')) return;
  const card = cards.find(item => item.id === activeCardId);
  if (!card) return;
  const select = document.getElementById('transferAreaSelect');
  select.innerHTML = window.COMGESTOR_SESSION.quadrosDestino
    .filter(quadro => quadro.nome !== card.area)
    .map(quadro => `<option value="${quadro.nome}">${quadro.nome}</option>`).join('');
  document.getElementById('overlay').classList.add('open');
  document.getElementById('transferModal').classList.add('open');
}

function closeTransferModal() {
  document.getElementById('transferModal').classList.remove('open');
  if (!document.getElementById('cardDetailModal').classList.contains('open')) {
    document.getElementById('overlay').classList.remove('open');
  }
}

function confirmTransferCard() {
  if (!window.ComGestorConvex.exigirPermissao('CARD_TRANSFERIR')) return;
  const card = cards.find(item => item.id === activeCardId);
  const targetArea = document.getElementById('transferAreaSelect').value;
  if (!card || !targetArea) return;
  transferCard(card, targetArea);
  saveStorage();
  closeTransferModal();
  currentArea = targetArea;
  showMainBoardUI();
  renderAreaPills();
  openCardDetailModal(card.id);
  render();
  toast(`Card transferido para ${targetArea}.`);
}

function formatDate(dateValue) {
  if (!dateValue) return 'não informado';
  const date = new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(date.getTime()) ? dateValue : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
}

function formatDateTime(date) {
  return date.toLocaleDateString('pt-BR') + ', ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function startCardDrag(event, id, element) {
  draggedCardId = id;
  cardWasDragged = true;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(id));
  element.classList.add('is-dragging');
}

function finishCardDrag(element) {
  element.classList.remove('is-dragging');
  document.querySelectorAll('.column.drag-over').forEach(column => column.classList.remove('drag-over'));
  setTimeout(() => { draggedCardId = null; }, 300);
  setTimeout(() => { cardWasDragged = false; }, 300);
}

function openCardFromClick(id) {
  if (cardWasDragged) return;
  openCardDetailModal(id);
}

function handleDragOver(event, column) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  column.classList.add('drag-over');
}

function handleDragLeave(event, column) {
  if (!column.contains(event.relatedTarget)) column.classList.remove('drag-over');
}

function clearAllCards() {
  const shouldClear = window.confirm('Deseja apagar todos os cards criados? Esta ação não poderá ser desfeita.');
  if (!shouldClear) return;

  cards = [];
  activeCardId = null;
  localStorage.removeItem(userStorageKey('converge_v4_cards'));
  saveStorage();
  closeCardDetailModal();
  closeDrawer();
  closeSettings();
  closeActionModal();
  closeTransferModal();
  closeShareModal();
  render();
  toast('Todos os cards foram removidos.');
}

function saveStorage() {
  try {
    localStorage.setItem(userStorageKey('converge_v4_cards'), JSON.stringify(cards));
  } catch (error) {
    console.error('Não foi possível salvar os cards.', error);
    toast('Não foi possível salvar. Remova anexos grandes e tente novamente.');
  }

  for (const card of cards) persistCardToConvex(card);
}

function persistCardToConvex(card) {
  const key = String(card.id);
  const snapshot = JSON.stringify(card);
  if (persistedCardSnapshots.get(key) === snapshot || queuedCardSnapshots.get(key) === snapshot) return;
  queuedCardSnapshots.set(key, snapshot);
  const data = JSON.parse(snapshot);

  persistQueue = persistQueue.then(async () => {
    const quadro = window.COMGESTOR_SESSION.quadrosDestino.find(item => item.nome === data.area);
    if (!quadro) throw new Error(`Não há acesso ao quadro ${data.area}.`);

    if (card._convexId && card._convexBoardId && card._convexBoardId !== quadro.id) {
      await window.ComGestorConvex.transferirCard(card._convexId, quadro);
    }
    const cardId = await window.ComGestorConvex.persistirCard({
      ...data,
      _convexId: card._convexId || data._convexId
    }, quadro);
    card._convexId = cardId;
    card._convexBoardId = quadro.id;
    const salvo = JSON.stringify(card);
    persistedCardSnapshots.set(key, salvo);
    queuedCardSnapshots.set(key, salvo);
  }).catch(error => {
    queuedCardSnapshots.delete(key);
    console.error('Não foi possível salvar o card no Convex.', error);
    toast(error instanceof Error ? error.message : 'Não foi possível salvar o card no Convex.');
  });
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

async function logoutFromApp(button) {
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');

  try {
    if (!window.Clerk || typeof window.Clerk.load !== 'function' || typeof window.Clerk.signOut !== 'function') {
      throw new Error('Clerk não está disponível para encerrar a sessão.');
    }

    await window.Clerk.load({
      ui: {
        ClerkUI: window.__internal_ClerkUICtor
      }
    });
    await window.Clerk.signOut();
    sessionStorage.removeItem('comgestor_auth');
    sessionStorage.removeItem('comgestor_token');
    window.location.replace('./login.html');
  } catch (error) {
    console.error('Não foi possível encerrar a sessão.', error);
    toast('Não foi possível sair. Verifique sua conexão e tente novamente.');
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

async function iniciarAplicacaoProtegida() {
  try {
    const sessao = await window.ComGestorConvex.minhaSessao();
    window.COMGESTOR_SESSION = sessao;
    MENTION_USERS = (sessao.usuarios || []).map(user => ({
      ...user,
      name: user.name || user.nome
    }));
    const dadosLocais = readStoredJSON('converge_v4_cards', []);
    const cardsRemotos = await window.ComGestorConvex.listarCards(sessao.quadros);
    cards = cardsRemotos.length
      ? cardsRemotos
      : dadosLocais.filter(card => sessao.quadros.some(quadro => quadro.nome === card.area));
    persistedCardSnapshots.clear();
    queuedCardSnapshots.clear();
    for (const card of cards) {
      if (card._convexId) persistedCardSnapshots.set(String(card.id), JSON.stringify(card));
    }
    sessionStorage.removeItem('comgestor_auth');
    sessionStorage.removeItem('comgestor_token');

    const perfil = document.getElementById('activeUserProfile');
    perfil.textContent = `${sessao.usuario.nome} · ${sessao.perfil.nome} · ${sessao.area.setor}`;

    document.querySelectorAll('[data-requires-permission]').forEach(element => {
      const codigo = element.dataset.requiresPermission;
      element.style.display = window.ComGestorConvex.temPermissao(codigo) ? '' : 'none';
    });

    if (areasDisponiveis().includes(sessao.quadro.nome)) currentArea = sessao.quadro.nome;
    document.body.classList.remove('auth-pending');
    init();
    startMentionRefresh();
    if (!cardsRemotos.length && cards.some(card => !card._convexId)) {
      toast('Salvando cards locais permitidos no Convex...');
      for (const card of cards) persistCardToConvex(card);
    }
  } catch (error) {
    console.error('Não foi possível validar a sessão do ComGestor no Convex.', error);
    window.location.replace('./login.html');
  }
}

iniciarAplicacaoProtegida();