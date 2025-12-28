import { useState, useEffect } from 'react'
import { Download, Upload, Trash2, Plus, Settings, AlertTriangle, FileJson } from 'lucide-react'
import { db } from '../database'
import { Domain, DEFAULT_BONUSES, PersonalConfig } from '../types'

export default function SettingsTab() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [showBonusForm, setShowBonusForm] = useState(false)
  const [bonusTitle, setBonusTitle] = useState('')
  const [bonusPoints, setBonusPoints] = useState('')
  const [bonusNotes, setBonusNotes] = useState('')
  const [debugInfo, setDebugInfo] = useState<string>('')
  const [configImported, setConfigImported] = useState(false)

  useEffect(() => {
    loadDomains()
    loadDebugInfo()
    setConfigImported(db.hasPersonalConfig())
  }, [])

  const loadDebugInfo = async () => {
    try {
      const [domainCount, activityCount, shopItemCount, sessionCount] = await Promise.all([
        db.domains.count(),
        db.activities.count(),
        db.shopItems.count(),
        db.sessions.count()
      ])
      
      setDebugInfo(`Domains: ${domainCount}, Activities: ${activityCount}, Shop Items: ${shopItemCount}, Sessions: ${sessionCount}`)
    } catch (error) {
      setDebugInfo(`Error loading debug info: ${error}`)
    }
  }

  const loadDomains = async () => {
    const domainsData = await db.domains.toArray()
    setDomains(domainsData)
  }

  // Import personal config
  const importPersonalConfig = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const config: PersonalConfig = JSON.parse(text)
        
        if (!config.version || !config.domains || !config.shopItems) {
          throw new Error('Invalid config file format')
        }
        
        if (!confirm(`This will replace your current domains and shop items with:\n• ${config.domains.length} domains\n• ${config.shopItems.length} shop items\n\nYour session history will be preserved. Continue?`)) {
          return
        }
        
        const result = await db.importPersonalConfig(config)
        
        if (result.success) {
          alert(result.message)
          window.location.reload()
        } else {
          alert(result.message)
        }
      } catch (error) {
        console.error('Config import failed:', error)
        alert(`Import failed: ${error}`)
      }
    }
    input.click()
  }

  // Export full data backup
  const exportData = async () => {
    try {
      const [domains, activities, sessions, bonuses, shopItems, redemptions, ledger] = await Promise.all([
        db.domains.toArray(),
        db.activities.toArray(),
        db.sessions.toArray(),
        db.bonuses.toArray(),
        db.shopItems.toArray(),
        db.redemptions.toArray(),
        db.ledger.toArray()
      ])

      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        data: {
          domains,
          activities,
          sessions,
          bonuses,
          shopItems,
          redemptions,
          ledger
        }
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `life-motivator-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)

      alert('Data exported successfully!')
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please try again.')
    }
  }

  // Import full data backup
  const importData = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const importData = JSON.parse(text)

        if (!importData.data || !importData.version) {
          throw new Error('Invalid backup file format')
        }

        if (!confirm('This will replace ALL your current data. Are you sure?')) {
          return
        }

        // Clear existing data
        await Promise.all([
          db.domains.clear(),
          db.activities.clear(),
          db.sessions.clear(),
          db.bonuses.clear(),
          db.shopItems.clear(),
          db.redemptions.clear(),
          db.ledger.clear()
        ])

        // Import new data
        const { data } = importData
        await Promise.all([
          db.domains.bulkAdd(data.domains || []),
          db.activities.bulkAdd(data.activities || []),
          db.sessions.bulkAdd(data.sessions || []),
          db.bonuses.bulkAdd(data.bonuses || []),
          db.shopItems.bulkAdd(data.shopItems || []),
          db.redemptions.bulkAdd(data.redemptions || []),
          db.ledger.bulkAdd(data.ledger || [])
        ])

        localStorage.setItem('lifeMotivatorConfigImported', 'true')
        alert('Data imported successfully!')
        window.location.reload()
      } catch (error) {
        console.error('Import failed:', error)
        alert('Import failed. Please check the file format and try again.')
      }
    }
    input.click()
  }

  const resetAllData = async () => {
    if (!confirm('⚠️ This will DELETE ALL your data permanently. Type "RESET" to confirm.')) {
      return
    }

    const confirmation = prompt('Type "RESET" to confirm deletion:')
    if (confirmation !== 'RESET') {
      alert('Reset cancelled.')
      return
    }

    try {
      await db.delete()
      localStorage.removeItem('lifeMotivatorConfigImported')
      localStorage.removeItem('lifeMotivatorConfigVersion')
      alert('All data has been reset. The app will now reload.')
      window.location.reload()
    } catch (error) {
      console.error('Reset failed:', error)
      alert('Reset failed. Please try again.')
    }
  }

  const addBonus = async () => {
    if (!bonusTitle.trim() || !bonusPoints.trim()) {
      alert('Please fill in title and points')
      return
    }

    const points = parseInt(bonusPoints)
    if (isNaN(points) || points <= 0) {
      alert('Please enter a valid positive number for points')
      return
    }

    try {
      const timestamp = Date.now()
      
      const bonusId = await db.bonuses.add({
        timestamp,
        title: bonusTitle.trim(),
        points,
        notes: bonusNotes.trim() || undefined
      })

      await db.ledger.add({
        timestamp,
        type: 'earn_bonus',
        pointsDelta: points,
        referenceId: bonusId,
        description: `Bonus: ${bonusTitle.trim()}`
      })

      setBonusTitle('')
      setBonusPoints('')
      setBonusNotes('')
      setShowBonusForm(false)

      alert(`Bonus added! Earned ${points.toLocaleString()} points.`)
    } catch (error) {
      console.error('Failed to add bonus:', error)
      alert('Failed to add bonus. Please try again.')
    }
  }

  const toggleDomain = async (domainId: number, isActive: boolean) => {
    try {
      await db.domains.update(domainId, { isActive })
      loadDomains()
    } catch (error) {
      console.error('Failed to update domain:', error)
    }
  }

  return (
    <div className="page fade-in">
      <h1 className="page-title">Settings</h1>

      {/* Personal Config Import */}
      <div className="card" style={{ borderColor: configImported ? '#059669' : '#f59e0b' }}>
        <div className="card-title flex items-center gap-2">
          <FileJson size={20} />
          Personal Configuration
        </div>
        <div className="text-sm mb-4" style={{ color: '#9ca3af' }}>
          {configImported 
            ? '✅ Personal config imported. Your custom domains and shop items are active.'
            : '⚠️ Using placeholder data. Import your personal config to customize.'}
        </div>
        <div className="flex flex-col gap-3">
          <button onClick={importPersonalConfig} className="btn btn-primary">
            <Upload className="btn-icon" size={16} />
            Import Personal Config
          </button>
          <a 
            href="/sample-config.json" 
            download="sample-config.json"
            className="btn btn-secondary"
            style={{ textDecoration: 'none' }}
          >
            <Download className="btn-icon" size={16} />
            Download Sample Config
          </a>
        </div>
      </div>

      {/* Quick Bonus */}
      <div className="card">
        <div className="card-title flex items-center gap-2">
          <Plus size={20} />
          Add Milestone Bonus
        </div>
        
        {!showBonusForm ? (
          <>
            <div className="text-sm mb-4" style={{ color: '#9ca3af' }}>
              Earned a major milestone? Add a bonus to celebrate your achievement!
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '16px' }}>
              {DEFAULT_BONUSES.map((bonus, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setBonusTitle(bonus.title)
                    setBonusPoints(bonus.points.toString())
                    setShowBonusForm(true)
                  }}
                  className="btn btn-secondary text-sm"
                  style={{ padding: '8px 12px', fontSize: '12px' }}
                >
                  {bonus.title} (+{bonus.points.toLocaleString()})
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowBonusForm(true)}
              className="btn btn-primary"
            >
              <Plus className="btn-icon" size={16} />
              Custom Bonus
            </button>
          </>
        ) : (
          <div>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input
                type="text"
                className="form-input"
                value={bonusTitle}
                onChange={(e) => setBonusTitle(e.target.value)}
                placeholder="e.g., First £1k month"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Points</label>
              <input
                type="number"
                className="form-input"
                value={bonusPoints}
                onChange={(e) => setBonusPoints(e.target.value)}
                placeholder="e.g., 50000"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Notes (Optional)</label>
              <textarea
                className="form-input form-textarea"
                value={bonusNotes}
                onChange={(e) => setBonusNotes(e.target.value)}
                placeholder="Additional details..."
              />
            </div>
            <div className="flex gap-2">
              <button onClick={addBonus} className="btn btn-success flex-1">
                Add Bonus
              </button>
              <button 
                onClick={() => setShowBonusForm(false)} 
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Domain Management */}
      <div className="card">
        <div className="card-title flex items-center gap-2">
          <Settings size={20} />
          Manage Domains
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {domains.map(domain => (
            <div key={domain.id} className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{domain.name}</div>
                <div className="text-sm" style={{ color: '#9ca3af' }}>
                  Level {domain.level} • {domain.baseRate} pts/hr • {domain.multiplier}x
                </div>
              </div>
              <button
                onClick={() => toggleDomain(domain.id!, !domain.isActive)}
                className={`btn ${domain.isActive ? 'btn-success' : 'btn-secondary'}`}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                {domain.isActive ? 'Active' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Data Management */}
      <div className="card">
        <div className="card-title flex items-center gap-2">
          <Download size={20} />
          Data Backup
        </div>
        <div className="text-sm mb-4" style={{ color: '#9ca3af' }}>
          Export your complete data (sessions, points, progress) for backup, or import from a previous backup.
        </div>
        <div className="flex flex-col gap-3">
          <button onClick={exportData} className="btn btn-primary">
            <Download className="btn-icon" size={16} />
            Export Full Backup
          </button>
          <button onClick={importData} className="btn btn-secondary">
            <Upload className="btn-icon" size={16} />
            Import Full Backup
          </button>
        </div>
      </div>

      {/* Debug Info */}
      <div className="card">
        <div className="card-title">Debug Information</div>
        <div className="text-sm mb-4" style={{ color: '#9ca3af' }}>
          Database status: {debugInfo}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card" style={{ borderColor: '#dc2626' }}>
        <div className="card-title flex items-center gap-2" style={{ color: '#dc2626' }}>
          <AlertTriangle size={20} />
          Danger Zone
        </div>
        <div className="text-sm mb-4" style={{ color: '#9ca3af' }}>
          Permanently delete all your data and start fresh. This cannot be undone.
        </div>
        <button onClick={resetAllData} className="btn btn-danger">
          <Trash2 className="btn-icon" size={16} />
          Reset All Data
        </button>
      </div>

      {/* App Info */}
      <div className="card">
        <div className="card-title">About</div>
        <div className="text-sm" style={{ color: '#9ca3af', lineHeight: '1.6' }}>
          <p><strong>Life Motivator v1.0</strong></p>
          <p>Turn your life into an RPG economy. Earn points through productive work, level up your domains, and spend points on real-world rewards.</p>
          <p className="mt-4">
            <strong>Privacy:</strong> All data is stored locally on your device. Nothing is sent to external servers.
          </p>
          <p className="mt-2">
            <strong>Note:</strong> Points are motivational tools, not financial advice. Always make responsible decisions about real purchases.
          </p>
        </div>
      </div>
    </div>
  )
}