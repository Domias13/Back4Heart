const DAY_MS = 24 * 60 * 60 * 1000;

const CATEGORY_QUESTS = {
  money: [
    ['Понять денежную точку старта', 'Собери факты о доходе, расходах и желаемом результате.'],
    ['Проверить возможности роста', 'Найди один реалистичный способ увеличить доход или накопления.'],
    ['Запустить денежный эксперимент', 'Сделай небольшой шаг и зафиксируй его результат.'],
    ['Закрепить новый денежный ритм', 'Повтори работающий шаг и подведи итоги периода.'],
  ],
  health: [
    ['Понять свою точку старта', 'Запиши текущее самочувствие и подходящий темп.'],
    ['Подготовить удобную среду', 'Убери одно препятствие и подготовь всё для простого старта.'],
    ['Практиковать маленькими шагами', 'Повтори посильное действие и отметь, как оно ощущалось.'],
    ['Закрепить устойчивый ритм', 'Подведи итоги и выбери практику, которую хочется сохранить.'],
  ],
  career: [
    ['Уточнить направление', 'Определи, какой навык или результат приблизит тебя к цели.'],
    ['Подготовить основу', 'Собери материалы и выдели время для следующего шага.'],
    ['Показать работу миру', 'Проведи небольшой практический эксперимент и собери обратную связь.'],
    ['Закрепить следующий уровень', 'Подведи итоги и выбери следующий профессиональный шаг.'],
  ],
  general: [
    ['Разобраться', 'Уточни результат и собери факты о текущей точке.'],
    ['Подготовить основу', 'Подготовь ресурсы и выбери простой ритм действий.'],
    ['Двигаться маленькими шагами', 'Проведи короткий эксперимент и посмотри, что сработало.'],
    ['Закрепить результат', 'Подведи итоги и выбери, что стоит продолжить.'],
  ],
};

const CATEGORY_KEYWORDS = {
  money: /деньг|доход|зарплат|финанс|накоп|бюджет|долг|зарабат|€|\$/i,
  health: /здоров|спорт|тренир|форма|похуд|бег|сон|питани|энерг/i,
  career: /карьер|работ|професс|навык|обуч|учить|курс|бизнес|клиент/i,
};

