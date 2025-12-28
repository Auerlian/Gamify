import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Trophy, Sparkles, Zap, Gift } from 'lucide-react'
import { db, getCurrentBalance } from '../database'
import { ShopItem, Redemption } from '../types'

// Celebration component
function CelebrationOverlay({ item, onComplete }: { item: ShopItem; onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3000)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div className="celebration-overlay" onClick={onComplete}>
      <div className="celebration-content">
        <div className="celebration-confetti">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="confetti-piece" style={{ 
              '--delay': `${Math.random() * 0.5}s`,
              '--x': `${Math.random() * 100 - 50}vw`,
              '--rotation': `${Math.random() * 360}deg`,
              backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6'][Math.floor(Math.random() * 5)]
            } as React.CSSProperties} />
          ))}
        </div>
        <div className="celebration-icon">
          <Trophy size={64} />
        </div>
        <div className="celebration-title">
          <Sparkles size={24} className="sparkle-icon" />
          Achievement Unlocked!
          <Sparkles size={24} className="sparkle-icon" />
        </div>
        <div className="celebration-item-name">{item.name}</div>
        <div className="celebration-message">
          You've earned this reward! Enjoy it!
        </div>
        <div className="celebration-tap">Tap anywhere to continue</div>
      </div>
    </div>
  )
}

// Category icon mapping
const getCategoryIcon = (category: string) => {
  const lower = category.toLowerCase()
  if (lower.includes('treat') || lower.includes('food') || lower.includes('snack')) return '🍕'
  if (lower.includes('entertainment') || lower.includes('fun')) return '🎮'
  if (lower.includes('health') || lower.includes('wellness')) return '💪'
  if (lower.includes('tech') || lower.includes('gadget')) return '📱'
  if (lower.includes('travel') || lower.includes('experience')) return '✈️'
  if (lower.includes('big') || lower.includes('major') || lower.includes('luxury')) return '💎'
  if (lower.includes('small') || lower.includes('quick')) return '⚡'
  return '🎁'
}

