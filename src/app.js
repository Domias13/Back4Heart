import {
  applyAdaptation,
  applyCharacterCampaignUpdate,
  buildAdaptation,
  buildQuestions,
  completeQuest,
  countCharacters,
  deriveCharacter,
  generateCampaign,
  getOnboardingQuestions,
  getQuestSuggestionLimit,
  getLevel,
} from './domain.js';
import { createInitialState, loadState, saveState } from './storage.js';

const root = document.querySelector('#app');
const modalRoot = document.querySelector('#modal-root');
const ui = {
  view: 'dashboard',
  modal: null,
  wizardStep: 1,
  wizardDraft: null,
  reviewType: 'evening',
  expandedPhases: new Set(),
  collapsedPhases: new Set(),
  characterEditDraft: null,
  onboardingError: '',
  toast: '',
};
let state = loadState();
let storageAvailable = saveState(undefined, state);

function activeCampaign() {
  return state.campaigns.find((campaign) => campaign.id === state.activeCampaignId)
    ?? state.campaigns[0]
    ?? null;
}

function allQuests(campaign = activeCampaign()) {
  return campaign?.milestones.flatMap((phase) => phase.quests) ?? [];
}

function countProgress(campaign = activeCampaign()) {
  const quests = allQuests(campaign);
  const done = quests.filter((quest) => quest.status === 'done').length;
  return { done, total: quests.length, percent: quests.length ? Math.round((done / quests.length) * 100) : 0 };
}

function save(message = 'Прогресс сохранён') {
  storageAvailable = saveState(undefined, state);
  ui.toast = storageAvailable ? message : 'Хранилище браузера недоступно: прогресс будет только до закрытия вкладки.';
}

function render() {
  if (!state.profile.setupComplete) {
    root.innerHTML = renderOnboarding();
    modalRoot.innerHTML = '';
    return;
  }
  const campaign = activeCampaign();
  const progress = countProgress(campaign);
  const level = getLevel(state.profile.xp);
  const today = new Date();
  const viewTitles = {
    dashboard: { eyebrow: 'ТВОЯ ИГРА • ' + formatDate(today), title: 'Продолжай свой путь' },
    map: { eyebrow: 'КАРТА КАМПАНИИ', title: 'Маршрут к цели' },
    reviews: { eyebrow: 'РЕФЛЕКСИЯ И НАСТРОЙКА', title: 'Обзоры и новый темп' },
    character: { eyebrow: 'ТВОЙ ПРОФИЛЬ', title: 'Персонаж' },
  };
  const title = viewTitles[ui.view] ?? viewTitles.dashboard;

  root.innerHTML = `
    <div class="app-shell">
      ${renderSidebar(campaign, progress, level)}
      <main class="main">
        <header class="topbar">
          <div>
            <div class="eyebrow">${escapeHtml(title.eyebrow)}</div>
            <h1>${escapeHtml(title.title)}</h1>
          </div>
          <div class="top-actions">
            <button class="icon-button" type="button" aria-label="Открыть обзоры" data-nav="reviews">✧</button>
            <button class="primary-button" type="button" data-action="new-campaign"><span aria-hidden="true">＋</span><span>Новая кампания</span></button>
          </div>
        </header>
        ${!storageAvailable ? '<div class="storage-note" role="status">◉ Браузер не разрешил сохранять данные. Можно продолжить, пока эта вкладка открыта.</div>' : ''}
        ${ui.toast ? `<div class="storage-note" role="status">✦ ${escapeHtml(ui.toast)}</div>` : ''}
        ${ui.view === 'dashboard' ? renderDashboard(campaign, progress, level) : ''}
        ${ui.view === 'map' ? renderMap(campaign, progress) : ''}
        ${ui.view === 'reviews' ? renderReviews(campaign) : ''}
        ${ui.view === 'character' ? renderCharacterPage() : ''}
      </main>
      ${renderMobileNav()}
    </div>`;
  renderModal();
}

function renderSidebar(campaign, progress, level) {
  const navItems = [
    { id: 'dashboard', icon: '⌂', label: 'Дашборд' },
    { id: 'map', icon: '⌘', label: 'Карта кампании' },
    { id: 'reviews', icon: '◷', label: 'Обзоры' },
  ];
  return `
    <aside class="sidebar" aria-label="Главная навигация">
      <div class="brand"><div class="brand-mark" aria-hidden="true">✦</div><div class="brand-name">LIFE RPG<small>YOUR LIFE, YOUR QUEST</small></div></div>
      <div class="nav-label">ИГРОВОЙ МИР</div>
      <nav class="nav-list">${navItems.map((item) => `
        <button type="button" class="nav-link" data-nav="${item.id}" aria-current="${ui.view === item.id ? 'page' : 'false'}">
          <span class="nav-symbol" aria-hidden="true">${item.icon}</span><span class="nav-text">${item.label}</span>
        </button>`).join('')}
      </nav>
      <div class="sidebar-spacer"></div>
      ${campaign ? `
        <div class="side-campaign">
          <div class="side-campaign-label"><span>АКТИВНАЯ КАМПАНИЯ</span><span>${progress.percent}%</span></div>
          <div class="side-campaign-title">${escapeHtml(campaign.title)}</div>
          <div class="progress-bar"><i style="width:${progress.percent}%"></i></div>
        </div>` : ''}
      <div class="side-profile">
        <button type="button" class="profile-open" data-nav="character" aria-label="Открыть персонажа">
          <span class="avatar" aria-hidden="true">${level.level}</span>
          <span class="profile-copy"><span class="profile-name">Путешественник</span><span class="profile-sub">Уровень ${level.level} · ${state.profile.xp} XP</span></span>
        </button>
        <button type="button" class="reset-button" data-action="reset" title="Сбросить демо" aria-label="Сбросить демо">↺</button>
      </div>
    </aside>`;
}

function renderMobileNav() {
  return `<nav class="mobile-nav" aria-label="Навигация">${[
    ['dashboard', '⌂', 'Главная'], ['map', '⌘', 'Карта'], ['reviews', '◷', 'Обзор'], ['character', '♙', 'Персонаж'],
  ].map(([id, icon, label]) => `
    <button type="button" data-nav="${id}" aria-current="${ui.view === id ? 'page' : 'false'}"><span class="nav-symbol" aria-hidden="true">${icon}</span>${label}</button>`).join('')}
  </nav>`;
}

