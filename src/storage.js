import { deriveCharacter } from './domain.js';

const STORAGE_KEY = 'life-rpg-state-v2';
const LEGACY_STORAGE_KEY = 'life-rpg-state-v1';
const ATTRIBUTE_KEYS = ['time', 'energy', 'experience', 'confidence', 'support', 'focus', 'courage', 'creativity'];

export function createInitialState(now = new Date()) {
  const character = deriveCharacter({});
  return {
    version: 2,
    profile: {
      xp: 0,
      coins: 0,
      streak: 0,
      lastActiveDate: null,
      badges: [],
      setupComplete: false,
      onboardingStep: 0,
      answers: {},
      attributes: character.attributes,
      attributeEvidence: character.evidence,
      updatedAt: now.toISOString(),
    },
    campaigns: [],
    reviews: [],
    activeCampaignId: null,
  };
}

export function loadState(storage, now = new Date()) {
  try {
    const target = storage ?? globalThis.localStorage;
    const currentRaw = target?.getItem(STORAGE_KEY);
    if (currentRaw) {
      try {
        const current = JSON.parse(currentRaw);
        if (isValidState(current)) return current;
      } catch {
        // A damaged current save can still be recovered from the untouched v1 copy.
      }
    }

    const legacyRaw = target?.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      try {
        const legacy = JSON.parse(legacyRaw);
        if (isValidStateV1(legacy)) {
          const migrated = migrateV1State(legacy, now);
          saveState(target, migrated);
          return migrated;
        }
      } catch {
        // Fall through to a clean character setup when neither save is usable.
      }
    }
    return createInitialState(now);
  } catch {
    return createInitialState(now);
  }
}

function migrateV1State(state, now) {
  const defaultCharacter = deriveCharacter({});
  const oldProfile = state.profile;
  const profileAnswers = isRecord(oldProfile.answers) ? { ...oldProfile.answers } : {};
  const attributes = isValidAttributes(oldProfile.attributes) ? { ...oldProfile.attributes } : defaultCharacter.attributes;
  const attributeEvidence = isRecord(oldProfile.attributeEvidence)
    ? { ...defaultCharacter.evidence, ...oldProfile.attributeEvidence }
    : defaultCharacter.evidence;

  return {
    ...state,
    version: 2,
    profile: {
      ...oldProfile,
      setupComplete: false,
      onboardingStep: 0,
      answers: profileAnswers,
      attributes,
      attributeEvidence,
      updatedAt: now.toISOString(),
    },
    campaigns: state.campaigns.map((campaign) => ({
      ...campaign,
      projectName: typeof campaign.projectName === 'string' ? campaign.projectName : '',
      projectDescription: typeof campaign.projectDescription === 'string' ? campaign.projectDescription : '',
      attributes: isValidAttributes(campaign.attributes) ? campaign.attributes : null,
    })),
  };
}

function isValidState(state) {
  if (!isRecord(state) || state.version !== 2 || !Array.isArray(state.campaigns) || !Array.isArray(state.reviews)) return false;
  const profile = state.profile;
  if (
    !isRecord(profile)
    || !isNonNegativeNumber(profile.xp)
    || !isNonNegativeNumber(profile.coins)
    || !isNonNegativeNumber(profile.streak)
    || !Array.isArray(profile.badges)
    || (profile.lastActiveDate !== null && typeof profile.lastActiveDate !== 'string')
    || typeof profile.setupComplete !== 'boolean'
    || !Number.isInteger(profile.onboardingStep)
    || profile.onboardingStep < 0
    || profile.onboardingStep > 18
    || !isRecord(profile.answers)
    || !isValidAttributes(profile.attributes)
    || !isRecord(profile.attributeEvidence)
    || !ATTRIBUTE_KEYS.every((key) => typeof profile.attributeEvidence[key] === 'string')
    || typeof profile.updatedAt !== 'string'
  ) return false;

  if (!state.campaigns.every(isValidCampaign)) return false;
  if (profile.setupComplete) {
    if (!hasCompleteCharacterAnswers(profile.answers) || state.campaigns.length === 0) return false;
  } else {
    if (profile.onboardingStep >= 4 && !hasCoreCharacterAnswers(profile.answers)) return false;
    if (profile.onboardingStep > 4
      && profile.answers.metricCheck === 'unclear'
      && !hasTextAnswer(profile.answers.metricClarification)) return false;
  }
  if (state.campaigns.length === 0) {
    if (state.activeCampaignId !== null) return false;
  } else if (!state.campaigns.some((campaign) => campaign.id === state.activeCampaignId)) {
    return false;
  }
  return state.reviews.every(isValidReview);
}

function hasCompleteCharacterAnswers(answers) {
  return hasCoreCharacterAnswers(answers)
    && ['clear', 'unclear'].includes(answers.metricCheck)
    && (answers.metricCheck === 'clear' || hasTextAnswer(answers.metricClarification));
}

