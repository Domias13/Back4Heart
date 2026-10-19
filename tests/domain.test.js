import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAdaptation,
  applyCharacterCampaignUpdate,
  assessResources,
  buildAdaptation,
  buildQuestions,
  completeQuest,
  detectCategory,
  deriveCharacter,
  generateCampaign,
  getOnboardingQuestions,
  getQuestSuggestionLimit,
  getLevel,
  rebuildOpenQuests,
} from '../src/domain.js';

const now = new Date('2026-10-19T12:00:00');

function campaignInput(overrides = {}) {
  return {
    title: 'Создать привычку чтения',
    why: 'Хочу уделять время развитию',
    targetDate: '2026-11-30',
    answers: {
      successMetric: 'Читать по 20 минут пять раз в неделю',
      baseline: 'Пока читаю редко',
      schedule: 'Вечером после работы',
      obstacle: 'Устаю и отвлекаюсь на телефон',
    },
    assessment: {
      weeklyHours: 5,
      energy: 3,
      confidence: 2,
      resources: 'Книги уже есть',
      support: 'Поддерживает партнёр',
      barriers: 'Нестабильный график',
    },
    ...overrides,
  };
}

function stateWithQuest(status = 'open') {
  return {
    profile: {
      xp: 80, coins: 12, streak: 2, lastActiveDate: '2026-10-18', badges: [],
      setupComplete: true,
      answers: { projectDescription: 'Проект сохранён' },
      attributes: { time: 5, energy: 3, experience: 2, confidence: 3, support: 3, focus: 2, courage: 3, creativity: 4 },
      attributeEvidence: { time: '5 ч/неделю' },
      updatedAt: '2026-10-18T12:00:00.000Z',
    },
    campaigns: [{
      id: 'campaign-1',
      milestones: [{
        id: 'phase-1',
        quests: [{
          id: 'quest-1', status, xp: 35, minutes: 40,
          dueDate: '2026-10-16', note: '', completedAt: null,
        }],
      }],
    }],
  };
}

test('goal questions adapt to a financial goal and cover measurable progress', () => {
  const result = buildQuestions('Увеличить ежемесячный доход');

  assert.equal(result.category, 'money');
  assert.equal(result.questions.length, 4);
  assert.ok(result.questions.some((question) => /измер|результат/i.test(question.label)));
});

test('generic project wording does not force a career campaign category', () => {
  assert.equal(detectCategory('Back4Heart — проект приложения, опубликовать рабочую версию'), 'general');
  assert.equal(detectCategory('Найти работу в новой профессии'), 'career');
});

test('onboarding questions cover the Back4Heart project, desired result, resources, and obstacles', () => {
  const questions = getOnboardingQuestions({ metricCheck: 'clear' });
  const ids = questions.map((question) => question.id);

  assert.deepEqual(ids, [
    'projectDescription', 'desiredResult', 'successMetric', 'metricCheck', 'why', 'baseline',
    'experience', 'weeklyHours', 'schedule', 'energy', 'confidence', 'support',
    'resources', 'obstacle', 'focus', 'courage', 'creativity',
  ]);
  assert.equal(questions.find((question) => question.id === 'successMetric').required, true);
  assert.equal(questions.find((question) => question.id === 'metricCheck').required, true);
  assert.ok(questions.every((question) => question.label && question.type));
});

test('unclear success metric inserts a required follow-up', () => {
  const clearQuestions = getOnboardingQuestions({ metricCheck: 'clear' });
  const unclearQuestions = getOnboardingQuestions({ metricCheck: 'unclear' });
  const checkIndex = unclearQuestions.findIndex((question) => question.id === 'metricCheck');

  assert.equal(clearQuestions.some((question) => question.id === 'metricClarification'), false);
  assert.equal(unclearQuestions[checkIndex + 1].id, 'metricClarification');
  assert.equal(unclearQuestions[checkIndex + 1].required, true);
});

test('changing a saved clear metric to unclear reveals the follow-up question', () => {
  const savedAnswers = { metricCheck: 'clear', successMetric: 'Проверить опубликованную версию' };
  const editedQuestions = getOnboardingQuestions({ ...savedAnswers, metricCheck: 'unclear' });

  assert.ok(editedQuestions.some((question) => question.id === 'metricClarification' && question.required));
});