export default function ShopTab() {
  const [shopItems, setShopItems] = useState<ShopItem[]>([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [recentRedemptions, setRecentRedemptions] = useState<Redemption[]>([])
  const [celebratingItem, setCelebratingItem] = useState<ShopItem | null>(null)
  const [itemAchievedCounts, setItemAchievedCounts] = useState<Map<number, number>>(new Map())

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      console.log('Loading shop data...')
      
      const [itemsData, balanceData, redemptionsData, allRedemptions] = await Promise.all([
        db.shopItems.toArray().then(items => {
          console.log('All shop items:', items)
          const activeItems = items.filter(i => i.isActive)
          console.log('Active shop items:', activeItems)
          return activeItems
        }),
        getCurrentBalance(),
        db.redemptions.orderBy('timestamp').reverse().limit(10).toArray(),
        db.redemptions.toArray()
      ])

      // Calculate achieved counts for each item
      const achievedCounts = new Map<number, number>()
      for (const redemption of allRedemptions) {
        const currentCount = achievedCounts.get(redemption.shopItemId) || 0
        achievedCounts.set(redemption.shopItemId, currentCount + 1)
      }
      setItemAchievedCounts(achievedCounts)

      setShopItems(itemsData)
      setBalance(balanceData)
      setRecentRedemptions(redemptionsData)
      
      console.log('Shop data loaded:', { items: itemsData.length, balance: balanceData })
    } catch (error) {
      console.error('Failed to load shop data:', error)
    } finally {
      setLoading(false)
    }
  }

  const categories = [...new Set(shopItems.map(item => item.category))]
  
  // Group items by category
  const itemsByCategory = categories.reduce((acc, category) => {
    acc[category] = shopItems.filter(item => item.category === category)
      .sort((a, b) => a.pricePoints - b.pricePoints)
    return acc
  }, {} as Record<string, ShopItem[]>)

  const canAfford = (price: number) => balance >= price
  const affordabilityPercent = (price: number) => Math.min(100, Math.round((balance / price) * 100))

  const handlePurchase = async (item: ShopItem) => {
    if (!canAfford(item.pricePoints)) {
      alert('Insufficient points!')
      return
    }

    // Check cooldown
    if (item.cooldownDays) {
      const recentPurchase = recentRedemptions.find(r => 
        r.shopItemId === item.id && 
        Date.now() - r.timestamp < item.cooldownDays! * 24 * 60 * 60 * 1000
      )
      
      if (recentPurchase) {
        const daysLeft = Math.ceil((recentPurchase.timestamp + item.cooldownDays! * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000))
        alert(`This item is on cooldown for ${daysLeft} more day(s)`)
        return
      }
    }

    // Confirmation dialog
    const message = item.requiresReview 
      ? `⚠️ This purchase requires review.\n\nSpend ${item.pricePoints.toLocaleString()} points on ${item.name}?\n\nThis is a significant purchase. Make sure you really want this.`
      : `Spend ${item.pricePoints.toLocaleString()} points on ${item.name}?`
    
    if (!confirm(message)) return

    try {
      const timestamp = Date.now()
      
      // Record redemption
      const redemptionId = await db.redemptions.add({
        timestamp,
        shopItemId: item.id!,
        pricePoints: item.pricePoints,
        notes: item.requiresReview ? 'Requires review before action' : undefined
      })

      // Add to ledger
      await db.ledger.add({
        timestamp,
        type: 'spend_shop',
        pointsDelta: -item.pricePoints,
        referenceId: redemptionId,
        description: `Purchase: ${item.name}`
      })

      // Reload data
      await loadData()

      // Show celebration instead of alert
      setCelebratingItem(item)

    } catch (error) {
      console.error('Failed to process purchase:', error)
      alert('Purchase failed. Please try again.')
    }
  }

  const handleCelebrationComplete = useCallback(() => {
    setCelebratingItem(null)
  }, [])

  if (loading) {
    return (
      <div className="page">
        <div className="loading">Loading shop...</div>
      </div>
    )
  }

  return (
    <div className="page fade-in">
      {celebratingItem && (
        <CelebrationOverlay item={celebratingItem} onComplete={handleCelebrationComplete} />
      )}
      
      {/* Hero Balance */}
      <div className="shop-hero">
        <div className="shop-hero-label">Your Balance</div>
        <div className="shop-hero-balance">{balance.toLocaleString()}</div>
        <div className="shop-hero-currency">points to spend</div>
      </div>

      {/* Shop Categories */}
      {categories.map(category => {
        const items = itemsByCategory[category]
        const categoryIcon = getCategoryIcon(category)
        
        return (
          <div key={category} className="shop-category">
            <div className="shop-category-header">
              <span className="shop-category-icon">{categoryIcon}</span>
              <span className="shop-category-title">{category}</span>
              <span className="shop-category-count">{items.length} items</span>
            </div>
            
            <div className="shop-items">
              {items.map(item => {
                const achievedCount = itemAchievedCounts.get(item.id!) || 0
                const affordable = canAfford(item.pricePoints)
                const progress = affordabilityPercent(item.pricePoints)
                
                return (
                  <div 
                    key={item.id} 
                    className={`shop-card ${affordable ? 'shop-card-affordable' : ''}`}
                  >
                    {achievedCount > 0 && (
                      <div className="shop-card-badge">
                        <Trophy size={10} />
                        {achievedCount > 1 ? `×${achievedCount}` : '✓'}
                      </div>
                    )}
                    
                    <div className="shop-card-content">
                      <div className="shop-card-name">{item.name}</div>
                      
                      {item.requiresReview && (
                        <div className="shop-card-tag shop-card-tag-review">
                          <AlertTriangle size={10} />
                          Review Required
                        </div>
                      )}
                      
                      {item.cooldownDays && (
                        <div className="shop-card-meta">{item.cooldownDays}d cooldown</div>
                      )}
                    </div>
                    
                    <div className="shop-card-price-section">
                      <div className={`shop-card-price ${affordable ? 'shop-card-price-affordable' : ''}`}>
                        {item.pricePoints.toLocaleString()}
                      </div>
                      
                      {!affordable && (
                        <div className="shop-card-progress">
                          <div 
                            className="shop-card-progress-fill" 
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                      
                      <button
                        onClick={() => handlePurchase(item)}
                        disabled={!affordable}
                        className={`shop-card-btn ${affordable ? 'shop-card-btn-buy' : 'shop-card-btn-locked'}`}
                      >
                        {affordable ? (
                          <>
                            <Zap size={14} />
                            Unlock
                          </>
                        ) : (
                          `${progress}%`
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {shopItems.length === 0 && (
        <div className="shop-empty">
          <Gift size={48} />
          <div>No rewards configured yet</div>
          <div className="shop-empty-hint">Import a config to add your personal rewards</div>
        </div>
      )}

      {/* Recent Purchases */}
      {recentRedemptions.length > 0 && (
        <div className="shop-history">
          <div className="shop-history-title">Recent Unlocks</div>
          {recentRedemptions.slice(0, 3).map(redemption => {
            const item = shopItems.find(i => i.id === redemption.shopItemId)
            return (
              <div key={redemption.id} className="shop-history-item">
                <div className="shop-history-name">{item?.name || 'Unknown'}</div>
                <div className="shop-history-date">
                  {new Date(redemption.timestamp).toLocaleDateString()}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}