function hasCoreCharacterAnswers(answers) {
  return ['projectDescription', 'desiredResult', 'successMetric'].every((key) => hasTextAnswer(answers[key]))
    && ['clear', 'unclear'].includes(answers.metricCheck);
}

function hasTextAnswer(value) {
  return typeof value === 'string' && value.trim().length >= 4;
}

function isValidStateV1(state) {
  if (!isRecord(state) || state.version !== 1 || !Array.isArray(state.campaigns) || !Array.isArray(state.reviews)) return false;
  const profile = state.profile;
  if (
    !isRecord(profile)
    || !isNonNegativeNumber(profile.xp)
    || !isNonNegativeNumber(profile.coins)
    || !isNonNegativeNumber(profile.streak)
    || !Array.isArray(profile.badges)
    || (profile.lastActiveDate !== null && typeof profile.lastActiveDate !== 'string')
  ) return false;
  if (!state.campaigns.every(isValidCampaignV1)) return false;
  if (state.campaigns.length === 0) {
    if (state.activeCampaignId !== null) return false;
  } else if (!state.campaigns.some((campaign) => campaign.id === state.activeCampaignId)) {
    return false;
  }
  return state.reviews.every(isValidReview);
}

function isValidCampaign(campaign) {
  if (
    !isRecord(campaign)
    || typeof campaign.id !== 'string'
    || typeof campaign.projectName !== 'string'
    || typeof campaign.projectDescription !== 'string'
    || (campaign.attributes !== null && !isValidAttributes(campaign.attributes))
    || typeof campaign.title !== 'string'
    || typeof campaign.why !== 'string'
    || !Array.isArray(campaign.milestones)
    || !isRecord(campaign.assessment)
    || !isRecord(campaign.answers)
    || !isNonNegativeNumber(campaign.resourceScore)
    || !campaign.milestones.every((phase) => isRecord(phase)
      && typeof phase.id === 'string'
      && typeof phase.title === 'string'
      && typeof phase.outcome === 'string'
      && typeof phase.dueDate === 'string'
      && Array.isArray(phase.quests)
      && phase.quests.every(isValidQuest))
  ) return false;
  const assessment = campaign.assessment;
  return isNonNegativeNumber(assessment.weeklyHours)
    && Number.isFinite(assessment.energy)
    && Number.isFinite(assessment.confidence);
}

function isValidCampaignV1(campaign) {
  if (
    !isRecord(campaign)
    || typeof campaign.id !== 'string'
    || typeof campaign.title !== 'string'
    || typeof campaign.why !== 'string'
    || !Array.isArray(campaign.milestones)
    || !isRecord(campaign.assessment)
    || !isRecord(campaign.answers)
    || !isNonNegativeNumber(campaign.resourceScore)
    || !campaign.milestones.every((phase) => isRecord(phase)
      && typeof phase.id === 'string'
      && typeof phase.title === 'string'
      && typeof phase.outcome === 'string'
      && typeof phase.dueDate === 'string'
      && Array.isArray(phase.quests)
      && phase.quests.every(isValidQuest))
  ) return false;
  return isNonNegativeNumber(campaign.assessment.weeklyHours)
    && Number.isFinite(campaign.assessment.energy)
    && Number.isFinite(campaign.assessment.confidence);
}

function isValidQuest(quest) {
  return isRecord(quest)
    && typeof quest.id === 'string'
    && typeof quest.title === 'string'
    && typeof quest.description === 'string'
    && typeof quest.successCriteria === 'string'
    && ['open', 'postponed', 'blocked', 'done'].includes(quest.status)
    && isNonNegativeNumber(quest.xp)
    && isNonNegativeNumber(quest.minutes)
    && typeof quest.dueDate === 'string';
}

function isValidReview(review) {
  return isRecord(review)
    && typeof review.id === 'string'
    && (review.type === 'evening' || review.type === 'weekly')
    && typeof review.date === 'string'
    && Number.isFinite(review.energy)
    && typeof review.win === 'string'
    && typeof review.blocker === 'string'
    && typeof review.nextStep === 'string';
}

function isValidAttributes(attributes) {
  return isRecord(attributes)
    && Number.isFinite(attributes.time)
    && attributes.time >= 0 && attributes.time <= 40
    && ['energy', 'experience', 'confidence', 'support', 'focus', 'courage', 'creativity']
      .every((key) => Number.isInteger(attributes[key]) && attributes[key] >= 1 && attributes[key] <= 5);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonNegativeNumber(value) {
  return Number.isFinite(value) && value >= 0;
}

export function saveState(storage, state) {
  try {
    const target = storage ?? globalThis.localStorage;
    if (!target) return false;
    target.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