test('campaign uses the clarified success metric when the first answer was unclear', () => {
  const campaign = generateCampaign(campaignInput({
    title: 'Создать первую версию Back4Heart',
    answers: {
      successMetric: 'Хочу добиться успеха',
      metricCheck: 'unclear',
      metricClarification: 'Опубликовать прототип и получить три отзыва',
    },
  }), now);

  assert.equal(campaign.answers.successMetric, 'Опубликовать прототип и получить три отзыва');
  assert.match(campaign.milestones[0].quests[0].successCriteria, /Опубликовать прототип/);
});

test('character derivation bounds structured values and provides evidence for every attribute', () => {
  const character = deriveCharacter({
    weeklyHours: '90', energy: '0', experience: '4', confidence: '2',
    support: '5', focus: '2', courage: '9', creativity: 'not-a-number',
  });

  assert.deepEqual(character.attributes, {
    time: 40, energy: 1, experience: 4, confidence: 2,
    support: 5, focus: 2, courage: 5, creativity: 3,
  });
  assert.deepEqual(Object.keys(character.evidence).sort(), Object.keys(character.attributes).sort());
  assert.match(character.evidence.creativity, /временно|по умолчанию/i);
  assert.match(character.evidence.time, /40/);
});

test('character derivation does not infer personality traits from free-text answers', () => {
  const character = deriveCharacter({
    projectDescription: 'Я невероятно смелый и креативный, легко концентрируюсь',
    obstacle: 'Мне мешают страхи и отвлечения',
    successMetric: 'Смело и креативно сосредоточиться',
  });

  assert.deepEqual(character.attributes, {
    time: 3, energy: 3, experience: 3, confidence: 3,
    support: 3, focus: 3, courage: 3, creativity: 3,
  });
  assert.match(character.evidence.courage, /временно|по умолчанию/i);
});

test('focus maps to one, two, or three suggested quests', () => {
  assert.equal(getQuestSuggestionLimit({ focus: 1 }), 1);
  assert.equal(getQuestSuggestionLimit({ focus: 2 }), 1);
  assert.equal(getQuestSuggestionLimit({ focus: 3 }), 2);
  assert.equal(getQuestSuggestionLimit({ focus: 4 }), 3);
  assert.equal(getQuestSuggestionLimit({ focus: 5 }), 3);
  assert.equal(getQuestSuggestionLimit({}), 2);
});

test('Back4Heart campaign keeps project identity separate from the desired result', () => {
  const campaign = generateCampaign(campaignInput({
    projectName: 'Back4Heart',
    projectDescription: 'Цифровой проект, который я начинаю с нуля',
    title: 'Запустить первую рабочую версию',
  }), now);

  assert.equal(campaign.projectName, 'Back4Heart');
  assert.equal(campaign.title, 'Запустить первую рабочую версию');
  assert.match(campaign.projectDescription, /начинаю с нуля/);
});

test('Back4Heart quest copy avoids repeating the project name and punctuation', () => {
  const campaign = generateCampaign(campaignInput({
    projectName: 'Back4Heart',
    projectDescription: 'Back4Heart — приложение для восстановления после расставания.',
    title: 'Запустить первую рабочую версию.',
    answers: {
      ...campaignInput().answers,
      successMetric: 'Опубликована рабочая версия по ссылке.',
    },
  }), now);
  const firstQuest = campaign.milestones[0].quests[0];

  assert.match(firstQuest.description, /Контекст Back4Heart: приложение для восстановления/);
  assert.doesNotMatch(firstQuest.description, /Back4Heart: Back4Heart/);
  assert.doesNotMatch(firstQuest.description, /\.\./);
  assert.doesNotMatch(firstQuest.successCriteria, /\.\./);
  assert.doesNotMatch(campaign.milestones[0].quests[1].description, /\.»\./);
});

