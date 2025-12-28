import Dexie, { type Table } from 'dexie';
import { 
  Domain, Activity, Session, Bonus, ShopItem, Redemption, LedgerEntry,
  DEFAULT_DOMAINS, DEFAULT_SHOP_ITEMS, LEVEL_THRESHOLDS, MULTIPLIERS
} from './types';

class LifeMotivatorDB extends Dexie {
  domains!: Table<Domain>;
  activities!: Table<Activity>;
  sessions!: Table<Session>;
  bonuses!: Table<Bonus>;
  shopItems!: Table<ShopItem>;
  redemptions!: Table<Redemption>;
  ledger!: Table<LedgerEntry>;

  constructor() {
    super('LifeMotivatorDB');
    
    this.version(1).stores({
      domains: '++id, name, isActive',
      activities: '++id, domainId, isActive',
      sessions: '++id, startTime, domainId, source',
      bonuses: '++id, timestamp',
      shopItems: '++id, category, isActive',
      redemptions: '++id, timestamp, shopItemId',
      ledger: '++id, timestamp, type'
    });

    this.on('populate', this.populateDefaults.bind(this));
  }

  async populateDefaults() {
    console.log('Populating default data...')
    
    // Create default domains
    console.log('Creating default domains:', DEFAULT_DOMAINS)
    const domainPromises = DEFAULT_DOMAINS.map(domain => 
      this.domains.add({
        ...domain,
        lifetimeMinutes: 0,
        level: 1,
        multiplier: 1.0
      })
    );
    
    await Promise.all(domainPromises);
    console.log('Default domains created')

    // Create default shop items
    console.log('Creating default shop items:', DEFAULT_SHOP_ITEMS.length, 'items')
    const shopPromises = DEFAULT_SHOP_ITEMS.map(item => 
      this.shopItems.add(item)
    );
    
    await Promise.all(shopPromises);
    console.log('Default shop items created')

    // Create default activities for each domain
    const domains = await this.domains.toArray();
    console.log('Creating activities for domains:', domains)
    const activityPromises: Promise<number>[] = [];

    domains.forEach(domain => {
      const defaultActivities = getDefaultActivitiesForDomain(domain.name);
      defaultActivities.forEach(activityName => {
        activityPromises.push(
          this.activities.add({
            domainId: domain.id!,
            name: activityName,
            isActive: true
          })
        );
      });
    });

    await Promise.all(activityPromises);
    console.log('Default activities created')
  }
}

function getDefaultActivitiesForDomain(domainName: string): string[] {
  const activityMap: Record<string, string[]> = {
    'Business': ['Morning Buddy work', 'Strategy planning', 'Product development', 'Marketing'],
    'Freelancing': ['Client outreach', 'Build demo', 'Delivery work', 'Portfolio update'],
    'Education': ['Lecture', 'Assignment', 'Revision', 'Research'],
    'Exercise': ['Gym session', 'Cardio', 'Mobility work', 'Sports'],
    'Domestic': ['Kitchen reset', 'Laundry', 'Room tidy', 'Admin tasks'],
    'Food': ['Meal prep', 'Cooking', 'Nutrition planning', 'Shopping']
  };
  
  return activityMap[domainName] || ['General work'];
}

export const db = new LifeMotivatorDB();

// Helper functions for calculations
export function getLevelAndMultiplier(totalMinutes: number): { level: number; multiplier: number } {
  const hours = totalMinutes / 60;
  let level = 1;
  let multiplier = 1.0;

  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (hours >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      multiplier = MULTIPLIERS[i];
    } else {
      break;
    }
  }

  return { level, multiplier };
}

export function calculateSessionPoints(
  durationMinutes: number,
  baseRate: number,
  multiplier: number,
  applySoftCapPenalty: boolean = false
): number {
  if (durationMinutes < 5) return 0; // Minimum session length
  
  const hours = durationMinutes / 60;
  let points = hours * baseRate * multiplier;
  
  if (applySoftCapPenalty) {
    points *= (1 - 0.3); // 30% penalty for soft cap
  }
  
  return Math.round(points);
}

export async function getTodaysSessions(): Promise<Session[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000;

  return await db.sessions
    .where('startTime')
    .between(todayStart, todayEnd)
    .toArray();
}

export async function getDomainMinutesToday(domainId: number): Promise<number> {
  const sessions = await getTodaysSessions();
  return sessions
    .filter(s => s.domainId === domainId)
    .reduce((total, s) => total + s.durationMinutes, 0);
}

export async function getTotalMinutesToday(): Promise<number> {
  const sessions = await getTodaysSessions();
  return sessions.reduce((total, s) => total + s.durationMinutes, 0);
}

export async function getCurrentBalance(): Promise<number> {
  const entries = await db.ledger.toArray();
  return entries.reduce((balance, entry) => balance + entry.pointsDelta, 0);
}