function renderDashboard(campaign, progress, level) {
  if (!campaign) return `<div class="empty-state">Создай свою первую кампанию — и здесь появится карта пути.</div>`;
  const questList = nextQuests(campaign).slice(0, getQuestSuggestionLimit(state.profile.attributes));
  const newestReview = state.reviews.find((review) => review.type === 'weekly' && review.campaignId === campaign.id);
  const resource = campaign.assessment;
  const targetDate = new Date(`${campaign.targetDate}T00:00:00`);
  const daysLeft = Math.max(0, Math.round((targetDate - startOfToday()) / 86400000));
  const streak = state.profile.streak ?? 0;

  return `
    <section class="dashboard-grid" aria-label="Обзор кампании">
      <div class="dashboard-primary">
        <article class="hero-card">
          <div class="hero-topline"><span>ГЛАВНАЯ КАМПАНИЯ</span><span class="live-pill"><i class="live-dot"></i> В процессе</span></div>
          <div class="hero-content">
            <h2>Большая цель.<br/>Маленькие победы.</h2>
            <p>Сегодня достаточно одного честного шага. Остальное выстроится по дороге.</p>
          </div>
          <div class="hero-footer">
            <div class="hero-goal" title="${escapeHtml(campaign.title)}">${escapeHtml(campaign.title)}</div>
            <button class="primary-button hero-button" type="button" data-nav="map">Открыть карту <span aria-hidden="true">↗</span></button>
          </div>
        </article>
        <div class="stat-strip" aria-label="Игровая статистика">
          <article class="stat-card"><div class="stat-heading"><span>Уровень</span><i class="stat-icon">✦</i></div><div class="stat-number">${level.level}<small>Путешественник</small></div></article>
          <article class="stat-card"><div class="stat-heading"><span>Опыт</span><i class="stat-icon">✧</i></div><div class="stat-number">${state.profile.xp}<small>из ${Math.ceil((state.profile.xp + 1) / 100) * 100} XP</small></div><div class="progress-bar" style="margin-top:7px"><i style="width:${level.progress}%"></i></div></article>
          <article class="stat-card"><div class="stat-heading"><span>Монеты</span><i class="stat-icon" style="color:var(--gold);background:#352e24">◈</i></div><div class="stat-number">${state.profile.coins}<small>награда за шаги</small></div></article>
        </div>
        <div class="section-heading"><div><h2>Квесты на сегодня</h2><p>Выбери один — этого уже достаточно</p></div><button class="text-button" type="button" data-nav="map">Вся карта ↗</button></div>
        <div class="quest-list">${questList.length ? questList.map((quest) => renderQuestRow(quest)).join('') : '<div class="empty-state">Все квесты выполнены. Открой карту и посмотри, что дальше.</div>'}</div>
      </div>
      <aside class="dashboard-aside">
        <section class="panel">
          <div class="panel-heading"><h2>Твой маршрут</h2><span>${daysLeft} дн. до ориентира</span></div>
          <div class="campaign-progress">
            <div class="progress-ring" style="--progress:${progress.percent * 3.6}deg"><strong>${progress.percent}%</strong></div>
            <div class="campaign-progress-copy"><strong>${escapeHtml(campaign.title)}</strong><span>${progress.done} из ${progress.total} квестов завершено</span></div>
          </div>
          <div class="phase-list">${campaign.milestones.map((phase, index) => {
            const isDone = phase.quests.every((quest) => quest.status === 'done');
            const isCurrent = !isDone && !campaign.milestones.slice(0, index).some((prior) => prior.quests.every((quest) => quest.status === 'done'));
            return `<div class="phase-mini ${isDone ? 'done' : isCurrent ? 'current' : ''}"><span class="phase-dot">${isDone ? '✓' : index + 1}</span><span>${escapeHtml(phase.title)}</span><span class="phase-mini-count">${phase.quests.filter((quest) => quest.status === 'done').length}/${phase.quests.length}</span></div>`;
          }).join('')}</div>
          <button class="quiet-button small-button" style="width:100%;margin-top:17px" type="button" data-nav="map">Посмотреть маршрут</button>
        </section>
        <section class="panel resource-card">
          <div class="panel-heading"><h3>Ресурс на старте</h3><span>ориентир</span></div>
          <div class="resource-top"><div><div class="resource-score">${campaign.resourceScore}<small>/100</small></div><div class="resource-note">План учитывает твои силы и доступное время. Это ориентир, а не оценка тебя.</div></div><span class="category-tag">${categoryLabel(campaign.category)}</span></div>
          <div class="resource-breakdown">
            ${renderResourceLine('Время', Math.min(100, Math.round(resource.weeklyHours / 10 * 100)), `${resource.weeklyHours} ч.`)}
            ${renderResourceLine('Энергия', Math.round((resource.energy - 1) / 4 * 100), `${resource.energy}/5`)}
            ${renderResourceLine('Уверенность', Math.round((resource.confidence - 1) / 4 * 100), `${resource.confidence}/5`)}
          </div>
        </section>
        <section class="panel">
          <div class="panel-heading"><h3>${newestReview ? 'Адаптация плана' : 'Твоя серия'}</h3><span>${newestReview ? 'по итогам недели' : 'ритм важнее скорости'}</span></div>
          ${newestReview ? renderAdaptationCard(newestReview) : `<div class="adaptation-box"><div class="adaptation-top"><span class="adaptation-icon">◷</span><strong>${streak ? `${streak} ${plural(streak, 'день', 'дня', 'дней')} подряд` : 'Серия начнётся с первого квеста'}</strong></div><p>Каждая отметка — доказательство того, что ты двигаешься. Сделай крошечный шаг, чтобы поддержать свой ритм.</p><div class="adaptation-actions"><button class="quiet-button small-button" type="button" data-nav="reviews">Открыть вечерний обзор</button></div></div>`}
        </section>
        ${state.profile.badges?.length ? `<section class="panel"><div class="panel-heading"><h3>Трофеи</h3><span>${state.profile.badges.length}</span></div><div class="badge-list">${state.profile.badges.map((badge) => `<span class="badge-chip">✦ ${escapeHtml(badge)}</span>`).join('')}</div></section>` : ''}
      </aside>
    </section>`;
}

function renderResourceLine(label, percent, value) {
  return `<div class="resource-line"><span>${label}</span><div class="progress-bar"><i style="width:${percent}%"></i></div><strong>${escapeHtml(value)}</strong></div>`;
}

function renderQuestRow(quest) {
  const status = quest.status === 'done' ? '✓' : quest.status === 'blocked' ? '!' : '↗';
  const checkClass = quest.status === 'done' ? 'done' : '';
  const statusText = quest.status === 'blocked' ? 'нужна помощь' : quest.status === 'postponed' ? 'перенесён' : formatDate(quest.dueDate);
  return `<button type="button" class="quest-row" data-open-quest="${escapeHtml(quest.id)}" aria-label="Открыть квест: ${escapeHtml(quest.title)}">
    <span class="quest-check ${checkClass}">${status}</span><span><span class="quest-title">${escapeHtml(quest.title)}</span><span class="quest-meta"><span>${escapeHtml(statusText)}</span><span>·</span><span>${quest.minutes} мин</span></span></span><span class="quest-reward">+${quest.xp} XP</span>
  </button>`;
}

