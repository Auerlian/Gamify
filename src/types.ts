// Core data types for Life Motivator

export interface Domain {
  id?: number;
  configId?: string; // ID from config file (e.g., "startup", "freelance")
  name: string;
  baseRate: number; // points per minute
  lifetimeMinutes: number;
  level: number;
  multiplier: number;
  dailySoftCapMinutes?: number;
  dailyHardCapMinutes?: number;
  colorHint?: string;
  isActive: boolean;
}

export interface Activity {
  id?: number;
  configId?: string; // ID from config file
  domainId: number;
  domainConfigId?: string; // Reference to domain's configId
  name: string;
  tags?: string[];
  rateOverride?: number | null;
  deepWorkEligible?: boolean;
  minBlockMinutes?: number;
  notesPrompt?: string;
  isActive: boolean;
}

export interface Session {
  id?: number;
  startTime: number; // timestamp
  endTime: number;
  durationMinutes: number;
  domainId: number;
  activityId?: number;
  pointsAwarded: number;
  notes?: string;
  source: 'timer' | 'manual';
  reviewFlag: boolean;
}

export interface Bonus {
  id?: number;
  timestamp: number;
  title: string;
  points: number;
  notes?: string;
  attachmentRef?: string;
}

export interface ShopItem {
  id?: number;
  category: string;
  name: string;
  pricePoints: number;
  description?: string;
  cooldownDays?: number;
  requiresReview: boolean;
  requirements?: string[]; // e.g., ["medical_consult_logged", "savings_check_logged"]
  realCostEstimate?: string;
  isActive: boolean;
  achievedCount?: number; // Track how many times this item has been purchased
}

export interface Redemption {
  id?: number;
  timestamp: number;
  shopItemId: number;
  pricePoints: number;
  notes?: string;
  attachmentRef?: string;
}

export interface LedgerEntry {
  id?: number;
  timestamp: number;
  type: 'earn_session' | 'earn_bonus' | 'spend_shop';
  pointsDelta: number; // positive for earn, negative for spend
  referenceId: number; // session/bonus/redemption id
  description: string;
}

// Personal config that can be imported (supports v1 simple and v2 detailed formats)
export interface PersonalConfigV1 {
  version: 1;
  domains: { name: string; baseRate: number; dailySoftCapMinutes?: number; isActive: boolean }[];
  activities: { domainName: string; activities: string[] }[];
  shopItems: Omit<ShopItem, 'id'>[];
  bonusMilestones: { title: string; points: number }[];
}

export interface PersonalConfigV2 {
  version: 2;
  meta?: {
    ownerName?: string;
    timezone?: string;
    currencyName?: string;
    rateUnit?: string;
    appName?: string;
    createdAtISO?: string;
  };
  economy?: {
    sessionRoundingMinutes?: number;
    minSessionMinutes?: number;
    maxManualBackfillDays?: number;
    defaultSessionTags?: string[];
    antiGaming?: Record<string, unknown>;
    diminishingReturns?: Record<string, unknown>;
    reviewGates?: Record<string, unknown>;
  };
  domains: {
    id: string;
    name: string;
    baseRate: number;
    dailySoftCapMinutes?: number;
    dailyHardCapMinutes?: number;
    isActive: boolean;
    colorHint?: string;
  }[];
  activityLibrary: {
    id: string;
    domainId: string;
    name: string;
    tags?: string[];
    rateOverride?: number | null;
    deepWorkEligible?: boolean;
    minBlockMinutes?: number;
    notesPrompt?: string;
  }[];
  multipliers?: Record<string, unknown>;
  bonuses?: Record<string, unknown>;
  bonusMilestones?: { title: string; points: number; requiresReview?: boolean }[];
  shopRules?: Record<string, unknown>;
  shopItems: {
    category: string;
    name: string;
    pricePoints: number;
    cooldownDays?: number;
    requiresReview: boolean;
    requirements?: string[];
    isActive: boolean;
  }[];
  requirementsLibrary?: { id: string; description: string }[];
  ui?: Record<string, unknown>;
}

export type PersonalConfig = PersonalConfigV1 | PersonalConfigV2;

// Level progression constants
export const LEVEL_THRESHOLDS = [0, 25, 75, 150, 300, 600, 1000, 1600, 2500, 4000];
export const MULTIPLIERS = [1.0, 1.1, 1.25, 1.4, 1.6, 1.85, 2.1, 2.4, 2.75, 3.2];

// PLACEHOLDER defaults - these are generic examples
// Your personal config will override these when imported
export const DEFAULT_DOMAINS: Omit<Domain, 'id' | 'lifetimeMinutes' | 'level' | 'multiplier'>[] = [
  { name: 'Category 1', baseRate: 10, dailySoftCapMinutes: 360, isActive: true },
  { name: 'Category 2', baseRate: 8, dailySoftCapMinutes: 360, isActive: true },
  { name: 'Category 3', baseRate: 6, dailySoftCapMinutes: 240, isActive: true },
];

// PLACEHOLDER shop items - generic examples only
export const DEFAULT_SHOP_ITEMS: Omit<ShopItem, 'id'>[] = [
  { category: 'Small Rewards', name: 'Small Treat', pricePoints: 5000, requiresReview: false, isActive: true },
  { category: 'Small Rewards', name: 'Medium Treat', pricePoints: 15000, requiresReview: false, isActive: true },
  { category: 'Big Rewards', name: 'Big Purchase', pricePoints: 50000, requiresReview: false, isActive: true },
  { category: 'Big Rewards', name: 'Major Purchase', pricePoints: 150000, requiresReview: true, isActive: true },
];

// PLACEHOLDER bonus milestones
export const DEFAULT_BONUSES = [
  { title: "First milestone", points: 5000 },
  { title: "Major achievement", points: 25000 },
  { title: "Huge accomplishment", points: 50000 },
];

// Anti-gaming constraints
export const DAILY_HARD_CAP_MINUTES = 12 * 60; // 12 hours max per day
export const DOMAIN_SOFT_CAP_PENALTY = 0.3; // 30% reduction after soft cap
export const MINIMUM_SESSION_MINUTES = 5; // Sessions under 5 minutes earn 0 points