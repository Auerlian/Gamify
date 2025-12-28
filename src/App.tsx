import { useState, useEffect } from 'react'
import { Timer, List, ShoppingBag, BarChart3, Settings, Upload } from 'lucide-react'
import { db } from './database'
import { PersonalConfig } from './types'
import TodayTab from './components/TodayTab'
import LogTab from './components/LogTab'
import ShopTab from './components/ShopTab'
import ProgressTab from './components/ProgressTab'
import SettingsTab from './components/SettingsTab'

type Tab = 'today' | 'log' | 'shop' | 'progress' | 'settings'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('today')
  const [isLoading, setIsLoading] = useState(true)
  const [showConfigPrompt, setShowConfigPrompt] = useState(false)
  const [configStatus, setConfigStatus] = useState<string>('')

  useEffect(() => {
    initializeApp()
  }, [])

  const initializeApp = async () => {
    try {
      await db.open()
      console.log('Database opened successfully')
      
      // Check if personal config has been imported
      if (!db.hasPersonalConfig()) {
        setShowConfigPrompt(true)
      }
      
      setIsLoading(false)
    } catch (error) {
      console.error('Failed to open database:', error)
      setIsLoading(false)
    }
  }

  const handleConfigImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        setConfigStatus('Importing...')
        const text = await file.text()
        const config: PersonalConfig = JSON.parse(text)
        
        // Validate config structure
        if (!config.version || !config.domains || !config.shopItems) {
          throw new Error('Invalid config file format')
        }
        
        const result = await db.importPersonalConfig(config)
        
        if (result.success) {
          setConfigStatus(result.message)
          setShowConfigPrompt(false)
          // Reload the app to show new data
          window.location.reload()
        } else {
          setConfigStatus(result.message)
        }
      } catch (error) {
        console.error('Config import failed:', error)
        setConfigStatus(`Import failed: ${error}`)
      }
    }
    input.click()
  }

  const skipConfigImport = () => {
    localStorage.setItem('lifeMotivatorConfigImported', 'skipped')
    setShowConfigPrompt(false)
  }

  if (isLoading) {
    return (
      <div className="app">
        <div className="loading">
          <div>Loading Life Motivator...</div>
        </div>
      </div>
    )
  }

  // Show config import prompt
  if (showConfigPrompt) {
    return (
      <div className="app">
        <div className="page" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎮</div>
            <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Welcome to Life Motivator</h1>
            <p style={{ color: '#9ca3af', marginBottom: '24px', lineHeight: '1.6' }}>
              To personalize your experience, import your personal configuration file. 
              This contains your custom domains, activities, and shop items.
            </p>
            
            <button onClick={handleConfigImport} className="btn btn-primary btn-large" style={{ marginBottom: '12px' }}>
              <Upload size={20} style={{ marginRight: '8px' }} />
              Import Personal Config
            </button>
            
            <button onClick={skipConfigImport} className="btn btn-secondary" style={{ width: '100%' }}>
              Skip (Use Placeholder Data)
            </button>
            
            {configStatus && (
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#374151', borderRadius: '8px', fontSize: '14px' }}>
                {configStatus}
              </div>
            )}
            
            <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#1f2937', borderRadius: '8px', textAlign: 'left' }}>
              <div style={{ fontWeight: '600', marginBottom: '8px' }}>📁 Config File Format</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', fontFamily: 'monospace', marginBottom: '12px' }}>
                Your config file should be a JSON file with:<br/>
                • domains - Your work categories<br/>
                • activities - Tasks within each domain<br/>
                • shopItems - Your personal rewards<br/>
                • bonusMilestones - Achievement rewards
              </div>
              <a 
                href="/sample-config.json" 
                download="sample-config.json"
                className="btn btn-secondary"
                style={{ fontSize: '14px', textDecoration: 'none', display: 'inline-block' }}
              >
                Download Sample Config
              </a>
            </div>
          </div>
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