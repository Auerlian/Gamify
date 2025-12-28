import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { db, calculateSessionPoints, getLevelAndMultiplier } from '../database'
import { Session, Domain, Activity } from '../types'

export default function LogTab() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [showManualForm, setShowManualForm] = useState(false)
  const [manualSession, setManualSession] = useState({
    domainId: '',
    activityId: '',
    durationMinutes: '',
    notes: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [sessionsData, domainsData, activitiesData] = await Promise.all([
        db.sessions.orderBy('startTime').reverse().limit(50).toArray(),
        db.domains.toArray(),
        db.activities.toArray()
      ])

      setSessions(sessionsData)
      setDomains(domainsData)
      setActivities(activitiesData)
    } catch (error) {
      console.error('Failed to load log data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDomainName = (domainId: number): string => {
    return domains.find(d => d.id === domainId)?.name || 'Unknown Domain'
  }

  const getActivityName = (activityId?: number): string => {
    if (!activityId) return ''
    return activities.find(a => a.id === activityId)?.name || 'Unknown Activity'
  }

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const addManualSession = async () => {
    if (!manualSession.domainId || !manualSession.durationMinutes) {
      alert('Please select a domain and enter duration')
      return
    }

    const durationMinutes = parseInt(manualSession.durationMinutes)
    if (isNaN(durationMinutes) || durationMinutes <= 0) {
      alert('Please enter a valid duration in minutes')
      return
    }

    try {
      const domain = await db.domains.get(parseInt(manualSession.domainId))
      if (!domain) {
        alert('Domain not found')
        return
      }

      // Calculate points
      const points = calculateSessionPoints(durationMinutes, domain.baseRate, domain.multiplier)
      
      // Create session
      const now = Date.now()
      const sessionId = await db.sessions.add({
        startTime: now - (durationMinutes * 60 * 1000),
        endTime: now,
        durationMinutes,
        domainId: parseInt(manualSession.domainId),
        activityId: manualSession.activityId ? parseInt(manualSession.activityId) : undefined,
        pointsAwarded: points,
        notes: manualSession.notes || undefined,
        source: 'manual',
        reviewFlag: true // Manual sessions need review
      })

      // Update domain lifetime
      const newLifetimeMinutes = domain.lifetimeMinutes + durationMinutes
      const { level, multiplier } = getLevelAndMultiplier(newLifetimeMinutes)
      
      await db.domains.update(parseInt(manualSession.domainId), {
        lifetimeMinutes: newLifetimeMinutes,
        level,
        multiplier
      })

      // Add to ledger
      await db.ledger.add({
        timestamp: now,
        type: 'earn_session',
        pointsDelta: points,
        referenceId: sessionId,
        description: `Manual Session: ${domain.name}`
      })

      // Reset form
      setManualSession({
        domainId: '',
        activityId: '',
        durationMinutes: '',
        notes: ''
      })
      setShowManualForm(false)
      
      // Reload data
      loadData()
      
      alert(`Manual session added! Earned ${points.toLocaleString()} points.`)
    } catch (error) {
      console.error('Failed to add manual session:', error)
      alert('Failed to add session. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="loading">Loading sessions...</div>
      </div>
    )
  }

  return (
    <div className="page fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title mb-0">Session Log</h1>
        <button 
          className="btn btn-secondary"
          onClick={() => setShowManualForm(!showManualForm)}
        >
          <Plus className="btn-icon" size={16} />
          Add Manual
        </button>
      </div>

      {/* Manual Session Form */}
      {showManualForm && (
        <div className="card mb-6">
          <div className="card-title">Add Manual Session</div>
          <div className="form-group">
            <label className="form-label">Domain</label>
            <select
              className="form-input"
              value={manualSession.domainId}
              onChange={(e) => setManualSession(prev => ({ ...prev, domainId: e.target.value, activityId: '' }))}
            >
              <option value="">Select Domain</option>
              {domains.map(domain => (
                <option key={domain.id} value={domain.id}>
                  {domain.name} (Lv {domain.level}, {domain.multiplier}x)
                </option>
              ))}
            </select>
          </div>
          
          {manualSession.domainId && (
            <div className="form-group">
              <label className="form-label">Activity (Optional)</label>
              <select
                className="form-input"
                value={manualSession.activityId}
                onChange={(e) => setManualSession(prev => ({ ...prev, activityId: e.target.value }))}
              >
                <option value="">Select Activity</option>
                {activities
                  .filter(a => a.domainId === parseInt(manualSession.domainId))
                  .map(activity => (
                    <option key={activity.id} value={activity.id}>
                      {activity.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
          
          <div className="form-group">
            <label className="form-label">Duration (minutes)</label>
            <input
              type="number"
              className="form-input"
              value={manualSession.durationMinutes}
              onChange={(e) => setManualSession(prev => ({ ...prev, durationMinutes: e.target.value }))}
              placeholder="e.g., 60"
              min="1"
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Notes (Optional)</label>
            <textarea
              className="form-input form-textarea"
              value={manualSession.notes}
              onChange={(e) => setManualSession(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional details..."
            />
          </div>
          
          <div className="flex gap-2">
            <button onClick={addManualSession} className="btn btn-primary flex-1">
              Add Session
            </button>
            <button 
              onClick={() => setShowManualForm(false)} 
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="card text-center">
          <div className="text-sm" style={{ color: '#9ca3af' }}>
            No sessions recorded yet. Start your first session in the Today tab!
          </div>
        </div>
      ) : (
        <div className="session-list">
          {sessions.map(session => (
            <div key={session.id} className="session-item">
              <div className="session-header">
                <div className="session-domain">
                  {getDomainName(session.domainId)}
                  {session.activityId && (
                    <span style={{ color: '#9ca3af', fontSize: '14px', marginLeft: '8px' }}>
                      • {getActivityName(session.activityId)}
                    </span>
                  )}
                </div>
                <div className="session-points">
                  +{session.pointsAwarded.toLocaleString()}
                </div>
              </div>
              <div className="session-meta">
                {formatDate(session.startTime)} • {formatDuration(session.durationMinutes)}
                {session.source === 'manual' && (
                  <span style={{ marginLeft: '8px', color: '#f59e0b' }}>• Manual</span>
                )}
                {session.reviewFlag && (
                  <span style={{ marginLeft: '8px', color: '#dc2626' }}>• Needs Review</span>
                )}
              </div>
              {session.notes && (
                <div style={{ marginTop: '8px', fontSize: '14px', color: '#d1d5db' }}>
                  {session.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}