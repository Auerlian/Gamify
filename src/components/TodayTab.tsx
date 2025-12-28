import { useState, useEffect } from 'react'
import { Play, Square } from 'lucide-react'
import { db, getTodaysSessions, getCurrentBalance, calculateSessionPoints, getDomainMinutesToday, getTotalMinutesToday, getLevelAndMultiplier } from '../database'
import { Domain, Activity, DAILY_HARD_CAP_MINUTES } from '../types'

interface TimerState {
  isRunning: boolean
  startTime: number | null
  elapsed: number
  selectedDomainId: number | null
  selectedActivityId: number | null
}

export default function TodayTab() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [timer, setTimer] = useState<TimerState>({
    isRunning: false,
    startTime: null,
    elapsed: 0,
    selectedDomainId: null,
    selectedActivityId: null
  })
  const [todayStats, setTodayStats] = useState({ sessions: 0, points: 0, minutes: 0 })
  const [balance, setBalance] = useState(0)

  // Load data on mount
  useEffect(() => {
    loadData()
    loadTimerState()
  }, [])

  // Timer tick
  useEffect(() => {
    let interval: number
    if (timer.isRunning && timer.startTime) {
      interval = window.setInterval(() => {
        setTimer(prev => ({
          ...prev,
          elapsed: Math.floor((Date.now() - prev.startTime!) / 1000)
        }))
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [timer.isRunning, timer.startTime])

  // Load activities when domain changes
  useEffect(() => {
    if (timer.selectedDomainId) {
      loadActivitiesForDomain(timer.selectedDomainId)
    }
  }, [timer.selectedDomainId])

  const loadData = async () => {
    try {
      console.log('Loading data for TodayTab...')
      
      const [domainsData, sessionsData, balanceData] = await Promise.all([
        db.domains.toArray().then(domains => {
          console.log('All domains:', domains)
          const activeDomains = domains.filter(d => d.isActive)
          console.log('Active domains:', activeDomains)
          return activeDomains
        }),
        getTodaysSessions(),
        getCurrentBalance()
      ])

      setDomains(domainsData)
      setBalance(balanceData)
      
      const todayPoints = sessionsData.reduce((sum, s) => sum + s.pointsAwarded, 0)
      const todayMinutes = sessionsData.reduce((sum, s) => sum + s.durationMinutes, 0)
      
      setTodayStats({
        sessions: sessionsData.length,
        points: todayPoints,
        minutes: todayMinutes
      })
      
      console.log('TodayTab data loaded:', { domains: domainsData.length, balance: balanceData })
    } catch (error) {
      console.error('Failed to load TodayTab data:', error)
    }
  }

  const loadActivitiesForDomain = async (domainId: number) => {
    const activitiesData = await db.activities
      .where('domainId').equals(domainId)
      .toArray()
      .then(activities => activities.filter(a => a.isActive))
    setActivities(activitiesData)
  }

  const loadTimerState = () => {
    const saved = localStorage.getItem('lifeMotivatorTimer')
    if (saved) {
      try {
        const state = JSON.parse(saved)
        if (state.isRunning && state.startTime) {
          setTimer({
            ...state,
            elapsed: Math.floor((Date.now() - state.startTime) / 1000)
          })
        }
      } catch (e) {
        console.error('Failed to load timer state:', e)
      }
    }
  }

  const saveTimerState = (state: TimerState) => {
    localStorage.setItem('lifeMotivatorTimer', JSON.stringify(state))
  }

  const startTimer = () => {
    if (!timer.selectedDomainId) {
      alert('Please select a domain first')
      return
    }

    const now = Date.now()
    const newState = {
      ...timer,
      isRunning: true,
      startTime: now,
      elapsed: 0
    }
    
    setTimer(newState)
    saveTimerState(newState)
  }

  const stopTimer = async () => {
    if (!timer.isRunning || !timer.startTime || !timer.selectedDomainId) return

    const endTime = Date.now()
    const durationMinutes = Math.floor((endTime - timer.startTime) / 1000 / 60)
    
    if (durationMinutes < 1) {
      alert('Session too short (minimum 1 minute)')
      return
    }

    try {
      // Get domain info
      const domain = await db.domains.get(timer.selectedDomainId)
      if (!domain) return

      // Check daily caps
      const totalMinutesToday = await getTotalMinutesToday()
      const domainMinutesToday = await getDomainMinutesToday(timer.selectedDomainId)
      
      if (totalMinutesToday + durationMinutes > DAILY_HARD_CAP_MINUTES) {
        alert(`Daily hard cap reached (${DAILY_HARD_CAP_MINUTES / 60} hours). Session not recorded.`)
        return
      }

      // Check if soft cap penalty applies
      const softCapMinutes = domain.dailySoftCapMinutes || 360
      const applySoftCapPenalty = domainMinutesToday >= softCapMinutes

      // Calculate points
      const points = calculateSessionPoints(
        durationMinutes,
        domain.baseRate,
        domain.multiplier,
        applySoftCapPenalty
      )

      // Save session
      const sessionId = await db.sessions.add({
        startTime: timer.startTime,
        endTime,
        durationMinutes,
        domainId: timer.selectedDomainId,
        activityId: timer.selectedActivityId || undefined,
        pointsAwarded: points,
        source: 'timer',
        reviewFlag: false
      })

      // Update domain lifetime
      const newLifetimeMinutes = domain.lifetimeMinutes + durationMinutes
      const { level, multiplier } = getLevelAndMultiplier(newLifetimeMinutes)
      
      await db.domains.update(timer.selectedDomainId, {
        lifetimeMinutes: newLifetimeMinutes,
        level,
        multiplier
      })

      // Add to ledger
      await db.ledger.add({
        timestamp: endTime,
        type: 'earn_session',
        pointsDelta: points,
        referenceId: sessionId,
        description: `Session: ${domain.name}${timer.selectedActivityId ? ` - ${activities.find(a => a.id === timer.selectedActivityId)?.name}` : ''}`
      })

      // Reset timer
      const resetState = {
        isRunning: false,
        startTime: null,
        elapsed: 0,
        selectedDomainId: timer.selectedDomainId, // Keep domain selected
        selectedActivityId: timer.selectedActivityId // Keep activity selected
      }
      
      setTimer(resetState)
      saveTimerState(resetState)
      
      // Reload data
      await loadData()
      
      // Show success message
      alert(`Session complete! Earned ${points.toLocaleString()} points${applySoftCapPenalty ? ' (soft cap penalty applied)' : ''}`)
      
    } catch (error) {
      console.error('Failed to save session:', error)
      alert('Failed to save session. Please try again.')
    }
  }

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const selectedDomain = domains.find(d => d.id === timer.selectedDomainId)
  const selectedActivity = activities.find(a => a.id === timer.selectedActivityId)

  return (
    <div className="page fade-in">
      <h1 className="page-title">Today</h1>

      {/* Balance Display */}
      <div className="balance-display">
        <div className="balance-amount">{balance.toLocaleString()}</div>
        <div className="balance-label">Points Available</div>
      </div>

      {/* Today's Stats */}
      <div className="stats-grid mb-6">
        <div className="stat-card">
          <div className="stat-value">{todayStats.sessions}</div>
          <div className="stat-label">Sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{Math.floor(todayStats.minutes / 60)}h {todayStats.minutes % 60}m</div>
          <div className="stat-label">Time</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{todayStats.points.toLocaleString()}</div>
          <div className="stat-label">Points Earned</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{Math.floor((DAILY_HARD_CAP_MINUTES - todayStats.minutes) / 60)}h</div>
          <div className="stat-label">Remaining</div>
        </div>
      </div>

      {/* Timer Display */}
      <div className="timer-display">
        <div className="timer-time">{formatTime(timer.elapsed)}</div>
        {selectedDomain && (
          <div className="timer-domain">{selectedDomain.name}</div>
        )}
        {selectedActivity && (
          <div className="timer-activity">{selectedActivity.name}</div>
        )}
      </div>

      {!timer.isRunning ? (
        <>
          {/* Domain Selection */}
          <div className="card">
            <div className="card-title">Select Domain</div>
            <div className="selector-grid">
              {domains.map(domain => (
                <button
                  key={domain.id}
                  onClick={() => setTimer(prev => ({ ...prev, selectedDomainId: domain.id!, selectedActivityId: null }))}
                  className={`selector-item ${timer.selectedDomainId === domain.id ? 'selected' : ''}`}
                >
                  <div className="selector-item-name">{domain.name}</div>
                  <div className="selector-item-meta">
                    Lv {domain.level} • {domain.multiplier}x
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Activity Selection */}
          {timer.selectedDomainId && activities.length > 0 && (
            <div className="card">
              <div className="card-title">Select Activity (Optional)</div>
              <div className="selector-grid">
                {activities.map(activity => (
                  <button
                    key={activity.id}
                    onClick={() => setTimer(prev => ({ ...prev, selectedActivityId: activity.id! }))}
                    className={`selector-item ${timer.selectedActivityId === activity.id ? 'selected' : ''}`}
                  >
                    <div className="selector-item-name">{activity.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Start Button */}
          <button
            onClick={startTimer}
            disabled={!timer.selectedDomainId}
            className="btn btn-primary btn-large"
          >
            <Play className="btn-icon" size={20} fill="currentColor" />
            Start Session
          </button>
        </>
      ) : (
        /* Stop Button */
        <button
          onClick={stopTimer}
          className="btn btn-danger btn-large"
        >
          <Square className="btn-icon" size={20} fill="currentColor" />
          Stop Session
        </button>
      )}
    </div>
  )
}