const ONBOARDING_QUESTIONS = [
  { id: 'projectDescription', label: 'Что такое Back4Heart и что ты хочешь в нём создать?', type: 'textarea', required: true, placeholder: 'Расскажи своими словами, даже если идея пока сырая' },
  { id: 'desiredResult', label: 'Какой конкретный результат ты хочешь получить?', type: 'textarea', required: true, placeholder: 'Представь, что цель достигнута: что уже существует или изменилось?' },
  { id: 'successMetric', label: 'Как поймёшь, что этот результат достигнут?', type: 'textarea', required: true, placeholder: 'Назови наблюдаемый признак, число или готовый результат' },
  { id: 'metricCheck', label: 'По этому критерию получится однозначно проверить результат?', type: 'choice', required: true, options: [
    { value: 'clear', label: 'Да — есть конкретный факт, число или готовый результат' },
    { value: 'unclear', label: 'Пока нет — помоги уточнить' },
  ] },
  { id: 'why', label: 'Почему для тебя важно сделать Back4Heart?', type: 'textarea', required: false, placeholder: 'Что изменится для тебя или других людей?' },
  { id: 'baseline', label: 'С чего ты начинаешь?', type: 'textarea', required: false, placeholder: 'Что уже готово, чему научился, что пока только идея?' },
  { id: 'experience', label: 'Как оцениваешь свой опыт в этой области?', type: 'scale', required: false, min: 1, max: 5, lowLabel: 'Совсем начинаю', highLabel: 'Большой опыт' },
  { id: 'weeklyHours', label: 'Сколько часов в неделю реально выделить?', type: 'number', required: false, min: 0, max: 40, step: 0.5, placeholder: 'Например, 4' },
  { id: 'schedule', label: 'Когда и как часто будет удобно заниматься?', type: 'textarea', required: false, placeholder: 'Например, по часу в три вечера' },
  { id: 'energy', label: 'Сколько у тебя сейчас сил на этот проект?', type: 'scale', required: false, min: 1, max: 5, lowLabel: 'Почти нет ресурса', highLabel: 'Много сил' },
  { id: 'confidence', label: 'Насколько уверен, что сможешь двигаться к результату?', type: 'scale', required: false, min: 1, max: 5, lowLabel: 'Пока не уверен', highLabel: 'Уверен' },
  { id: 'support', label: 'Насколько есть люди или ресурсы, на которые можно опереться?', type: 'scale', required: false, min: 1, max: 5, lowLabel: 'Пока не на что опереться', highLabel: 'Есть сильная поддержка' },
  { id: 'resources', label: 'Что у тебя уже есть для работы над проектом?', type: 'textarea', required: false, placeholder: 'Навыки, инструменты, бюджет, контакты или время' },
  { id: 'obstacle', label: 'Что вероятнее всего может помешать?', type: 'textarea', required: false, placeholder: 'Назови главное препятствие — игра учтёт его в плане' },
  { id: 'focus', label: 'Сколько параллельных задач тебе удобно держать в фокусе?', type: 'scale', required: false, min: 1, max: 5, lowLabel: 'Одна за раз', highLabel: 'Несколько сразу' },
  { id: 'courage', label: 'Насколько комфортно пробовать непривычные шаги?', type: 'scale', required: false, min: 1, max: 5, lowLabel: 'Предпочитаю безопасные шаги', highLabel: 'Готов экспериментировать' },
  { id: 'creativity', label: 'Какой формат тебе ближе: готовый путь или поиск своих решений?', type: 'scale', required: false, min: 1, max: 5, lowLabel: 'Чёткая инструкция', highLabel: 'Свободный поиск идей' },
];

export function detectCategory(goal = '') {
  for (const [category, pattern] of Object.entries(CATEGORY_KEYWORDS)) {
    if (pattern.test(goal)) return category;
  }
  return 'general';
}

export function countCharacters(value) {
  const text = String(value ?? '');
  if (typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter('ru', { granularity: 'grapheme' }).segment(text)).length;
  }
  return Array.from(text).length;
}

export function buildQuestions(goal = '') {
  const category = detectCategory(goal);
  const focus = category === 'money'
    ? 'денежный результат'
    : category === 'health'
      ? 'изменение в самочувствии или привычке'
      : category === 'career'
        ? 'профессиональный результат'
        : 'результат, который можно заметить';

  return {
    category,
    questions: [
      { id: 'successMetric', label: `Как измеришь ${focus}?`, placeholder: 'Например: конкретное число, навык или повторяемое действие' },
      { id: 'baseline', label: 'С какой точки ты начинаешь?', placeholder: 'Что уже есть сейчас? Можно ответить «пока ничего»' },
      { id: 'schedule', label: 'Когда реально найдётся время?', placeholder: 'Например: три вечера по 30 минут' },
      { id: 'obstacle', label: 'Что вероятнее всего помешает?', placeholder: 'Назови одно главное препятствие' },
    ],
  };
}

export function getOnboardingQuestions(answers = {}) {
  const questions = ONBOARDING_QUESTIONS.map((question) => ({ ...question }));
  if (answers.metricCheck === 'unclear') {
    const checkIndex = questions.findIndex((question) => question.id === 'metricCheck');
    questions.splice(checkIndex + 1, 0, {
      id: 'metricClarification',
      label: 'Что можно будет увидеть, посчитать или показать, чтобы проверить успех?',
      type: 'textarea',
      required: true,
      placeholder: 'Например: работающая версия открывается по ссылке, пять человек прошли сценарий или опубликованы три материала',
    });
  }
  return questions;
}

