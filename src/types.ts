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

// Level progression constants
export const LEVEL_THRESHOLDS = [0, 25, 75, 150, 300, 600, 1000, 1600, 2500, 4000];
export const MULTIPLIERS = [1.0, 1.1, 1.25, 1.4, 1.6, 1.85, 2.1, 2.4, 2.75, 3.2];

// Default domain configurations
export const DEFAULT_DOMAINS: Omit<Domain, 'id' | 'lifetimeMinutes' | 'level' | 'multiplier'>[] = [
  { name: 'Business', baseRate: 16, dailySoftCapMinutes: 360, isActive: true },
  { name: 'Freelancing', baseRate: 14, dailySoftCapMinutes: 360, isActive: true },
  { name: 'Education', baseRate: 10, dailySoftCapMinutes: 360, isActive: true },
  { name: 'Exercise', baseRate: 9, dailySoftCapMinutes: 180, isActive: true },
  { name: 'Domestic', baseRate: 7, dailySoftCapMinutes: 240, isActive: true },
  { name: 'Food', baseRate: 6, dailySoftCapMinutes: 120, isActive: true },
];

// Shop categories and items
export const DEFAULT_SHOP_ITEMS: Omit<ShopItem, 'id'>[] = [
  // Tech
  { category: 'Tech', name: 'AirPods', pricePoints: 25000, realCostEstimate: '£250', requiresReview: false, isActive: true },
  { category: 'Tech', name: 'Apple Watch', pricePoints: 85000, realCostEstimate: '£400', requiresReview: false, isActive: true },
  { category: 'Tech', name: 'iPad', pricePoints: 140000, realCostEstimate: '£600', requiresReview: false, isActive: true },
  { category: 'Tech', name: 'MacBook Air', pricePoints: 220000, realCostEstimate: '£1,200', requiresReview: false, isActive: true },
  { category: 'Tech', name: 'MacBook Pro', pricePoints: 350000, realCostEstimate: '£2,000', requiresReview: false, isActive: true },
  { category: 'Tech', name: 'High-end Monitor', pricePoints: 120000, realCostEstimate: '£800', requiresReview: false, isActive: true },

  // Relaxation
  { category: 'Relaxation', name: 'Cinema Trip', pricePoints: 6000, cooldownDays: 7, realCostEstimate: '£15', requiresReview: false, isActive: true },
  { category: 'Relaxation', name: 'Restaurant Date', pricePoints: 18000, cooldownDays: 7, realCostEstimate: '£80', requiresReview: false, isActive: true },
  { category: 'Relaxation', name: 'Guitar', pricePoints: 95000, realCostEstimate: '£500', requiresReview: false, isActive: true },
  { category: 'Relaxation', name: 'Weekend Trip', pricePoints: 180000, realCostEstimate: '£400', requiresReview: false, isActive: true },
  { category: 'Relaxation', name: 'Holiday (1 week)', pricePoints: 420000, realCostEstimate: '£1,500', requiresReview: false, isActive: true },
  { category: 'Relaxation', name: 'Big Holiday (2-3 weeks)', pricePoints: 800000, realCostEstimate: '£3,000', requiresReview: false, isActive: true },

  // Equipment
  { category: 'Equipment', name: 'Blender', pricePoints: 28000, realCostEstimate: '£150', requiresReview: false, isActive: true },
  { category: 'Equipment', name: 'Mechanical Keyboard', pricePoints: 55000, realCostEstimate: '£200', requiresReview: false, isActive: true },
  { category: 'Equipment', name: 'Desk Upgrade', pricePoints: 70000, realCostEstimate: '£400', requiresReview: false, isActive: true },
  { category: 'Equipment', name: 'Herman Miller Chair', pricePoints: 260000, realCostEstimate: '£1,200', requiresReview: false, isActive: true },

  // Transport
  { category: 'Transport', name: 'Basic Car (Volkswagen)', pricePoints: 2200000, realCostEstimate: '£15,000', requiresReview: true, isActive: true },
  { category: 'Transport', name: 'Advanced Car (Range Rover)', pricePoints: 6500000, realCostEstimate: '£60,000', requiresReview: true, isActive: true },
  { category: 'Transport', name: 'Luxury Car (Porsche)', pricePoints: 8500000, realCostEstimate: '£80,000', requiresReview: true, isActive: true },
  { category: 'Transport', name: 'Super Luxury (Ferrari)', pricePoints: 18000000, realCostEstimate: '£200,000', requiresReview: true, isActive: true },

  // Property
  { category: 'Property', name: 'Small Flat (2-room)', pricePoints: 22000000, realCostEstimate: '£200,000', requiresReview: true, isActive: true },
  { category: 'Property', name: 'Medium House (5 rooms)', pricePoints: 45000000, realCostEstimate: '£500,000', requiresReview: true, isActive: true },
  { category: 'Property', name: 'Large House (10+ rooms)', pricePoints: 85000000, realCostEstimate: '£1,000,000', requiresReview: true, isActive: true },
  { category: 'Property', name: 'Deluxe Mansion', pricePoints: 140000000, realCostEstimate: '£2,000,000', requiresReview: true, isActive: true },

  // Meta-life
  { category: 'Meta-life', name: 'Marriage Fund', pricePoints: 5000000, realCostEstimate: '£30,000', requiresReview: true, isActive: true },
  { category: 'Meta-life', name: 'Live Anywhere Setup', pricePoints: 12000000, realCostEstimate: '£100,000', requiresReview: true, isActive: true },
  { category: 'Meta-life', name: 'Seed Funding War Chest', pricePoints: 25000000, realCostEstimate: '£250,000', requiresReview: true, isActive: true },
];

// Default bonus milestones
export const DEFAULT_BONUSES = [
  { title: "Meet girlfriend's parents", points: 25000 },
  { title: "First £1,000 month freelancing", points: 50000 },
  { title: "£3,000 month freelancing", points: 150000 },
  { title: "First recurring client retainer", points: 75000 },
  { title: "Launch a paid product", points: 200000 },
  { title: "University grade milestone (First-class year)", points: 80000 },
  { title: "Health milestone (consistent gym 12 weeks)", points: 40000 },
];

// Anti-gaming constraints
export const DAILY_HARD_CAP_MINUTES = 12 * 60; // 12 hours max per day
export const DOMAIN_SOFT_CAP_PENALTY = 0.3; // 30% reduction after soft cap
export const MINIMUM_SESSION_MINUTES = 5; // Sessions under 5 minutes earn 0 points