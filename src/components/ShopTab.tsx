import { useState, useEffect } from 'react'
import { ShoppingCart, AlertTriangle } from 'lucide-react'
import { db, getCurrentBalance } from '../database'
import { ShopItem, Redemption } from '../types'

export default function ShopTab() {
  const [shopItems, setShopItems] = useState<ShopItem[]>([])
  const [balance, setBalance] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [loading, setLoading] = useState(true)
  const [recentRedemptions, setRecentRedemptions] = useState<Redemption[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      console.log('Loading shop data...')
      
      const [itemsData, balanceData, redemptionsData] = await Promise.all([
        db.shopItems.toArray().then(items => {
          console.log('All shop items:', items)
          const activeItems = items.filter(i => i.isActive)
          console.log('Active shop items:', activeItems)
          return activeItems
        }),
        getCurrentBalance(),
        db.redemptions.orderBy('timestamp').reverse().limit(10).toArray()
      ])

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

      // Success message
      const successMessage = item.requiresReview
        ? `Purchase authorized! Remember to review this decision before taking action.`
        : `Purchase complete! Enjoy your ${item.name}!`
      
      alert(successMessage)

    } catch (error) {
      console.error('Failed to process purchase:', error)
      alert('Purchase failed. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="loading">Loading shop...</div>
      </div>
    )
  }

  return (
    <div className="page fade-in">
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
        {filteredItems.map(item => (
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
        ))}
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