export function deriveCharacter(answers = {}) {
  const timeValue = Number(answers.weeklyHours);
  const hasTime = answers.weeklyHours !== '' && answers.weeklyHours !== null
    && answers.weeklyHours !== undefined && Number.isFinite(timeValue);
  const time = hasTime ? clamp(timeValue, 0, 40) : 3;
  const attributes = { time };
  const evidence = {
    time: hasTime
      ? `По твоему ответу: ${time} ч/неделю${time !== timeValue ? ` (значение ограничено диапазоном 0–40; введено ${timeValue})` : ''}.`
      : 'Временно указано 3 ч/неделю — можно изменить в карточке персонажа.',
  };

  for (const key of ['energy', 'experience', 'confidence', 'support', 'focus', 'courage', 'creativity']) {
    const raw = Number(answers[key]);
    const hasValue = answers[key] !== '' && answers[key] !== null
      && answers[key] !== undefined && Number.isFinite(raw);
    const value = hasValue ? clamp(Math.round(raw), 1, 5) : 3;
    attributes[key] = value;
    evidence[key] = hasValue
      ? `Твоя оценка: ${value}/5${value !== raw ? ` (ограничена диапазоном 1–5; введено ${raw})` : ''}.`
      : 'Временно выставлено 3/5 — можно изменить в карточке персонажа.';
  }

  return { attributes, evidence };
}

export function getQuestSuggestionLimit(attributes = {}) {
  const rawFocus = Number(attributes.focus);
  const focus = Number.isFinite(rawFocus) ? clamp(Math.round(rawFocus), 1, 5) : 3;
  return focus <= 2 ? 1 : focus === 3 ? 2 : 3;
}

export function assessResources(assessment = {}) {
  const hours = clamp(Number(assessment.weeklyHours) || 0, 0, 10) / 10;
  const energy = (clamp(Number(assessment.energy) || 1, 1, 5) - 1) / 4;
  const confidence = (clamp(Number(assessment.confidence) || 1, 1, 5) - 1) / 4;
  return Math.round(((hours + energy + confidence) / 3) * 100);
}