function renderMap(campaign, progress) {
  if (!campaign) return `<div class="empty-state">Сначала создай кампанию, и карта покажет весь маршрут.</div>`;
  const total = progress.total;
  return `
    <div class="page-intro"><div><h2>${escapeHtml(campaign.title)}</h2><p>${escapeHtml(campaign.why || 'Путь складывается из небольших проверяемых шагов. Открой этап, чтобы увидеть квесты.')}</p></div><div class="map-summary"><span class="summary-pill"><strong>${campaign.milestones.length}</strong> этапа</span><span class="summary-pill"><strong>${progress.done}/${total}</strong> квестов</span></div></div>
    <div class="map-layout">
      <section class="map-track" aria-label="Этапы кампании">
        ${campaign.milestones.map((phase, index) => {
          const completeCount = phase.quests.filter((quest) => quest.status === 'done').length;
          const done = completeCount === phase.quests.length;
          const earlierDone = campaign.milestones.slice(0, index).every((item) => item.quests.every((quest) => quest.status === 'done'));
          const current = !done && earlierDone;
          const expanded = ui.expandedPhases.has(phase.id) || (!ui.collapsedPhases.has(phase.id) && current);
          return `<article class="phase-card ${done ? 'done' : current ? 'current' : ''}">
            <div class="phase-node-wrap"><span class="phase-node">${done ? '✓' : String(index + 1).padStart(2, '0')}</span></div>
            <div class="phase-content">
              <button class="phase-toggle" type="button" data-phase-id="${escapeHtml(phase.id)}" aria-expanded="${expanded}">
                <span><span class="phase-name">${escapeHtml(phase.title)}</span><span class="phase-outcome" style="display:block">${escapeHtml(phase.outcome)}</span></span>
                <span style="text-align:right"><span class="phase-status">${done ? 'ЗАВЕРШЁН' : current ? 'ТЕКУЩИЙ ЭТАП' : 'ВПЕРЕДИ'}</span><span class="phase-outcome" style="display:block">${formatDate(phase.dueDate)} · ${completeCount}/${phase.quests.length}</span></span>
              </button>
              ${expanded ? `<div class="phase-quests">${phase.quests.map((quest) => renderMapQuest(quest)).join('')}</div>` : ''}
            </div>
          </article>`;
        }).join('')}
      </section>
      <aside class="map-aside">
        <section class="panel"><div class="panel-heading"><h3>Цель кампании</h3><span class="category-tag">${categoryLabel(campaign.category)}</span></div><div class="campaign-progress-copy"><strong>${escapeHtml(campaign.title)}</strong><span>${escapeHtml(campaign.why || 'Добавь своё «зачем» в следующей кампании.')}</span></div><div class="progress-bar" style="margin-top:15px"><i style="width:${progress.percent}%"></i></div><div class="quest-meta" style="justify-content:space-between;margin-top:8px"><span>${progress.done} выполнено</span><span>ориентир ${formatDate(campaign.targetDate)}</span></div></section>
        <section class="panel resource-card"><div class="panel-heading"><h3>Стартовые условия</h3><span>${campaign.resourceScore}/100</span></div><p class="resource-note">${escapeHtml(campaign.assessment.weeklyHours)} часов в неделю · энергия ${campaign.assessment.energy}/5 · уверенность ${campaign.assessment.confidence}/5</p><div class="resource-note" style="margin-top:11px"><strong style="color:var(--text)">Что может мешать</strong><br/>${escapeHtml(campaign.answers.obstacle || campaign.assessment.barriers || 'Пока не указано')}</div></section>
        <section class="panel"><div class="panel-heading"><h3>Проверка маршрута</h3><span>регулярно</span></div><p class="resource-note">Если обстоятельства изменились, открой недельный обзор: подстроим нагрузку, сроки и ближайшие действия.</p><button type="button" class="quiet-button small-button" style="width:100%;margin-top:14px" data-nav="reviews">Открыть обзор</button></section>
      </aside>
    </div>`;
}

function renderMapQuest(quest) {
  const done = quest.status === 'done';
  const icon = done ? '✓' : quest.status === 'blocked' ? '!' : quest.kind === 'checkpoint' ? '◆' : '↗';
  return `<button type="button" class="map-quest ${done ? 'done' : ''}" data-open-quest="${escapeHtml(quest.id)}">
    <span class="map-quest-symbol">${icon}</span><span><span class="map-quest-title">${escapeHtml(quest.title)}</span><span class="map-quest-meta">${escapeHtml(quest.successCriteria)}</span></span><span class="map-quest-xp">${done ? 'ГОТОВО' : `+${quest.xp} XP`}</span>
  </button>`;
}

function renderReviews(campaign) {
  const isWeekly = ui.reviewType === 'weekly';
  const history = state.reviews.filter((review) => !campaign || review.campaignId === campaign.id).slice(0, 5);
  const latestWeekly = state.reviews.find((review) => review.type === 'weekly' && review.campaignId === campaign?.id);
  const defaultRate = 50;
  return `
    <div class="page-intro"><div><h2>Пауза — часть прогресса</h2><p>Короткий обзор помогает увидеть, что работает, и подобрать темп на завтра или на следующую неделю.</p></div></div>
    <div class="review-tabs" role="group" aria-label="Тип обзора">
      <button class="review-tab" type="button" data-review-type="evening" aria-pressed="${!isWeekly}">Вечерний</button>
      <button class="review-tab" type="button" data-review-type="weekly" aria-pressed="${isWeekly}">Недельный</button>
    </div>
    ${isWeekly && latestWeekly?.adaptation ? `<section class="panel" style="margin-top:14px"><div class="panel-heading"><h3>Рекомендация по последнему обзору</h3><span>${latestWeekly.appliedAt ? 'уже применена' : 'твоё решение'}</span></div>${renderAdaptationCard(latestWeekly)}</section>` : ''}
    <div class="review-layout">
      <section class="panel">
        <div class="panel-heading"><h2>${isWeekly ? 'Подведём итоги недели' : 'Завершить сегодняшний день'}</h2><span>${formatDate(new Date())}</span></div>
        <form class="review-form" data-form="review">
          ${isWeekly ? `<div class="field"><label for="completion-rate">Какую долю плана удалось выполнить?</label><div class="range-row"><input id="completion-rate" name="completionRate" type="range" min="0" max="100" step="5" value="${defaultRate}" /><output class="range-value" data-range-output="completionRate">${defaultRate}%</output></div><span class="field-hint">Оцени по ощущениям: это нужно, чтобы настроить нагрузку, а не поставить оценку.</span></div>` : ''}
          <div class="field"><label for="review-energy">Сколько у тебя сейчас энергии?</label><div class="range-row"><input id="review-energy" name="energy" type="range" min="1" max="5" value="3" /><output class="range-value" data-range-output="energy">3 / 5</output></div><span class="field-hint">1 — почти нет сил, 5 — чувствую себя бодро.</span></div>
          <div class="field"><label for="review-win">${isWeekly ? 'Что получилось на этой неделе?' : 'Какая маленькая победа была сегодня?'}</label><textarea class="text-area" id="review-win" name="win" placeholder="Даже небольшой шаг имеет значение"></textarea></div>
          <div class="field"><label for="review-blocker">Что помешало или отняло силы?</label><textarea class="text-area" id="review-blocker" name="blocker" placeholder="Можно оставить пустым"></textarea></div>
          <div class="field"><label for="review-next">Какой следующий шаг кажется посильным?</label><input class="text-input" id="review-next" name="nextStep" placeholder="Например: 15 минут на черновик" /></div>
          <button class="primary-button" type="submit">${isWeekly ? 'Сохранить обзор и увидеть адаптацию' : 'Сохранить вечерний обзор'} <span aria-hidden="true">→</span></button>
        </form>
      </section>
      <aside class="panel"><div class="panel-heading"><h3>Последние заметки</h3><span>${history.length} ${plural(history.length, 'обзор', 'обзора', 'обзоров')}</span></div>
        ${history.length ? `<div class="review-history">${history.map((review) => renderReviewHistoryItem(review)).join('')}</div>` : '<div class="empty-state">Здесь появятся твои вечерние и недельные выводы.</div>'}
      </aside>
    </div>`;
}

function renderReviewHistoryItem(review) {
  const title = review.type === 'weekly' ? 'Недельный обзор' : 'Вечерний обзор';
  const subtitle = review.type === 'weekly' ? `${Math.round(review.completionRate * 100)}% плана · энергия ${review.energy}/5` : `Энергия ${review.energy}/5`;
  return `<article class="review-history-item"><strong>${title} · ${formatDate(review.date)}</strong><p>${escapeHtml(subtitle)}${review.win ? ` · ${escapeHtml(review.win)}` : ''}</p>${review.nextStep ? `<p>Следующий шаг: ${escapeHtml(review.nextStep)}</p>` : ''}${review.blocker ? `<p>Помешало: ${escapeHtml(review.blocker)}</p>` : ''}${review.adaptation ? `<p>${escapeHtml(review.adaptation.title)}${review.appliedAt ? ' · применено' : ' · ждёт решения'}</p>` : ''}</article>`;
}

function renderAdaptationCard(review) {
  const adaptation = review.adaptation;
  if (!adaptation) return '<div class="adaptation-box"><p>Запиши недельный обзор, чтобы получить рекомендацию.</p></div>';
  return `<div class="adaptation-box"><div class="adaptation-top"><span class="adaptation-icon">${adaptation.type === 'soften' ? '↘' : adaptation.type === 'stretch' ? '↗' : '≈'}</span><strong>${escapeHtml(adaptation.title)}</strong></div><p>${escapeHtml(adaptation.message)}</p>${review.appliedAt ? '<div class="quest-meta" style="margin-top:10px;color:var(--green)">✓ Изменения применены</div>' : `<div class="adaptation-actions"><button class="primary-button small-button" type="button" data-action="apply-adaptation" data-review-id="${escapeHtml(review.id)}">Применить</button><button class="quiet-button small-button" type="button" data-nav="reviews">Посмотреть</button></div>`}</div>`;
}