test('character resources and preferences calibrate generated quests', () => {
  const gentle = generateCampaign(campaignInput({
    projectName: 'Back4Heart',
    projectDescription: 'Цифровой проект',
    title: 'Запустить первую версию приложения',
    answers: {
      successMetric: 'Опубликовать прототип и получить три отзыва',
      baseline: 'Есть только идея',
      schedule: 'Два коротких вечера',
      obstacle: 'Боюсь показать несовершенную работу',
    },
    attributes: { time: 2, energy: 1, experience: 1, confidence: 1, support: 1, focus: 2, courage: 1, creativity: 2 },
  }), now);
  const gentleQuests = gentle.milestones.flatMap((phase) => phase.quests);

  assert.deepEqual(gentle.milestones[0].quests.map((quest) => quest.minutes), [20, 25, 25]);
  assert.ok(gentleQuests.every((quest) => quest.minutes >= 10 && quest.minutes <= 90));
  assert.match(gentleQuests[0].description, /подсказк/i);
  assert.match(gentleQuests[0].description, /безопасн|маленьк/i);
  assert.match(gentleQuests[0].description, /10 минут/);
  assert.match(gentleQuests[2].description, /обходн|если .*мешает/i);

  const bold = generateCampaign(campaignInput({
    projectName: 'Back4Heart',
    projectDescription: 'Цифровой проект',
    title: 'Запустить первую версию приложения',
    answers: { successMetric: 'Первая версия опубликована', obstacle: 'Нет обратной связи' },
    attributes: { time: 10, energy: 4, experience: 5, confidence: 4, support: 5, focus: 5, courage: 5, creativity: 5 },
  }), now);
  const boldQuests = bold.milestones.flatMap((phase) => phase.quests);

  assert.equal(bold.attributes.time, 10);
  assert.deepEqual(bold.milestones[0].quests.map((quest) => quest.minutes), [30, 40, 35]);
  assert.match(boldQuests[0].description, /самостоятельн/i);
  assert.match(boldQuests[0].description, /эксперимент|свой вариант/i);
  assert.match(boldQuests[0].description, /реальным пользователем|прототипом/i);
  assert.match(boldQuests[2].description, /обратн.*связ|отзыв/i);
});

test('character calibration preserves campaign dates and measurable criteria', () => {
  const original = generateCampaign(campaignInput(), now);
  const calibrated = generateCampaign(campaignInput({
    attributes: { time: 1, energy: 1, experience: 2, confidence: 2, support: 2, focus: 1, courage: 1, creativity: 1 },
  }), now);
  const originalQuests = original.milestones.flatMap((phase) => phase.quests);
  const calibratedQuests = calibrated.milestones.flatMap((phase) => phase.quests);

  assert.deepEqual(calibrated.milestones.map((phase) => phase.dueDate), original.milestones.map((phase) => phase.dueDate));
  assert.deepEqual(calibratedQuests.map((quest) => quest.dueDate), originalQuests.map((quest) => quest.dueDate));
  assert.ok(calibratedQuests.every((quest) => quest.successCriteria.trim().length > 0));
  assert.deepEqual(calibratedQuests.map((quest) => quest.xp), originalQuests.map((quest) => quest.xp));
});

test('profile regeneration replaces only open quests', () => {
  const previous = generateCampaign(campaignInput({ title: 'Собрать первый прототип' }), now);
  previous.milestones[0].quests[0].status = 'done';
  previous.milestones[0].quests[1].status = 'postponed';
  previous.milestones[0].quests[2].status = 'blocked';
  const previousFrozen = structuredClone(previous);
  const regenerated = generateCampaign(campaignInput({
    projectName: 'Back4Heart',
    title: 'Опубликовать прототип',
    answers: { successMetric: 'Опубликована тестовая версия и получены три отзыва' },
    attributes: { time: 2, energy: 2, experience: 1, confidence: 1, support: 1, focus: 2, courage: 1, creativity: 1 },
  }), now);
  const result = rebuildOpenQuests(previous, regenerated);
  const priorQuests = previousFrozen.milestones.flatMap((phase) => phase.quests);
  const resultQuests = result.milestones.flatMap((phase) => phase.quests);

  assert.deepEqual(resultQuests.slice(0, 3).slice(0, 3).filter((quest) => quest.status !== 'open'), priorQuests.slice(0, 3).filter((quest) => quest.status !== 'open'));
  assert.equal(resultQuests[0].title, priorQuests[0].title);
  assert.notEqual(resultQuests[3].description, priorQuests[3].description);
  assert.equal(resultQuests[3].id, priorQuests[3].id);
  assert.equal(resultQuests[3].dueDate, priorQuests[3].dueDate);
  assert.equal(resultQuests[3].xp, priorQuests[3].xp);
  assert.ok(resultQuests[3].successCriteria.trim());
});