export function generateCampaign(input, now = new Date()) {
  const title = String(input?.title ?? '').trim();
  if (countCharacters(title) < 4) throw new Error('Цель должна содержать минимум 4 символа.');

  const projectName = String(input.projectName ?? '').trim();
  const projectDescription = String(input.projectDescription ?? '').trim();
  const character = input.attributes ? deriveCharacter({
    ...input.attributes,
    weeklyHours: input.attributes.time ?? input.attributes.weeklyHours,
  }) : null;
  const assessmentInput = {
    ...input.assessment,
    ...(character ? {
      weeklyHours: character.attributes.time,
      energy: character.attributes.energy,
      confidence: character.attributes.confidence,
    } : {}),
  };
  const startDate = toDateKey(now);
  const fallbackTarget = addDays(now, 84);
  const parsedTarget = input.targetDate ? parseDateKey(input.targetDate) : null;
  const deadlineAdjusted = Boolean(parsedTarget && toDateKey(parsedTarget) < startDate);
  const target = deadlineAdjusted ? parseDateKey(startDate) : parsedTarget ?? fallbackTarget;
  const targetDate = toDateKey(target);
  const category = detectCategory(`${projectDescription} ${title}`);
  const answerSet = { ...(input.answers ?? {}) };
  if (answerSet.metricCheck === 'unclear' && String(answerSet.metricClarification ?? '').trim()) {
    answerSet.successMetric = String(answerSet.metricClarification).trim();
  }
  const assessment = normalizeAssessment(assessmentInput);
  const resourceScore = assessResources(assessment);
  const attributes = character?.attributes ?? null;
  const templates = CATEGORY_QUESTS[category] ?? CATEGORY_QUESTS.general;
  const phaseNames = category === 'general'
    ? ['Разобраться', 'Подготовить основу', 'Двигаться маленькими шагами', 'Закрепить результат']
    : templates.map(([title]) => title);
  const phaseOutcomes = [
    'Ясно виден результат и исходная точка.',
    'Подготовлены время, ресурсы и первый план.',
    'Появились реальные шаги и обратная связь.',
    'Результат подведён и следующий ритм выбран.',
  ];
  const questBlueprints = [
    { title: 'Уточнить маршрут', kind: 'research', minutes: 25, xp: 20 },
    { title: 'Сделать первый шаг', kind: 'action', minutes: 35, xp: 35 },
    { title: 'Проверить результат этапа', kind: 'checkpoint', minutes: 30, xp: 50 },
  ];
  const milestones = phaseNames.map((phaseName, phaseIndex) => {
    const phaseDate = interpolateDate(now, target, phaseIndex + 1, phaseNames.length);
    const [contextTitle, contextDescription] = templates[phaseIndex];
    const quests = questBlueprints.map((blueprint, questIndex) => {
      const questCopy = questCopyFor(phaseIndex, questIndex, {
        goal: title,
        projectName,
        projectDescription,
        metric: answerSet.successMetric,
        baseline: answerSet.baseline,
        schedule: answerSet.schedule,
        obstacle: answerSet.obstacle,
        contextTitle,
        contextDescription,
        attributes,
      });
      const calibrated = calibrateQuest(blueprint, questCopy, { assessment, attributes, obstacle: answerSet.obstacle });
      return {
        id: createId('quest'),
        title: calibrated.title,
        description: calibrated.description,
        successCriteria: questCopy.successCriteria,
        kind: blueprint.kind,
        minutes: calibrated.minutes,
        dueDate: phaseDate,
        xp: blueprint.xp,
        status: 'open',
        note: '',
        completedAt: null,
      };
    });
    return {
      id: createId('phase'),
      title: phaseName,
      outcome: phaseOutcomes[phaseIndex],
      dueDate: phaseDate,
      status: 'open',
      order: phaseIndex + 1,
      quests,
    };
  });

  return {
    id: createId('campaign'),
    projectName,
    projectDescription,
    title,
    why: String(input.why ?? '').trim(),
    category,
    startDate,
    targetDate,
    deadlineAdjusted,
    createdAt: now.toISOString(),
    answers: { ...answerSet },
    attributes,
    assessment,
    resourceScore,
    milestones,
    status: 'active',
  };
}

export function rebuildOpenQuests(previousCampaign, regeneratedCampaign) {
  if (!previousCampaign || !regeneratedCampaign) return regeneratedCampaign ?? previousCampaign;
  const milestones = regeneratedCampaign.milestones.map((newPhase, phaseIndex) => {
    const oldPhase = previousCampaign.milestones?.[phaseIndex];
    const quests = newPhase.quests.map((newQuest, questIndex) => {
      const oldQuest = oldPhase?.quests?.[questIndex];
      if (!oldQuest) return newQuest;
      if (oldQuest.status !== 'open') return oldQuest;
      return {
        ...newQuest,
        id: oldQuest.id,
        dueDate: oldQuest.dueDate,
        xp: oldQuest.xp,
      };
    });
    return {
      ...newPhase,
      id: oldPhase?.id ?? newPhase.id,
      quests,
      status: quests.every((quest) => quest.status === 'done') ? 'done' : 'open',
    };
  });
  return {
    ...previousCampaign,
    ...regeneratedCampaign,
    id: previousCampaign.id,
    createdAt: previousCampaign.createdAt,
    milestones,
  };
}

export function applyCharacterCampaignUpdate(campaigns = [], activeCampaignId, regeneratedCampaign) {
  const activeCampaign = campaigns.find((campaign) => campaign.id === activeCampaignId);
  if (activeCampaign?.projectName === 'Back4Heart' && regeneratedCampaign?.projectName === 'Back4Heart') {
    const updatedCampaign = rebuildOpenQuests(activeCampaign, regeneratedCampaign);
    return {
      campaigns: campaigns.map((campaign) => campaign.id === activeCampaign.id ? updatedCampaign : campaign),
      activeCampaignId: updatedCampaign.id,
    };
  }
  return {
    campaigns: [regeneratedCampaign, ...campaigns],
    activeCampaignId: regeneratedCampaign.id,
  };
}