const ATTRIBUTE_LABELS = {
  time: 'Время в неделю', energy: 'Энергия', experience: 'Опыт', confidence: 'Уверенность',
  support: 'Поддержка', focus: 'Фокус', courage: 'Смелость', creativity: 'Креативность',
};

function renderOnboarding() {
  const answers = state.profile.answers ?? {};
  const questions = getOnboardingQuestions(answers);
  const step = Math.min(Math.max(0, state.profile.onboardingStep ?? 0), questions.length);
  if (step >= questions.length) return renderCharacterReveal();
  const question = questions[step];
  const progress = Math.round((step / questions.length) * 100);
  return `<main class="setup-screen">
    <header class="setup-brand"><div class="brand-mark" aria-hidden="true">✦</div><div class="brand-name">LIFE RPG<small>ТВОЯ ИГРА, ТВОЙ ПУТЬ</small></div><span class="setup-save-note">Ответы остаются в этом браузере</span></header>
    ${!storageAvailable ? '<div class="storage-note" role="status">Браузер не сохраняет данные — можно продолжить в этой вкладке, но после закрытия ответы могут пропасть.</div>' : ''}
    <section class="setup-card" aria-labelledby="setup-title">
      <div class="setup-progress-copy"><span>СОЗДАНИЕ ПЕРСОНАЖА · BACK4HEART</span><span>Шаг ${step + 1} из ${questions.length}</span></div>
      <div class="setup-progress"><i style="width:${progress}%"></i></div>
      <div class="guide-mark" aria-hidden="true">✧</div>
      <div class="eyebrow">ПРОВОДНИК</div>
      <h1 id="setup-title">Сначала познакомимся</h1>
      <p class="setup-intro">Я помогу разобраться, чего ты хочешь от Back4Heart, а затем превращу это в понятные шаги.</p>
      <form class="setup-form" data-form="onboarding" data-question-id="${escapeHtml(question.id)}" novalidate>
        <div class="dialogue-bubble"><span class="dialogue-avatar" aria-hidden="true">✦</span><p>${escapeHtml(question.label)}</p></div>
        ${renderQuestionControl(question, answers)}
        ${ui.onboardingError ? `<div class="error-message" role="alert">${escapeHtml(ui.onboardingError)}</div>` : ''}
        <div class="wizard-footer setup-footer">
          <div>${step > 0 ? '<button class="quiet-button" type="button" data-action="onboarding-back">← Назад</button>' : ''}</div>
          <div class="wizard-footer-right">${!question.required ? '<button class="quiet-button" type="button" data-action="onboarding-skip">Пропустить</button>' : ''}<button class="primary-button" type="submit">${step === questions.length - 1 ? 'Показать персонажа' : 'Продолжить'} <span aria-hidden="true">→</span></button></div>
        </div>
      </form>
      <p class="setup-privacy">Это не психологический тест. Характеристики нужны только для настройки темпа и заданий.</p>
    </section>
  </main>`;
}

function renderQuestionControl(question, answers = {}, prefix = '') {
  const value = answers[question.id] ?? '';
  const inputId = `${prefix}answer-${question.id}`;
  if (question.type === 'choice') {
    return `<fieldset class="choice-field"><legend class="sr-only">${escapeHtml(question.label)}</legend><div class="choice-grid">${question.options.map((option) => `<label class="choice-card"><input type="radio" name="${escapeHtml(question.id)}" value="${escapeHtml(option.value)}" ${value === option.value ? 'checked' : ''} ${question.required ? 'required' : ''}><span>${escapeHtml(option.label)}</span></label>`).join('')}</div></fieldset>`;
  }
  if (question.type === 'scale') {
    const selected = value === '' ? 3 : value;
    return `<div class="setup-scale"><div class="scale-boundaries"><span>${escapeHtml(question.lowLabel)}</span><output class="range-value" data-range-output="${escapeHtml(question.id)}">${escapeHtml(selected)} / 5</output><span>${escapeHtml(question.highLabel)}</span></div><input class="setup-range" id="${escapeHtml(inputId)}" aria-label="${escapeHtml(question.label)}" name="${escapeHtml(question.id)}" type="range" min="${question.min}" max="${question.max}" value="${escapeHtml(selected)}"></div>`;
  }
  if (question.type === 'number') {
    return `<label class="sr-only" for="${escapeHtml(inputId)}">${escapeHtml(question.label)}</label><input class="text-input setup-input" id="${escapeHtml(inputId)}" name="${escapeHtml(question.id)}" type="number" min="${question.min}" max="${question.max}" step="${question.step}" value="${escapeHtml(value)}" placeholder="${escapeHtml(question.placeholder)}" ${question.required ? 'required' : ''}>`;
  }
  const minLength = ['projectDescription', 'desiredResult', 'successMetric', 'metricClarification'].includes(question.id) ? 'minlength="4"' : '';
  return `<label class="sr-only" for="${escapeHtml(inputId)}">${escapeHtml(question.label)}</label><textarea class="text-area setup-textarea" id="${escapeHtml(inputId)}" name="${escapeHtml(question.id)}" placeholder="${escapeHtml(question.placeholder ?? '')}" ${question.required ? 'required' : ''} ${minLength}>${escapeHtml(value)}</textarea>`;
}

function renderCharacterReveal() {
  const answers = state.profile.answers ?? {};
  const attributes = state.profile.attributes ?? deriveCharacter(answers).attributes;
  let preview = null;
  try { preview = buildBack4HeartCampaign(answers, attributes); } catch { /* Required fields are validated before reaching this step. */ }
  return `<main class="setup-screen">
    <header class="setup-brand"><div class="brand-mark" aria-hidden="true">✦</div><div class="brand-name">LIFE RPG<small>ТВОЯ ИГРА, ТВОЙ ПУТЬ</small></div><span class="setup-save-note">Профиль сохраняется в браузере</span></header>
    ${!storageAvailable ? '<div class="storage-note" role="status">Браузер не сохраняет данные — изменения останутся только до закрытия вкладки.</div>' : ''}
    <section class="setup-card setup-reveal" aria-labelledby="setup-title">
      <div class="eyebrow">УРОВЕНЬ 1 · ПРОФИЛЬ ИГРОКА</div>
      <h1 id="setup-title">Вот твой персонаж</h1>
      <p class="setup-intro">Характеристики рассчитаны по твоим ответам. Исправь значения, если игра поняла твой ресурс не так.</p>
      <form class="attribute-editor" data-form="character-summary">${renderAttributeEditor(attributes, state.profile.attributeEvidence)}<button class="quiet-button small-button" type="submit">Сохранить характеристики</button></form>
      ${preview ? `<section class="campaign-preview"><div class="panel-heading"><h2>Первая кампания</h2><span>BACK4HEART</span></div><div class="preview-goal"><span>Цель</span><strong>${escapeHtml(preview.title)}</strong><span>Проверка результата</span><p>${escapeHtml(preview.answers.successMetric)}</p></div>${renderCampaignPreview(preview)}</section>` : `<div class="error-message" role="alert">Не получилось собрать маршрут. Вернись к ответам и уточни результат.</div>`}
      ${ui.onboardingError ? `<div class="error-message" role="alert">${escapeHtml(ui.onboardingError)}</div>` : ''}
      <div class="wizard-footer setup-footer"><button class="quiet-button" type="button" data-action="onboarding-back">← Вернуться к ответам</button><button class="primary-button" type="button" data-action="finish-setup" ${preview ? '' : 'disabled'}>Запустить Back4Heart <span aria-hidden="true">→</span></button></div>
    </section>
  </main>`;
}

