import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCampaign } from '../src/domain.js';
import { createInitialState, loadState, saveState } from '../src/storage.js';

const now = new Date('2026-10-19T12:00:00');

function memoryStorage() {
  const entries = new Map();
  return {
    getItem(key) { return entries.get(key) ?? null; },
    setItem(key, value) { entries.set(key, String(value)); },
  };
}

function legacyState() {
  const campaign = generateCampaign({
    title: 'Собрать первую версию Back4Heart',
    why: 'Хочу запустить проект',
    targetDate: '2026-12-14',
    answers: {
      successMetric: 'Опубликовать версию и получить три отзыва',
      baseline: 'Пока есть только идея',
      schedule: 'Три вечера в неделю',
      obstacle: 'Не хватает времени',
    },
    assessment: { weeklyHours: 4, energy: 3, confidence: 3 },
  }, now);
  delete campaign.projectName;
  delete campaign.projectDescription;
  delete campaign.attributes;
  campaign.milestones[0].quests[0].status = 'done';
  campaign.milestones[0].quests[0].note = 'Определил идею';
  campaign.milestones[0].quests[1].status = 'postponed';
  campaign.milestones[0].quests[2].status = 'blocked';
  return {
    version: 1,
    profile: { xp: 135, coins: 17, streak: 3, lastActiveDate: '2026-10-18', badges: ['Первый шаг'] },
    campaigns: [campaign],
    reviews: [{ id: 'review-1', type: 'weekly', date: '2026-10-18', energy: 3, win: 'Уточнил идею', blocker: 'Мало времени', nextStep: 'Выделить час' }],
    activeCampaignId: campaign.id,
  };
}

test('clean first launch starts character setup without a demo campaign', () => {
  const state = createInitialState(now);

  assert.equal(state.version, 2);
  assert.equal(state.profile.setupComplete, false);
  assert.equal(state.profile.onboardingStep, 0);
  assert.deepEqual(state.profile.answers, {});
  assert.deepEqual(state.profile.attributes, {
    time: 3, energy: 3, experience: 3, confidence: 3,
    support: 3, focus: 3, courage: 3, creativity: 3,
  });
  assert.equal(state.activeCampaignId, null);
  assert.deepEqual(state.campaigns, []);
  assert.equal(state.profile.xp, 0);
});

test('v1 migration preserves profile progress reviews and quest statuses', () => {
  const storage = memoryStorage();
  const legacy = legacyState();
  const legacyText = JSON.stringify(legacy);
  storage.setItem('life-rpg-state-v1', legacyText);

  const state = loadState(storage, now);
  const quests = state.campaigns[0].milestones.flatMap((phase) => phase.quests);

  assert.equal(state.version, 2);
  assert.equal(state.profile.xp, 135);
  assert.equal(state.profile.coins, 17);
  assert.equal(state.profile.streak, 3);
  assert.deepEqual(state.profile.badges, ['Первый шаг']);
  assert.equal(state.profile.setupComplete, false);
  assert.deepEqual(state.reviews, legacy.reviews);
  assert.deepEqual(quests.slice(0, 3).map((quest) => quest.status), ['done', 'postponed', 'blocked']);
  assert.equal(quests[0].note, 'Определил идею');
  assert.equal(state.campaigns[0].answers.successMetric, legacy.campaigns[0].answers.successMetric);
  assert.equal(state.activeCampaignId, legacy.activeCampaignId);
  assert.equal(state.campaigns[0].projectName, '');
  assert.equal(storage.getItem('life-rpg-state-v1'), legacyText);
  assert.equal(JSON.parse(storage.getItem('life-rpg-state-v2')).version, 2);
});

test('v2 round-trip preserves an interrupted interview', () => {
  const storage = memoryStorage();
  const state = createInitialState(now);
  state.profile.onboardingStep = 7;
  state.profile.answers = {
    projectDescription: 'Платформа Back4Heart для волонтёрской помощи',
    desiredResult: 'Опубликовать первую версию',
    successMetric: 'Версия доступна по ссылке',
    metricCheck: 'clear',
    weeklyHours: '4',
  };

  assert.equal(saveState(storage, state), true);
  assert.deepEqual(loadState(storage, now), state);
  assert.equal(storage.getItem('life-rpg-state-v1'), null);
});

test('v2 round-trip preserves the conditional metric clarification step', () => {
  const storage = memoryStorage();
  const state = createInitialState(now);
  state.profile.onboardingStep = 17;
  state.profile.answers = {
    projectDescription: 'Приложение Back4Heart для поддержки после расставания',
    desiredResult: 'Опубликовать первую версию приложения',
    successMetric: 'Узнать, что пользователям полезно',
    metricCheck: 'unclear',
    metricClarification: 'Рабочая версия опубликована по ссылке и проверена пятью пользователями',
  };

  assert.equal(saveState(storage, state), true);
  assert.deepEqual(loadState(storage, now), state);
});

test('valid v2 state takes precedence over a legacy recovery copy', () => {
  const storage = memoryStorage();
  const legacy = legacyState();
  const current = createInitialState(now);
  current.profile.answers = { desiredResult: 'Мой текущий ответ' };
  storage.setItem('life-rpg-state-v1', JSON.stringify(legacy));
  storage.setItem('life-rpg-state-v2', JSON.stringify(current));

  assert.deepEqual(loadState(storage, now), current);
});

test('corrupt storage returns clean setup state without fabricated progress', () => {
  const storage = memoryStorage();
  storage.setItem('life-rpg-state-v2', '{bad json');
  storage.setItem('life-rpg-state-v1', '{bad json');

  const state = loadState(storage, now);

  assert.equal(state.version, 2);
  assert.equal(state.profile.setupComplete, false);
  assert.equal(state.campaigns.length, 0);
  assert.equal(state.profile.xp, 0);
});

test('inconsistent completed interview cannot bypass required setup answers', () => {
  const storage = memoryStorage();
  const corrupt = createInitialState(now);
  corrupt.profile.onboardingStep = 17;
  corrupt.profile.answers = {
    projectDescription: 'Проект Back4Heart',
    desiredResult: 'Опубликовать первую версию',
    successMetric: 'Версия опубликована',
  };
  storage.setItem('life-rpg-state-v2', JSON.stringify(corrupt));

  const recovered = loadState(storage, now);

  assert.equal(recovered.profile.setupComplete, false);
  assert.equal(recovered.profile.onboardingStep, 0);
  assert.deepEqual(recovered.campaigns, []);
});

test('completed character profile must have an active campaign', () => {
  const storage = memoryStorage();
  const corrupt = createInitialState(now);
  corrupt.profile.setupComplete = true;
  corrupt.profile.answers = {
    projectDescription: 'Проект Back4Heart',
    desiredResult: 'Опубликовать первую версию',
    successMetric: 'Версия опубликована',
    metricCheck: 'clear',
  };
  storage.setItem('life-rpg-state-v2', JSON.stringify(corrupt));

  const recovered = loadState(storage, now);

  assert.equal(recovered.profile.setupComplete, false);
  assert.equal(recovered.campaigns.length, 0);
});

test('blocked storage access does not throw', () => {
  const blockedStorage = {
    getItem() { throw new Error('Storage is disabled'); },
    setItem() { throw new Error('Storage is disabled'); },
  };

  assert.equal(loadState(blockedStorage, now).profile.setupComplete, false);
  assert.equal(saveState(blockedStorage, createInitialState(now)), false);
});