export function completeQuest(state, campaignId, questId, note = '', now = new Date()) {
  const campaign = state.campaigns?.find((item) => item.id === campaignId);
  const existingQuest = campaign?.milestones.flatMap((phase) => phase.quests).find((item) => item.id === questId);
  if (!existingQuest || existingQuest.status === 'done') return state;

  const today = toDateKey(now);
  const yesterday = toDateKey(addDays(now, -1));
  const streak = state.profile?.lastActiveDate === today
    ? (state.profile.streak ?? 1)
    : state.profile?.lastActiveDate === yesterday
      ? (state.profile.streak ?? 0) + 1
      : 1;
  const rewardXp = Math.max(0, Number(existingQuest.xp) || 0);
  const rewardCoins = Math.ceil(rewardXp / 10);
  let completedCount = 0;

  const campaigns = state.campaigns.map((item) => {
    if (item.id !== campaignId) return item;
    const milestones = item.milestones.map((phase) => {
      const quests = phase.quests.map((quest) => {
        if (quest.id !== questId) {
          if (quest.status === 'done') completedCount += 1;
          return quest;
        }
        completedCount += 1;
        return { ...quest, status: 'done', note: String(note).trim(), completedAt: now.toISOString() };
      });
      return { ...phase, quests, status: quests.every((quest) => quest.status === 'done') ? 'done' : 'open' };
    });
    return { ...item, milestones, status: milestones.every((phase) => phase.status === 'done') ? 'completed' : item.status };
  });

  const currentBadges = state.profile?.badges ?? [];
  const badges = [...new Set([
    ...currentBadges,
    ...(completedCount === 1 ? ['Первый шаг'] : []),
    ...(campaigns.find((item) => item.id === campaignId)?.status === 'completed' ? ['Герой кампании'] : []),
  ])];
  return {
    ...state,
    profile: {
      ...state.profile,
      xp: (state.profile?.xp ?? 0) + rewardXp,
      coins: (state.profile?.coins ?? 0) + rewardCoins,
      streak,
      lastActiveDate: today,
      badges,
    },
    campaigns,
  };
}

export function buildAdaptation(review, campaign) {
  const completionRate = clamp(Number(review?.completionRate) || 0, 0, 1);
  const energy = clamp(Number(review?.energy) || 1, 1, 5);
  const capacity = campaign?.attributes ?? {
    time: campaign?.assessment?.weeklyHours,
    energy: campaign?.assessment?.energy,
  };
  const hasCapacity = Number.isFinite(capacity.time) && Number.isFinite(capacity.energy);
  const canStretch = !hasCapacity || (capacity.time >= 8 && capacity.energy >= 4);
  const openCount = campaign?.milestones?.flatMap((phase) => phase.quests)
    .filter((quest) => quest.status === 'open').length ?? 0;

  if (completionRate < 0.45 || energy <= 2) {
    return {
      type: 'soften',
      title: 'Сделать темп бережнее',
      message: 'Уменьшим длительность открытых квестов и дадим просроченным шагам немного воздуха.',
      openCount,
    };
  }
  if (completionRate >= 0.8 && energy >= 4 && canStretch) {
    return {
      type: 'stretch',
      title: 'Использовать хороший темп',
      message: 'Чуть приблизим сроки следующих шагов, сохранив паузы и реалистичный ритм.',
      openCount,
    };
  }
  return {
    type: 'steady',
    title: 'Сохранить текущий ритм',
    message: 'План выглядит выполнимым. Оставим сроки и длительность без изменений.',
    openCount,
  };
}