test('character editing adds a Back4Heart campaign instead of overwriting another active goal', () => {
  const activeOther = generateCampaign(campaignInput({
    projectName: 'Общее развитие',
    title: 'Освоить новую профессию',
  }), now);
  const savedBack4Heart = generateCampaign(campaignInput({
    projectName: 'Back4Heart',
    title: 'Провести пять интервью',
  }), now);
  const regeneratedBack4Heart = generateCampaign(campaignInput({
    projectName: 'Back4Heart',
    title: 'Опубликовать первую версию приложения',
  }), now);

  const result = applyCharacterCampaignUpdate(
    [activeOther, savedBack4Heart],
    activeOther.id,
    regeneratedBack4Heart,
  );

  assert.equal(result.activeCampaignId, regeneratedBack4Heart.id);
  assert.deepEqual(result.campaigns, [regeneratedBack4Heart, activeOther, savedBack4Heart]);
});

test('resource score maps no starting resources to 0 and strong resources to 100', () => {
  assert.equal(assessResources({ weeklyHours: 0, energy: 1, confidence: 1 }), 0);
  assert.equal(assessResources({ weeklyHours: 10, energy: 5, confidence: 5 }), 100);
});

test('campaign generation creates four milestones with three measurable quests each', () => {
  const campaign = generateCampaign(campaignInput(), now);

  assert.equal(campaign.milestones.length, 4);
  assert.deepEqual(campaign.milestones.map((phase) => phase.quests.length), [3, 3, 3, 3]);
  assert.ok(campaign.milestones.flatMap((phase) => phase.quests)
    .every((quest) => quest.successCriteria.trim().length > 0));
  assert.ok(campaign.resourceScore >= 0 && campaign.resourceScore <= 100);
});

test('campaign generation rejects a goal that is too short', () => {
  assert.throws(() => generateCampaign(campaignInput({ title: 'Нет' }), now), /4 символ/i);
  assert.throws(() => generateCampaign(campaignInput({ title: '😀😀' }), now), /4 символ/i);
});

test('same-day deadline produces valid milestone dates no later than the target', () => {
  const earlyMorning = new Date('2026-10-19T00:00:00');
  const campaign = generateCampaign(campaignInput({ targetDate: '2026-10-19' }), earlyMorning);
  const target = new Date('2026-10-19T00:00:00');

  for (const phase of campaign.milestones) {
    const dueDate = new Date(`${phase.dueDate}T00:00:00`);
    assert.equal(Number.isNaN(dueDate.valueOf()), false);
    assert.ok(dueDate <= target);
  }
});

test('impossible calendar date falls back to the standard horizon', () => {
  const campaign = generateCampaign(campaignInput({ targetDate: '2026-02-31' }), now);

  assert.equal(campaign.targetDate, '2027-01-11');
});

test('past deadline moves the campaign target to today and keeps milestone dates in order', () => {
  const campaign = generateCampaign(campaignInput({ targetDate: '2026-10-01' }), now);
  const phaseDates = campaign.milestones.map((phase) => phase.dueDate);

  assert.equal(campaign.deadlineAdjusted, true);
  assert.equal(campaign.targetDate, '2026-10-19');
  assert.deepEqual(phaseDates, ['2026-10-19', '2026-10-19', '2026-10-19', '2026-10-19']);
});