function renderAttributeEditor(attributes = {}, evidence = {}) {
  return `<div class="attribute-grid">${Object.entries(ATTRIBUTE_LABELS).map(([key, label]) => {
    const value = attributes[key] ?? (key === 'time' ? 3 : 3);
    const control = key === 'time'
      ? `<input class="text-input attribute-number" type="number" name="attribute-${key}" min="0" max="40" step="0.5" value="${escapeHtml(value)}"><span class="attribute-unit">ч / нед.</span>`
      : `<div class="range-row"><input type="range" name="attribute-${key}" min="1" max="5" value="${escapeHtml(value)}"><output class="range-value" data-range-output="attribute-${key}">${escapeHtml(value)} / 5</output></div>`;
    return `<label class="attribute-card"><span class="attribute-name">${escapeHtml(label)}</span>${control}<span class="attribute-evidence">${escapeHtml(evidence[key] ?? 'Оценка по твоим ответам.')}</span></label>`;
  }).join('')}</div>`;
}

function renderCampaignPreview(campaign) {
  return `<div class="preview-list">${campaign.milestones.map((phase, index) => `<div class="preview-phase"><span class="preview-phase-number">${index + 1}</span><span><strong>${escapeHtml(phase.title)}</strong><span>${phase.quests.map((quest) => `${escapeHtml(quest.title)} · ${quest.minutes} мин`).join(' · ')}</span></span></div>`).join('')}</div>`;
}

function buildBack4HeartCampaign(answers, attributes, previousCampaign = null) {
  const targetDate = previousCampaign?.targetDate ?? toDateKey(addDays(new Date(), 84));
  return generateCampaign({
    projectName: 'Back4Heart',
    projectDescription: answers.projectDescription,
    title: answers.desiredResult,
    why: answers.why,
    targetDate,
    answers,
    attributes,
    assessment: {
      weeklyHours: attributes.time,
      energy: attributes.energy,
      confidence: attributes.confidence,
      resources: answers.resources ?? '',
      support: answers.support ?? '',
      barriers: answers.obstacle ?? '',
    },
  });
}

function renderCharacterPage() {
  const edit = ui.characterEditDraft;
  const answers = edit?.answers ?? state.profile.answers;
  const attributes = edit?.attributes ?? state.profile.attributes;
  const evidence = edit?.evidence ?? state.profile.attributeEvidence;
  const questions = getOnboardingQuestions(answers);
  const campaign = activeCampaign();
  return `<section class="character-page">
    <div class="page-intro"><div><h2>Карточка персонажа</h2><p>Измени ответы или характеристики — будущие шаги подстроятся под твои условия.</p></div><span class="category-tag">${escapeHtml(campaign?.projectName || 'Back4Heart')}</span></div>
    <form class="panel character-form" data-form="character-edit">
      <div class="section-heading character-section-title"><div><h2>Твои ответы</h2><p>Можно обновить контекст проекта в любое время</p></div></div>
      <div class="character-answers">${questions.map((question) => {
        const label = `${escapeHtml(question.label)}${question.required ? ' <span aria-hidden="true">*</span>' : ''}`;
        const labelMarkup = question.type === 'choice'
          ? `<span class="field-label">${label}</span>`
          : `<label for="edit-answer-${escapeHtml(question.id)}">${label}</label>`;
        return `<div class="field">${labelMarkup}${renderQuestionControl(question, answers, 'edit-')}</div>`;
      }).join('')}</div>
      <div class="section-heading character-section-title"><div><h2>Характеристики</h2><p>Настрой вручную, если оценки по ответам не совпадают с ощущениями</p></div></div>
      ${renderAttributeEditor(attributes, evidence)}
      <div class="wizard-footer"><span></span><button class="primary-button" type="submit">Показать обновлённый маршрут <span aria-hidden="true">→</span></button></div>
    </form>
    ${edit?.needsClarification ? '<div class="storage-note" role="status">Добавь конкретную проверку результата в появившемся вопросе — после этого покажу обновлённый маршрут.</div>' : ''}
    ${edit?.campaign ? `<section class="campaign-preview character-update-preview"><div class="panel-heading"><h2>Предпросмотр изменений</h2><span>Готово к подтверждению</span></div><p class="field-hint">Выполненные, перенесённые и заблокированные квесты сохранятся. Будут обновлены только открытые шаги.</p>${!edit.replacesCampaignId && campaign ? `<p class="field-hint">Кампания «${escapeHtml(campaign.title)}» останется без изменений. Back4Heart откроется отдельной активной кампанией.</p>` : ''}<div class="preview-goal"><span>Новый результат</span><strong>${escapeHtml(edit.campaign.title)}</strong><span>Критерий проверки</span><p>${escapeHtml(edit.campaign.answers.successMetric)}</p></div>${renderCampaignPreview(edit.campaign)}<div class="wizard-footer"><button class="quiet-button" type="button" data-action="cancel-character-update">Отмена</button><button class="primary-button" type="button" data-action="apply-character-update">Применить изменения</button></div></section>` : ''}
  </section>`;
}

function persistOnboardingDraft(answers, onboardingStep) {
  const character = deriveCharacter(answers);
  state = {
    ...state,
    profile: {
      ...state.profile,
      setupComplete: false,
      answers: { ...answers },
      onboardingStep,
      attributes: character.attributes,
      attributeEvidence: character.evidence,
      updatedAt: new Date().toISOString(),
    },
  };
  save('Ответ сохранён');
}

function characterFromForm(data, answers) {
  const derived = deriveCharacter(answers);
  const attributes = { ...derived.attributes };
  const evidence = { ...derived.evidence };
  for (const key of Object.keys(ATTRIBUTE_LABELS)) {
    const raw = Number(data[`attribute-${key}`]);
    if (!Number.isFinite(raw)) continue;
    const value = key === 'time'
      ? Math.min(40, Math.max(0, raw))
      : Math.min(5, Math.max(1, Math.round(raw)));
    attributes[key] = value;
    if (value !== derived.attributes[key]) {
      evidence[key] = key === 'time' ? `Настроено тобой: ${value} ч/неделю.` : `Настроено тобой: ${value}/5.`;
    }
  }
  return { attributes, evidence };
}

function handleOnboardingSubmit(form, data) {
  const step = state.profile.onboardingStep ?? 0;
  const questions = getOnboardingQuestions(state.profile.answers);
  const question = questions[step];
  if (!question) return;
  const answers = { ...state.profile.answers };
  const value = String(data[question.id] ?? '').trim();
  if (question.required && !value) {
    ui.onboardingError = 'Ответь на этот вопрос, чтобы маршрут получился точнее.';
    render();
    return;
  }
  if (value) answers[question.id] = value;
  else delete answers[question.id];
  if (question.id === 'metricCheck' && value === 'clear') delete answers.metricClarification;
  const nextQuestions = getOnboardingQuestions(answers);
  persistOnboardingDraft(answers, Math.min(step + 1, nextQuestions.length));
  ui.onboardingError = '';
  render();
}

function skipOnboardingQuestion() {
  const step = state.profile.onboardingStep ?? 0;
  const questions = getOnboardingQuestions(state.profile.answers);
  const question = questions[step];
  if (!question || question.required) return;
  persistOnboardingDraft(state.profile.answers, Math.min(step + 1, questions.length));
  ui.onboardingError = '';
  render();
}