export function applyAdaptation(campaign, adaptation, now = new Date()) {
  const today = toDateKey(now);
  const capacity = campaign.attributes ?? {
    time: campaign.assessment?.weeklyHours,
    energy: campaign.assessment?.energy,
  };
  const softenMultiplier = capacity.time < 3 || capacity.energy <= 2 ? 0.65
    : capacity.time >= 8 && capacity.energy >= 4 ? 0.85
      : 0.75;
  const nearestDueDate = adaptation.type === 'stretch'
    ? campaign.milestones.flatMap((phase) => phase.quests)
      .filter((quest) => quest.status === 'open' && quest.dueDate)
      .map((quest) => quest.dueDate)
      .sort()[0]
    : null;
  return {
    ...campaign,
    milestones: campaign.milestones.map((phase) => ({
      ...phase,
      quests: phase.quests.map((quest) => {
        if (quest.status !== 'open') return quest;
        if (adaptation.type === 'soften') {
          const dueDate = quest.dueDate && quest.dueDate < today ? toDateKey(addDays(now, 3)) : quest.dueDate;
          return { ...quest, minutes: Math.max(10, Math.round((quest.minutes ?? 15) * softenMultiplier / 5) * 5), dueDate };
        }
        if (adaptation.type === 'stretch' && quest.dueDate && quest.dueDate === nearestDueDate) {
          const proposedDate = toDateKey(addDays(parseDateKey(quest.dueDate), -2));
          return { ...quest, dueDate: proposedDate < today ? today : proposedDate };
        }
        return quest;
      }),
    })),
  };
}

export function getLevel(xp = 0) {
  const safeXp = Math.max(0, Number(xp) || 0);
  return { level: Math.floor(safeXp / 100) + 1, progress: safeXp % 100, nextLevelXp: 100 };
}

function questCopyFor(phaseIndex, questIndex, context) {
  const fragment = (value, fallback) => String(value ?? fallback).trim().replace(/[.!?]+$/, '');
  const goal = fragment(context.goal, 'цель');
  const metric = fragment(context.metric, `понятный шаг к цели «${goal}»`);
  const baseline = fragment(context.baseline, 'текущее состояние записано одной короткой заметкой');
  const obstacle = fragment(context.obstacle, 'главное препятствие названо');
  const schedule = fragment(context.schedule, 'одно подходящее время выбрано');
  const copies = [
    [
      { title: context.contextTitle, description: context.contextDescription, successCriteria: `В заметке записан результат: ${metric}.` },
      { title: 'Зафиксировать исходную точку', description: `Опиши, что уже есть для цели «${goal}».`, successCriteria: `Записан старт: ${baseline}.` },
      { title: 'Освободить место для шага', description: `Подумай, как обойти препятствие: ${obstacle}.`, successCriteria: `Выбран один способ уменьшить препятствие: ${obstacle}.` },
    ],
    [
      { title: 'Подготовить ресурсы', description: `Проверь, что понадобится для цели «${goal}».`, successCriteria: 'Составлен короткий список из 1–3 нужных ресурсов.' },
      { title: 'Встроить цель в неделю', description: `Найди подходящий момент: ${schedule}.`, successCriteria: `В календаре или заметке отмечено время: ${schedule}.` },
      { title: 'Собрать личный план', description: `Выбери реалистичный способ двигаться к цели «${goal}».`, successCriteria: 'Записаны три ближайших действия в порядке выполнения.' },
    ],
    [
      { title: 'Начать с короткого действия', description: `Сделай небольшой шаг по цели «${goal}».`, successCriteria: 'Один шаг выполнен, а его результат записан.' },
      { title: 'Повторить то, что сработало', description: 'Повтори удобный шаг и заметь, что помогло начать.', successCriteria: 'Действие повторено ещё один раз; отмечена его длительность.' },
      { title: 'Сверить курс', description: `Сравни прогресс с критерием: ${metric}.`, successCriteria: 'Записан один факт о прогрессе и один вывод на будущее.' },
    ],
    [
      { title: 'Выбрать устойчивый ритм', description: `Оставь только те действия, которые поддерживают цель «${goal}».`, successCriteria: 'Выбран повторяемый ритм на ближайшие две недели.' },
      { title: 'Закрыть незавершённое', description: 'Реши, какой открытый шаг завершить, упростить или перенести.', successCriteria: 'Для каждого открытого шага выбрано действие: сделать, упростить или перенести.' },
      { title: 'Подвести итог кампании', description: 'Сравни стартовую точку с тем, что получилось сейчас.', successCriteria: 'Записан итог относительно критерия: ' + metric },
    ],
  ];
  const copy = { ...copies[phaseIndex][questIndex] };
  const attributes = context.attributes;
  if (attributes?.experience <= 2) {
    copy.description += ' Раздели работу на короткие шаги и пользуйся подсказками.';
  } else if (attributes?.experience >= 4) {
    copy.description += ' Самостоятельно выбери решение и зафиксируй, почему оно подходит.';
  }
  if (attributes && (attributes.confidence <= 2 || attributes.courage <= 2)) {
    copy.description += ' Начни с безопасной малой версии: 10 минут на черновик или подготовку, затем реши, готов ли продолжать.';
  } else if (attributes?.courage >= 4 && (questIndex === 0 || questIndex === 2)) {
    copy.description += ' Проведи небольшой эксперимент с реальным пользователем или прототипом и запиши, что узнал.';
  }
  if (attributes?.creativity >= 4 && questIndex === 0) {
    copy.description += ' Проверь один свой вариант или небольшой эксперимент.';
  }
  if (attributes?.support >= 4 && questIndex === 2) {
    copy.description += ' Если есть подходящий человек, попроси его об одном конкретном отзыве.';
  }
  if (context.projectDescription) {
    const projectName = String(context.projectName || 'Back4Heart').trim();
    const description = String(context.projectDescription).trim();
    const details = description.toLocaleLowerCase().startsWith(projectName.toLocaleLowerCase())
      ? description.slice(projectName.length).replace(/^\s*[—–:-]\s*/, '').trim()
      : description;
    copy.description += ` Контекст ${projectName}: ${fragment(details, description)}.`;
  }
  return copy;
}

