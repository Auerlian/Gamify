import { useState, useEffect, useCallback } from 'react'
import { ShoppingCart, AlertTriangle, Trophy, Sparkles } from 'lucide-react'
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

export default function ShopTab() {
  const [shopItems, setShopItems] = useState<ShopItem[]>([])
  const [balance, setBalance] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
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

  const categories = ['All', ...new Set(shopItems.map(item => item.category))]
  
  const filteredItems = selectedCategory === 'All' 
    ? shopItems 
    : shopItems.filter(item => item.category === selectedCategory)

  const canAfford = (price: number) => balance >= price

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
      
      <h1 className="page-title">Life Shop</h1>

      {/* Balance Display */}
      <div className="balance-display">
        <div className="balance-amount">{balance.toLocaleString()}</div>
        <div className="balance-label">Points Available</div>
      </div>

      {/* Category Filter */}
      <div className="card">
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`btn ${selectedCategory === category ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '14px', padding: '8px 16px' }}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Shop Items */}
      <div className="shop-grid">
        {filteredItems.map(item => {
          const achievedCount = itemAchievedCounts.get(item.id!) || 0
          return (
            <div key={item.id} className="shop-item">
              <div className="shop-item-info">
                <div className="shop-item-name">
                  {item.name}
                  {item.requiresReview && (
                    <AlertTriangle 
                      size={16} 
                      style={{ marginLeft: '8px', color: '#f59e0b', display: 'inline' }} 
                    />
                  )}
                </div>
                <div className="shop-item-category">{item.category}</div>
                {item.realCostEstimate && (
                  <div className="shop-item-cost">~{item.realCostEstimate}</div>
                )}
                {item.cooldownDays && (
                  <div className="shop-item-cost">Cooldown: {item.cooldownDays} days</div>
                )}
                {achievedCount > 0 && (
                  <div className="shop-item-achieved">
                    <Trophy size={12} />
                    Achieved{achievedCount > 1 ? ` x${achievedCount}` : ''}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div className="shop-item-price">
                  {item.pricePoints.toLocaleString()}
                </div>
                <button
                  onClick={() => handlePurchase(item)}
                  disabled={!canAfford(item.pricePoints)}
                  className={`btn ${canAfford(item.pricePoints) ? 'btn-success' : 'btn-secondary'}`}
                  style={{ 
                    marginTop: '8px', 
                    fontSize: '14px', 
                    padding: '6px 12px',
                    opacity: canAfford(item.pricePoints) ? 1 : 0.5
                  }}
                >
                  <ShoppingCart size={14} className="btn-icon" />
                  {canAfford(item.pricePoints) ? 'Buy' : 'Need More'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="card text-center">
          <div className="text-sm" style={{ color: '#9ca3af' }}>
            No items found in this category.
          </div>
        </div>
      )}

      {/* Purchase History */}
      {recentRedemptions.length > 0 && (
        <div className="card mt-4">
          <div className="card-title">Recent Purchases</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentRedemptions.slice(0, 5).map(redemption => {
              const item = shopItems.find(i => i.id === redemption.shopItemId)
              return (
                <div key={redemption.id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid #374151'
                }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{item?.name || 'Unknown Item'}</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                      {new Date(redemption.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ color: '#dc2626', fontWeight: 600 }}>
                    -{redemption.pricePoints.toLocaleString()}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}