function goBackOnboarding() {
  const step = Math.max(0, (state.profile.onboardingStep ?? 0) - 1);
  state = { ...state, profile: { ...state.profile, onboardingStep: step } };
  save('Можно продолжить с этого шага');
  ui.onboardingError = '';
  render();
}

function handleCharacterSummarySubmit(data) {
  const character = characterFromForm(data, state.profile.answers);
  state = {
    ...state,
    profile: {
      ...state.profile,
      attributes: character.attributes,
      attributeEvidence: character.evidence,
      updatedAt: new Date().toISOString(),
    },
  };
  save('Характеристики сохранены');
  ui.onboardingError = '';
  render();
}

function finishCharacterSetup() {
  try {
    const answers = state.profile.answers;
    const campaign = buildBack4HeartCampaign(answers, state.profile.attributes);
    state = {
      ...state,
      profile: { ...state.profile, setupComplete: true, updatedAt: new Date().toISOString() },
      campaigns: [campaign, ...state.campaigns],
      activeCampaignId: campaign.id,
    };
    save('Персонаж создан — кампания Back4Heart готова');
    ui.view = 'dashboard';
    ui.characterEditDraft = null;
    ui.expandedPhases = new Set([campaign.milestones[0].id]);
    ui.collapsedPhases.clear();
    ui.onboardingError = '';
  } catch (error) {
    ui.onboardingError = error.message || 'Не получилось создать кампанию. Проверь ответы о цели и результате.';
  }
  render();
}

function handleCharacterEditSubmit(data) {
  const oldAnswers = state.profile.answers ?? {};
  const questionSet = getOnboardingQuestions({
    ...oldAnswers,
    metricCheck: data.metricCheck ?? oldAnswers.metricCheck,
  });
  const answers = {};
  for (const question of questionSet) {
    if (data[question.id] !== undefined && String(data[question.id]).trim()) {
      answers[question.id] = String(data[question.id]).trim();
    }
  }
  if (answers.metricCheck === 'clear') delete answers.metricClarification;
  const character = characterFromForm(data, answers);
  if (answers.metricCheck === 'unclear' && !answers.metricClarification) {
    ui.characterEditDraft = { answers, ...character, needsClarification: true };
    render();
    return;
  }
  try {
    const previousCampaign = activeCampaign();
    const replacesCampaign = previousCampaign?.projectName === 'Back4Heart' ? previousCampaign : null;
    const campaign = buildBack4HeartCampaign(answers, character.attributes, replacesCampaign);
    ui.characterEditDraft = { answers, ...character, campaign, replacesCampaignId: replacesCampaign?.id ?? null };
  } catch (error) {
    ui.toast = error.message || 'Проверь результат и критерий успеха.';
  }
  render();
}

function applyCharacterEdit() {
  const edit = ui.characterEditDraft;
  if (!edit) return;
  const campaignUpdate = applyCharacterCampaignUpdate(state.campaigns, edit.replacesCampaignId, edit.campaign);
  state = {
    ...state,
    profile: {
      ...state.profile,
      setupComplete: true,
      answers: edit.answers,
      attributes: edit.attributes,
      attributeEvidence: edit.evidence,
      updatedAt: new Date().toISOString(),
    },
    campaigns: campaignUpdate.campaigns,
    activeCampaignId: campaignUpdate.activeCampaignId,
  };
  save('Профиль обновлён — открытые квесты подстроены');
  ui.characterEditDraft = null;
  ui.view = 'dashboard';
  render();
}

function renderModal() {
  if (!ui.modal) {
    modalRoot.innerHTML = '';
    return;
  }
  modalRoot.innerHTML = `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal-card ${ui.modal.type === 'wizard' ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">${ui.modal.type === 'wizard' ? renderWizard() : renderQuestModal(ui.modal.questId)}</section></div>`;
  const firstField = modalRoot.querySelector('input, textarea, button');
  firstField?.focus({ preventScroll: true });
}

function renderWizard() {
  const draft = ui.wizardDraft ?? emptyDraft();
  const questionSet = buildQuestions(draft.title);
  const stepLabel = ['Цель', 'Уточнение', 'Стартовые условия'][ui.wizardStep - 1];
  let content = '';

  if (ui.wizardStep === 1) {
    content = `<div class="wizard-form">
      <div class="field"><label for="goal-title">Какую большую цель превращаем в кампанию?</label><input class="text-input" id="goal-title" name="title" required maxlength="120" value="${escapeHtml(draft.title)}" placeholder="Например: перейти на новую профессию" /><span class="field-hint">Сформулируй цель так, как ты сам её понимаешь. Категорию подберём автоматически.</span></div>
      <div class="field"><label for="goal-why">Почему это для тебя важно?</label><textarea class="text-area" id="goal-why" name="why" maxlength="300" placeholder="Это поможет сохранить смысл пути">${escapeHtml(draft.why)}</textarea></div>
      <div class="form-row"><div class="field"><label for="goal-date">Желаемый срок</label><input class="text-input" id="goal-date" name="targetDate" type="date" value="${escapeHtml(draft.targetDate)}" /></div><div class="field"><span class="field-label">Подход</span><span class="field-hint">Сначала составим план из коротких этапов. Его можно будет настроить после обзоров.</span></div></div>
    </div>`;
  } else if (ui.wizardStep === 2) {
    content = `<div class="wizard-form"><span class="category-tag">Тема: ${categoryLabel(questionSet.category)}</span><div class="assessment-grid">${questionSet.questions.map((question) => `<div class="field ${question.id === 'obstacle' ? 'wide-field' : ''}"><label for="answer-${question.id}">${escapeHtml(question.label)}</label><textarea class="text-area" id="answer-${question.id}" name="${question.id}" placeholder="${escapeHtml(question.placeholder)}" required>${escapeHtml(draft.answers[question.id] ?? '')}</textarea></div>`).join('')}</div><span class="field-hint">Ответы помогут сделать первые квесты ближе к твоей ситуации. Их можно изменить после создания кампании.</span></div>`;
  } else {
    let preview = null;
    try {
      preview = generateCampaign({ ...draft, assessment: draft.assessment }, new Date());
    } catch { /* The final submit displays the validation message if generation fails. */ }
    content = `<div class="wizard-form">
      <div class="assessment-grid">
        <div class="field"><label for="weekly-hours">Сколько часов в неделю доступно?</label><input class="text-input" id="weekly-hours" name="weeklyHours" type="number" min="0" max="40" step="0.5" value="${escapeHtml(draft.assessment.weeklyHours ?? 4)}" /><span class="field-hint">Можно начать даже с одного часа.</span></div>
        <div class="field"><label for="resources">Какие ресурсы уже есть?</label><input class="text-input" id="resources" name="resources" value="${escapeHtml(draft.assessment.resources ?? '')}" placeholder="Инструменты, деньги, материалы" /></div>
        <div class="field"><label for="energy">Твоя энергия в среднем</label><div class="range-row"><input id="energy" name="energy" type="range" min="1" max="5" value="${escapeHtml(draft.assessment.energy ?? 3)}"/><output class="range-value" data-range-output="energy">${escapeHtml(draft.assessment.energy ?? 3)} / 5</output></div></div>
        <div class="field"><label for="confidence">Уверенность в нужных навыках</label><div class="range-row"><input id="confidence" name="confidence" type="range" min="1" max="5" value="${escapeHtml(draft.assessment.confidence ?? 3)}"/><output class="range-value" data-range-output="confidence">${escapeHtml(draft.assessment.confidence ?? 3)} / 5</output></div></div>
        <div class="field wide-field"><label for="support">Кто или что может поддержать?</label><input class="text-input" id="support" name="support" value="${escapeHtml(draft.assessment.support ?? '')}" placeholder="Люди, сообщество или удобная среда" /></div>
      </div>
      ${preview ? `<div><div class="section-heading" style="margin:7px 0 10px"><div><h2>Черновик маршрута</h2><p>4 этапа · 12 квестов · можно менять по ходу пути</p></div><span class="category-tag">ресурс ${preview.resourceScore}/100</span></div>${preview.deadlineAdjusted ? '<div class="storage-note" style="margin:0 0 10px">⌛ Выбранная дата уже прошла. Поставим ориентир на сегодня, чтобы маршрут шёл вперёд.</div>' : ''}<div class="preview-list">${preview.milestones.map((phase, index) => `<div class="preview-phase"><span class="preview-phase-number">${index + 1}</span><span><strong>${escapeHtml(phase.title)}</strong><span>${escapeHtml(phase.quests[0].title)} · ${escapeHtml(phase.quests[1].title)} · контрольная точка</span></span></div>`).join('')}</div></div>` : ''}
    </div>`;
  }

  return `<div class="modal-header"><div><span class="eyebrow">НОВАЯ КАМПАНИЯ · ШАГ ${ui.wizardStep} ИЗ 3</span><h2 id="modal-title">${stepLabel}</h2><p>${ui.wizardStep === 1 ? 'Любая большая цель начинается с того, что ты называешь её.' : ui.wizardStep === 2 ? 'Пара уточнений — чтобы квесты опирались на твою реальность.' : 'Сверим ресурс и покажем будущую карту.'}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Закрыть окно">×</button></div>
    <div class="wizard-steps" aria-label="Шаг ${ui.wizardStep} из 3">${[1, 2, 3].map((step) => `<span class="wizard-step ${step < ui.wizardStep ? 'done' : step === ui.wizardStep ? 'active' : ''}"></span>`).join('')}</div>
    <form class="wizard-form" data-form="wizard" data-step="${ui.wizardStep}" novalidate>${content}${ui.wizardError ? `<div class="error-message" role="alert">${escapeHtml(ui.wizardError)}</div>` : ''}
      <div class="wizard-footer"><div>${ui.wizardStep > 1 ? '<button class="quiet-button" type="button" data-action="wizard-back">← Назад</button>' : ''}</div><div class="wizard-footer-right"><button class="quiet-button" type="button" data-action="close-modal">Отмена</button><button class="primary-button" type="submit">${ui.wizardStep < 3 ? 'Дальше' : 'Создать кампанию'} <span aria-hidden="true">→</span></button></div></div>
    </form>`;
}