function calibrateQuest(blueprint, copy, context) {
  const attributes = context.attributes;
  const weeklyHours = attributes?.time ?? context.assessment.weeklyHours;
  const energy = attributes?.energy ?? context.assessment.energy;
  const factor = weeklyHours < 3 || energy <= 2 ? 0.75
    : weeklyHours >= 8 && energy >= 4 ? 1.1
      : 1;
  const minutes = clamp(Math.round((blueprint.minutes * factor) / 5) * 5, 10, 90);
  const description = context.obstacle
    ? `${copy.description} Если помешает «${context.obstacle}», выполни минимальный вариант: сделай 10 минут самого простого подготовительного шага и запиши, что поможет продолжить.`
    : copy.description;
  return { title: copy.title, description, minutes };
}

function normalizeAssessment(assessment) {
  return {
    weeklyHours: clamp(Number(assessment.weeklyHours) || 0, 0, 100),
    energy: clamp(Number(assessment.energy) || 1, 1, 5),
    confidence: clamp(Number(assessment.confidence) || 1, 1, 5),
    resources: String(assessment.resources ?? '').trim(),
    support: String(assessment.support ?? '').trim(),
    barriers: String(assessment.barriers ?? '').trim(),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createId(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${uuid ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function parseDateKey(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey))) return null;
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.valueOf())) return null;
  const [year, month, day] = String(dateKey).split('-').map(Number);
  return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day ? date : null;
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

function interpolateDate(start, end, step, total) {
  const startKey = toDateKey(start);
  const endKey = toDateKey(end);
  const days = Math.round((utcDayNumber(endKey) - utcDayNumber(startKey)) / DAY_MS);
  return toDateKey(addDays(parseDateKey(startKey), Math.round((days * step) / total)));
}

function utcDayNumber(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

