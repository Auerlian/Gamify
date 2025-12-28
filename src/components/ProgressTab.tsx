import { useState, useEffect } from 'react'
import { Award, Target } from 'lucide-react'
import { db } from '../database'
import { Domain, LEVEL_THRESHOLDS } from '../types'

export default function ProgressTab() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const domainsData = await db.domains.toArray().then(domains => domains.filter(d => d.isActive))
      setDomains(domainsData)
    } catch (error) {
      console.error('Failed to load progress data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getProgressToNextLevel = (domain: Domain): { current: number; next: number; percentage: number } => {
    const currentHours = domain.lifetimeMinutes / 60
    const currentThreshold = LEVEL_THRESHOLDS[domain.level - 1] || 0
    const nextThreshold = LEVEL_THRESHOLDS[domain.level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
    
    if (domain.level >= LEVEL_THRESHOLDS.length) {
      return { current: currentHours, next: nextThreshold, percentage: 100 }
    }
    
    const progressInLevel = currentHours - currentThreshold
    const levelRange = nextThreshold - currentThreshold
    const percentage = Math.min((progressInLevel / levelRange) * 100, 100)
    
    return { current: currentHours, next: nextThreshold, percentage }
  }

  const getTotalStats = () => {
    const totalHours = domains.reduce((sum, d) => sum + d.lifetimeMinutes / 60, 0)
    const totalLevels = domains.reduce((sum, d) => sum + d.level, 0)
    const avgMultiplier = domains.reduce((sum, d) => sum + d.multiplier, 0) / domains.length
    
    return { totalHours, totalLevels, avgMultiplier }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="loading">Loading progress...</div>
      </div>
    )
  }

  const stats = getTotalStats()

  return (
    <div className="page fade-in">
      <h1 className="page-title">Progress</h1>

      {/* Overall Stats */}
      <div className="stats-grid mb-6">
        <div className="stat-card">
          <div className="stat-value">{Math.floor(stats.totalHours)}</div>
          <div className="stat-label">Total Hours</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalLevels}</div>
          <div className="stat-label">Total Levels</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.avgMultiplier.toFixed(1)}x</div>
          <div className="stat-label">Avg Multiplier</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{domains.length}</div>
          <div className="stat-label">Active Domains</div>
        </div>
      </div>

      {/* Domain Progress */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {domains.map(domain => {
          const progress = getProgressToNextLevel(domain)
          const isMaxLevel = domain.level >= LEVEL_THRESHOLDS.length
          
          return (
            <div key={domain.id} className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-semibold text-lg">{domain.name}</div>
                  <div className="text-sm" style={{ color: '#9ca3af' }}>
                    {Math.floor(domain.lifetimeMinutes / 60)}h {domain.lifetimeMinutes % 60}m total
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 mb-1">
                    <Award size={16} style={{ color: '#f59e0b' }} />
                    <span className="font-bold">Level {domain.level}</span>
                  </div>
                  <div className="text-sm" style={{ color: '#9ca3af' }}>
                    {domain.multiplier}x multiplier
                  </div>
                </div>
              </div>

              {!isMaxLevel ? (
                <>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm mt-2" style={{ color: '#9ca3af' }}>
                    <span>{Math.floor(progress.current)}h / {progress.next}h</span>
                    <span>{Math.floor(progress.percentage)}%</span>
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#6b7280' }}>
                    {Math.floor(progress.next - progress.current)} hours to Level {domain.level + 1}
                  </div>
                </>
              ) : (
                <div className="text-center" style={{ color: '#10b981', fontWeight: 600 }}>
                  🏆 MAX LEVEL ACHIEVED! 🏆
                </div>
              )}

              {/* Domain Stats */}
              <div className="flex justify-between mt-4 pt-4" style={{ borderTop: '1px solid #374151' }}>
                <div className="text-center">
                  <div className="font-semibold">{domain.baseRate}</div>
                  <div className="text-xs" style={{ color: '#9ca3af' }}>Base Rate</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold">{Math.floor((domain.dailySoftCapMinutes || 360) / 60)}h</div>
                  <div className="text-xs" style={{ color: '#9ca3af' }}>Soft Cap</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold">{Math.floor(domain.lifetimeMinutes / 60 / 24)}</div>
                  <div className="text-xs" style={{ color: '#9ca3af' }}>Days Equiv</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {domains.length === 0 && (
        <div className="card text-center">
          <div className="text-sm" style={{ color: '#9ca3af' }}>
            No active domains found. Check your settings to enable domains.
          </div>
        </div>
      )}

      {/* Level Thresholds Reference */}
      <div className="card mt-6">
        <div className="card-title flex items-center gap-2">
          <Target size={20} />
          Level Thresholds
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '14px' }}>
          {LEVEL_THRESHOLDS.map((threshold, index) => (
            <div key={index} className="flex justify-between" style={{ color: '#d1d5db' }}>
              <span>Level {index + 1}:</span>
              <span>{threshold}h</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}