function renderQuestModal(questId) {
  const campaign = activeCampaign();
  const quest = allQuests(campaign).find((item) => item.id === questId);
  const phase = campaign?.milestones.find((item) => item.quests.some((candidate) => candidate.id === questId));
  if (!quest) return '<div class="empty-state">Этот квест больше не найден.</div>';
  const done = quest.status === 'done';
  return `<div class="modal-header"><div><span class="eyebrow">${escapeHtml(phase?.title ?? 'КВЕСТ')}</span><h2 id="modal-title">${done ? 'Квест завершён' : quest.status === 'blocked' ? 'Квест ждёт помощи' : 'Твой следующий шаг'}</h2></div><button class="modal-close" type="button" data-action="close-modal" aria-label="Закрыть окно">×</button></div>
    <div class="quest-detail"><span class="category-tag">${quest.kind === 'checkpoint' ? 'Контрольная точка' : quest.kind === 'research' ? 'Исследование' : 'Практика'}</span><h3 class="quest-detail-title">${escapeHtml(quest.title)}</h3><p class="quest-detail-copy">${escapeHtml(quest.description)}</p><div class="criteria-box"><small>Критерий успеха</small><p>${escapeHtml(quest.successCriteria)}</p></div><div class="quest-detail-meta"><span class="meta-pill">◷ ${quest.minutes} минут</span><span class="meta-pill">К сроку ${formatDate(quest.dueDate)}</span><span class="reward-chip">✦ +${quest.xp} XP</span><span class="reward-chip">◈ +${Math.ceil(quest.xp / 10)}</span></div>
      ${done ? `<div class="success-banner"><span>✓</span><span>Этот шаг уже отмечен. ${quest.note ? `Твоя заметка: ${escapeHtml(quest.note)}` : 'Опыт начислен.'}</span></div>` : `<form class="wizard-form" data-form="quest-action" data-quest-id="${escapeHtml(quest.id)}"><div class="field"><label for="quest-note">Что получилось или что помешало?</label><textarea class="text-area" id="quest-note" name="note" placeholder="Короткая заметка для себя"></textarea></div><div class="modal-actions"><button class="quiet-button small-button" type="submit" name="action" value="postpone">Перенести на 3 дня</button><div class="modal-actions-right">${quest.status === 'blocked' ? '<button class="secondary-button small-button" type="submit" name="action" value="resume">Вернуть в маршрут</button>' : '<button class="quiet-button small-button" type="submit" name="action" value="blocked">Нужна помощь</button>'}<button class="primary-button small-button" type="submit" name="action" value="done">✓ Выполнено</button></div></div></form>`}
    </div>`;
}

function emptyDraft() {
  const target = new Date();
  target.setDate(target.getDate() + 84);
  return {
    title: '', why: '', targetDate: toDateKey(target), answers: {},
    assessment: { weeklyHours: 4, energy: 3, confidence: 3, resources: '', support: '' },
  };
}

function updateQuest(campaignId, questId, changes) {
  return {
    ...state,
    campaigns: state.campaigns.map((campaign) => campaign.id !== campaignId ? campaign : {
      ...campaign,
      milestones: campaign.milestones.map((phase) => ({
        ...phase,
        quests: phase.quests.map((quest) => quest.id === questId ? { ...quest, ...changes } : quest),
      })),
    }),
  };
}

function beginWizard() {
  ui.wizardDraft = emptyDraft();
  ui.wizardStep = 1;
  ui.wizardError = '';
  ui.modal = { type: 'wizard' };
  render();
}

function handleClick(event) {
  const nav = event.target.closest('[data-nav]');
  if (nav) {
    ui.view = nav.dataset.nav;
    ui.modal = null;
    ui.characterEditDraft = null;
    ui.toast = '';
    render();
    window.scrollTo(0, 0);
    return;
  }
  const phase = event.target.closest('[data-phase-id]');
  if (phase) {
    const id = phase.dataset.phaseId;
    if (phase.getAttribute('aria-expanded') === 'true') {
      ui.expandedPhases.delete(id);
      ui.collapsedPhases.add(id);
    } else {
      ui.expandedPhases.add(id);
      ui.collapsedPhases.delete(id);
    }
    render();
    return;
  }
  const quest = event.target.closest('[data-open-quest]');
  if (quest) {
    ui.modal = { type: 'quest', questId: quest.dataset.openQuest };
    render();
    return;
  }
  const reviewTab = event.target.closest('[data-review-type]');
  if (reviewTab) {
    ui.reviewType = reviewTab.dataset.reviewType;
    ui.toast = '';
    render();
    return;
  }
  const action = event.target.closest('[data-action]');
  if (!action) return;
  switch (action.dataset.action) {
    case 'new-campaign': beginWizard(); break;
    case 'close-modal': ui.modal = null; ui.wizardError = ''; render(); break;
    case 'wizard-back': wizardBack(); break;
    case 'onboarding-back': goBackOnboarding(); break;
    case 'onboarding-skip': skipOnboardingQuestion(); break;
    case 'finish-setup': finishCharacterSetup(); break;
    case 'apply-character-update': applyCharacterEdit(); break;
    case 'cancel-character-update': ui.characterEditDraft = null; ui.toast = ''; render(); break;
    case 'apply-adaptation': applyWeeklyAdaptation(action.dataset.reviewId); break;
    case 'reset': resetDemo(); break;
    case 'backdrop-close': if (event.target === action) { ui.modal = null; render(); } break;
  }
}

