import Dexie, { type Table } from 'dexie';
import { 
  Domain, Activity, Session, Bonus, ShopItem, Redemption, LedgerEntry, PersonalConfig,
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
    console.log('Populating with placeholder data...')
    console.log('Import your personal config from Settings to customize!')
    
    // Create placeholder domains
    for (const domain of DEFAULT_DOMAINS) {
      await this.domains.add({
        ...domain,
        lifetimeMinutes: 0,
        level: 1,
        multiplier: 1.0
      });
    }

    // Create placeholder shop items
    for (const item of DEFAULT_SHOP_ITEMS) {
      await this.shopItems.add(item);
    }

    // Create placeholder activities
    const domains = await this.domains.toArray();
    for (const domain of domains) {
      const defaultActivities = ['Task 1', 'Task 2', 'Task 3'];
      for (const activityName of defaultActivities) {
        await this.activities.add({
          domainId: domain.id!,
          name: activityName,
          isActive: true
        });
      }
    }
    
    console.log('Placeholder data created')
  }

  // Import personal configuration
  async importPersonalConfig(config: PersonalConfig): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Importing personal config...')
      
      // Clear existing domains, activities, and shop items (but keep sessions/ledger)
      await this.domains.clear();
      await this.activities.clear();
      await this.shopItems.clear();
      
      // Import domains
      const domainIdMap = new Map<string, number>();
      for (const domain of config.domains) {
        const id = await this.domains.add({
          ...domain,
          lifetimeMinutes: 0,
          level: 1,
          multiplier: 1.0
        });
        domainIdMap.set(domain.name, id);
      }
      console.log(`Imported ${config.domains.length} domains`)
      
      // Import activities
      for (const activityGroup of config.activities) {
        const domainId = domainIdMap.get(activityGroup.domainName);
        if (domainId) {
          for (const activityName of activityGroup.activities) {
            await this.activities.add({
              domainId,
              name: activityName,
              isActive: true
            });
          }
        }
      }
      console.log(`Imported activities for ${config.activities.length} domains`)
      
      // Import shop items
      for (const item of config.shopItems) {
        await this.shopItems.add(item);
      }
      console.log(`Imported ${config.shopItems.length} shop items`)
      
      // Store config version
      localStorage.setItem('lifeMotivatorConfigVersion', String(config.version));
      localStorage.setItem('lifeMotivatorConfigImported', 'true');
      
      return { success: true, message: `Successfully imported: ${config.domains.length} domains, ${config.shopItems.length} shop items` };
    } catch (error) {
      console.error('Failed to import config:', error);
      return { success: false, message: `Import failed: ${error}` };
    }
  }

  // Check if personal config has been imported
  hasPersonalConfig(): boolean {
    return localStorage.getItem('lifeMotivatorConfigImported') === 'true';
  }
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