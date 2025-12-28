// Core data types for Life Motivator

export interface Domain {
  id?: number;
  name: string;
  baseRate: number; // points per hour
  lifetimeMinutes: number;
  level: number;
  multiplier: number;
  dailySoftCapMinutes?: number;
  isActive: boolean;
}

export interface Activity {
  id?: number;
  domainId: number;
  name: string;
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

// Personal config that can be imported
export interface PersonalConfig {
  version: number;
  domains: Omit<Domain, 'id' | 'lifetimeMinutes' | 'level' | 'multiplier'>[];
  activities: { domainName: string; activities: string[] }[];
  shopItems: Omit<ShopItem, 'id'>[];
  bonusMilestones: { title: string; points: number }[];
}

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