function wizardBack() {
  const form = modalRoot.querySelector('form[data-form="wizard"]');
  if (form) {
    const data = Object.fromEntries(new FormData(form).entries());
    if (form.dataset.step === '2') {
      ui.wizardDraft.answers = {
        successMetric: String(data.successMetric ?? '').trim(),
        baseline: String(data.baseline ?? '').trim(),
        schedule: String(data.schedule ?? '').trim(),
        obstacle: String(data.obstacle ?? '').trim(),
      };
    }
    if (form.dataset.step === '3') {
      ui.wizardDraft.assessment = {
        weeklyHours: Number(data.weeklyHours) || 0,
        energy: Number(data.energy) || 1,
        confidence: Number(data.confidence) || 1,
        resources: String(data.resources ?? '').trim(),
        support: String(data.support ?? '').trim(),
        barriers: ui.wizardDraft.answers.obstacle,
      };
    }
  }
  ui.wizardStep = Math.max(1, ui.wizardStep - 1);
  ui.wizardError = '';
  render();
}

function handleSubmit(event) {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  const data = Object.fromEntries(new FormData(form).entries());
  if (form.dataset.form === 'wizard') handleWizardSubmit(form.dataset.step, data);
  if (form.dataset.form === 'quest-action') handleQuestSubmit(form.dataset.questId, data, event.submitter?.value);
  if (form.dataset.form === 'review') handleReviewSubmit(data);
  if (form.dataset.form === 'onboarding') handleOnboardingSubmit(form, data);
  if (form.dataset.form === 'character-summary') handleCharacterSummarySubmit(data);
  if (form.dataset.form === 'character-edit') handleCharacterEditSubmit(data);
}

function handleWizardSubmit(stepString, data) {
  const step = Number(stepString);
  ui.wizardError = '';
  if (step === 1) {
    const title = String(data.title ?? '').trim();
    if (countCharacters(title) < 4) {
      ui.wizardError = 'Добавь несколько слов, чтобы цель можно было превратить в маршрут.';
      render();
      return;
    }
    ui.wizardDraft = { ...ui.wizardDraft, title, why: String(data.why ?? '').trim(), targetDate: data.targetDate || '' };
    ui.wizardStep = 2;
    render();
    return;
  }
  if (step === 2) {
    ui.wizardDraft.answers = {
      successMetric: String(data.successMetric ?? '').trim(),
      baseline: String(data.baseline ?? '').trim(),
      schedule: String(data.schedule ?? '').trim(),
      obstacle: String(data.obstacle ?? '').trim(),
    };
    ui.wizardStep = 3;
    render();
    return;
  }
  ui.wizardDraft.assessment = {
    weeklyHours: Number(data.weeklyHours) || 0,
    energy: Number(data.energy) || 1,
    confidence: Number(data.confidence) || 1,
    resources: String(data.resources ?? '').trim(),
    support: String(data.support ?? '').trim(),
    barriers: ui.wizardDraft.answers.obstacle,
  };
  try {
    const campaign = generateCampaign(ui.wizardDraft);
    state = {
      ...state,
      campaigns: [campaign, ...state.campaigns],
      activeCampaignId: campaign.id,
    };
    save(campaign.deadlineAdjusted ? 'Срок уже прошёл — ориентир кампании перенесён на сегодня' : 'Кампания создана — первый шаг уже на карте');
    ui.view = 'dashboard';
    ui.modal = null;
    ui.expandedPhases = new Set([campaign.milestones[0].id]);
    ui.collapsedPhases.clear();
  } catch (error) {
    ui.wizardError = error.message || 'Не удалось создать кампанию. Проверь формулировку цели.';
  }
  render();
}

function handleQuestSubmit(questId, data, action) {
  const campaign = activeCampaign();
  if (!campaign) return;
  if (action === 'done') {
    state = completeQuest(state, campaign.id, questId, data.note, new Date());
    save('Квест завершён — награда добавлена');
  } else if (action === 'postpone') {
    const quest = allQuests(campaign).find((item) => item.id === questId);
    const today = toDateKey(new Date());
    const baseDate = quest.dueDate && quest.dueDate > today ? quest.dueDate : today;
    state = updateQuest(campaign.id, questId, {
      status: 'postponed',
      note: String(data.note ?? '').trim(),
      dueDate: toDateKey(addDays(new Date(`${baseDate}T12:00:00`), 3)),
    });
    save('Квест перенесён на три дня');
  } else if (action === 'blocked') {
    state = updateQuest(campaign.id, questId, { status: 'blocked', note: String(data.note ?? '').trim() });
    save('Отметили препятствие — вернёшься к нему позже');
  } else if (action === 'resume') {
    state = updateQuest(campaign.id, questId, { status: 'open', note: String(data.note ?? '').trim() });
    save('Квест снова в маршруте');
  }
  ui.modal = null;
  render();
}

function handleReviewSubmit(data) {
  const campaign = activeCampaign();
  if (!campaign) return;
  const review = {
    id: globalThis.crypto?.randomUUID?.() ?? `review-${Date.now()}`,
    campaignId: campaign.id,
    type: ui.reviewType,
    date: new Date().toISOString(),
    energy: Number(data.energy),
    win: String(data.win ?? '').trim(),
    blocker: String(data.blocker ?? '').trim(),
    nextStep: String(data.nextStep ?? '').trim(),
    completionRate: ui.reviewType === 'weekly' ? Number(data.completionRate) / 100 : null,
    adaptation: null,
    appliedAt: null,
  };
  if (review.type === 'weekly') review.adaptation = buildAdaptation(review, campaign);
  state = { ...state, reviews: [review, ...state.reviews] };
  save(review.type === 'weekly' ? 'Обзор готов — посмотри рекомендацию' : 'Вечерний обзор сохранён');
  render();
}

function applyWeeklyAdaptation(reviewId) {
  const review = state.reviews.find((item) => item.id === reviewId);
  if (!review || !review.adaptation || review.appliedAt) return;
  state = {
    ...state,
    campaigns: state.campaigns.map((campaign) => campaign.id === review.campaignId
      ? applyAdaptation(campaign, review.adaptation, new Date())
      : campaign),
    reviews: state.reviews.map((item) => item.id === reviewId ? { ...item, appliedAt: new Date().toISOString() } : item),
  };
  save('Адаптация применена — сроки и темп обновлены');
  render();
}

function resetDemo() {
  if (!window.confirm('Удалить сохранённый прогресс и начать настройку персонажа заново?')) return;
  state = createInitialState();
  save('Настройка персонажа начата заново');
  ui.view = 'onboarding';
  ui.characterEditDraft = null;
  ui.modal = null;
  ui.expandedPhases.clear();
  ui.collapsedPhases.clear();
  render();
}

function nextQuests(campaign) {
  const list = allQuests(campaign).filter((quest) => quest.status === 'open' || quest.status === 'postponed');
  list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (list.length) return list;
  return allQuests(campaign).filter((quest) => quest.status === 'blocked');
}

function categoryLabel(category) {
  return ({ money: 'Деньги', health: 'Здоровье', career: 'Карьера', general: 'Личная цель' })[category] ?? 'Личная цель';
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.valueOf())) return 'без срока';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date).replace('.', '');
}

function plural(count, one, few, many) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

document.addEventListener('click', handleClick);
document.addEventListener('submit', handleSubmit);
document.addEventListener('input', (event) => {
  const input = event.target;
  if (input.matches('input[type="range"][name]')) {
    const output = document.querySelector(`[data-range-output="${input.name}"]`);
    if (output) output.textContent = input.name === 'completionRate' ? `${input.value}%` : input.name === 'attribute-time' ? `${input.value} ч` : `${input.value} / 5`;
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && ui.modal) {
    ui.modal = null;
    render();
  }
});

render();

