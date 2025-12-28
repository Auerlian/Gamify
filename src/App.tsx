import { useState, useEffect } from 'react'
import { Timer, List, ShoppingBag, BarChart3, Settings } from 'lucide-react'
import { db } from './database'
import TodayTab from './components/TodayTab'
import LogTab from './components/LogTab'
import ShopTab from './components/ShopTab'
import ProgressTab from './components/ProgressTab'
import SettingsTab from './components/SettingsTab'

type Tab = 'today' | 'log' | 'shop' | 'progress' | 'settings'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('today')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Initialize database
    db.open().then(async () => {
      console.log('Database opened successfully')
      
      // Check if we have data
      const domainCount = await db.domains.count()
      const shopItemCount = await db.shopItems.count()
      
      console.log(`Found ${domainCount} domains and ${shopItemCount} shop items`)
      
      // If no data, force populate
      if (domainCount === 0 || shopItemCount === 0) {
        console.log('No data found, populating defaults...')
        await db.delete()
        await db.open()
      }
      
      setIsLoading(false)
    }).catch(error => {
      console.error('Failed to open database:', error)
      setIsLoading(false)
    })
  }, [])

  if (isLoading) {
    return (
      <div className="app">
        <div className="loading">
          <div>Loading Life Motivator...</div>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'today' as Tab, icon: Timer, label: 'Today' },
    { id: 'log' as Tab, icon: List, label: 'Log' },
    { id: 'shop' as Tab, icon: ShoppingBag, label: 'Shop' },
    { id: 'progress' as Tab, icon: BarChart3, label: 'Progress' },
    { id: 'settings' as Tab, icon: Settings, label: 'Settings' },
  ]

  return (
    <div className="app">
      <main className="app-main">
        {activeTab === 'today' && <TodayTab />}
        {activeTab === 'log' && <LogTab />}
        {activeTab === 'shop' && <ShopTab />}
        {activeTab === 'progress' && <ProgressTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>

      <nav className="app-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
          >
            <div className="nav-tab-icon">
              <tab.icon size={20} />
            </div>
            <div>{tab.label}</div>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default App