test('completing a quest grants XP and coins once and advances the level', () => {
  const first = completeQuest(stateWithQuest(), 'campaign-1', 'quest-1', 'Сделал первый шаг', now);
  const second = completeQuest(first, 'campaign-1', 'quest-1', 'Ещё раз', now);

  assert.equal(first.profile.xp, 115);
  assert.equal(first.profile.coins, 16);
  assert.equal(first.profile.streak, 3);
  assert.equal(first.profile.setupComplete, true);
  assert.deepEqual(first.profile.answers, { projectDescription: 'Проект сохранён' });
  assert.equal(first.profile.attributes.focus, 2);
  assert.equal(first.profile.attributeEvidence.time, '5 ч/неделю');
  assert.equal(first.profile.updatedAt, '2026-10-18T12:00:00.000Z');
  assert.deepEqual(getLevel(first.profile.xp), { level: 2, progress: 15, nextLevelXp: 100 });
  assert.equal(second.profile.xp, 115);
  assert.equal(second.profile.coins, 16);
  assert.equal(second.campaigns[0].milestones[0].quests[0].note, 'Сделал первый шаг');
});

test('weekly review softens the plan when completion or energy is low', () => {
  assert.equal(buildAdaptation({ completionRate: 0.4, energy: 3 }, {}).type, 'soften');
  assert.equal(buildAdaptation({ completionRate: 0.9, energy: 2 }, {}).type, 'soften');
});

test('weekly review stretches a strong week and keeps an ordinary week steady', () => {
  assert.equal(buildAdaptation({ completionRate: 0.8, energy: 4 }, {}).type, 'stretch');
  assert.equal(buildAdaptation({ completionRate: 0.6, energy: 3 }, {}).type, 'steady');
});

test('weekly adaptation respects the character resource profile', () => {
  const lowCapacity = { attributes: { time: 2, energy: 2 } };
  const strongCapacity = { attributes: { time: 10, energy: 4 } };

  assert.equal(buildAdaptation({ completionRate: 0.9, energy: 4 }, lowCapacity).type, 'steady');
  assert.equal(buildAdaptation({ completionRate: 0.9, energy: 4 }, strongCapacity).type, 'stretch');

  const makeCampaign = (attributes) => ({
    attributes,
    milestones: [{ quests: [{ status: 'open', minutes: 40, dueDate: '2026-10-16' }] }],
  });
  const soften = { type: 'soften' };
  assert.equal(applyAdaptation(makeCampaign(lowCapacity.attributes), soften, now).milestones[0].quests[0].minutes, 25);
  assert.equal(applyAdaptation(makeCampaign({ time: 6, energy: 3 }), soften, now).milestones[0].quests[0].minutes, 30);
  assert.equal(applyAdaptation(makeCampaign(strongCapacity.attributes), soften, now).milestones[0].quests[0].minutes, 35);
});

test('soften shortens only open quests and moves overdue dates three days forward', () => {
  const campaign = {
    milestones: [{ quests: [
      { status: 'open', minutes: 40, dueDate: '2026-10-16' },
      { status: 'done', minutes: 40, dueDate: '2026-10-16' },
      { status: 'postponed', minutes: 20, dueDate: '2026-10-16' },
    ] }],
  };
  const adjusted = applyAdaptation(campaign, { type: 'soften' }, now);

  assert.equal(adjusted.milestones[0].quests[0].minutes, 30);
  assert.equal(adjusted.milestones[0].quests[0].dueDate, '2026-10-22');
  assert.equal(adjusted.milestones[0].quests[1].minutes, 40);
  assert.equal(adjusted.milestones[0].quests[2].minutes, 20);
  assert.equal(adjusted.milestones[0].quests[2].dueDate, '2026-10-16');
});

test('stretch changes the nearest due group and never moves it before today', () => {
  const campaign = { milestones: [{ quests: [
    { status: 'open', dueDate: '2026-10-20', minutes: 20 },
    { status: 'open', dueDate: '2026-10-20', minutes: 25 },
    { status: 'open', dueDate: '2026-11-20', minutes: 40 },
  ] }] };
  const adjusted = applyAdaptation(campaign, { type: 'stretch' }, now);

  assert.equal(adjusted.milestones[0].quests[0].dueDate, '2026-10-19');
  assert.equal(adjusted.milestones[0].quests[1].dueDate, '2026-10-19');
  assert.equal(adjusted.milestones[0].quests[2].dueDate, '2026-11-20');
});

