import { useState, useEffect } from 'react'
import { Play, Pause, Check, X } from 'lucide-react'
import { db, getTodaysSessions, getCurrentBalance, calculateSessionPoints, getDomainMinutesToday, getTotalMinutesToday, getLevelAndMultiplier } from '../database'
import { Domain, Activity, DAILY_HARD_CAP_MINUTES } from '../types'

type SessionState = 'idle' | 'running' | 'paused' | 'finished'

interface TimerState {
  sessionState: SessionState
  startTime: number | null
  pausedAt: number | null
  totalPausedTime: number
  elapsed: number
  selectedDomainId: number | null
  selectedActivityId: number | null
}

interface SessionResult {
  domain: string
  activity?: string
  duration: number
  points: number
  multiplier: number
  softCapApplied: boolean
}

export default function TodayTab() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [timer, setTimer] = useState<TimerState>({
    sessionState: 'idle',
    startTime: null,
    pausedAt: null,
    totalPausedTime: 0,
    elapsed: 0,
    selectedDomainId: null,
    selectedActivityId: null
  })
  const [todayStats, setTodayStats] = useState({ sessions: 0, points: 0, minutes: 0 })
  const [balance, setBalance] = useState(0)
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null)

  // Load data on mount
  useEffect(() => {
    loadData()
    loadTimerState()
  }, [])

  // Timer tick
  useEffect(() => {
    let interval: number
    if (timer.sessionState === 'running' && timer.startTime) {
      interval = window.setInterval(() => {
        setTimer(prev => ({
          ...prev,
          elapsed: Math.floor((Date.now() - prev.startTime! - prev.totalPausedTime) / 1000)
        }))
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [timer.sessionState, timer.startTime])

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
        if ((state.sessionState === 'running' || state.sessionState === 'paused') && state.startTime) {
          if (state.sessionState === 'running') {
            setTimer({
              ...state,
              elapsed: Math.floor((Date.now() - state.startTime - (state.totalPausedTime || 0)) / 1000)
            })
          } else {
            // Paused - keep elapsed as saved
            setTimer(state)
          }
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
    const newState: TimerState = {
      ...timer,
      sessionState: 'running',
      startTime: now,
      pausedAt: null,
      totalPausedTime: 0,
      elapsed: 0
    }
    
    setTimer(newState)
    saveTimerState(newState)
  }

  const pauseTimer = () => {
    const now = Date.now()
    const newState: TimerState = {
      ...timer,
      sessionState: 'paused',
      pausedAt: now
    }
    setTimer(newState)
    saveTimerState(newState)
  }

  const resumeTimer = () => {
    if (!timer.pausedAt) return
    
    const pauseDuration = Date.now() - timer.pausedAt
    const newState: TimerState = {
      ...timer,
      sessionState: 'running',
      pausedAt: null,
      totalPausedTime: timer.totalPausedTime + pauseDuration
    }
    setTimer(newState)
    saveTimerState(newState)
  }

  const finishTimer = async () => {
    if ((timer.sessionState !== 'running' && timer.sessionState !== 'paused') || !timer.startTime || !timer.selectedDomainId) return

    const endTime = Date.now()
    const totalPaused = timer.sessionState === 'paused' && timer.pausedAt 
      ? timer.totalPausedTime + (endTime - timer.pausedAt)
      : timer.totalPausedTime
    const durationMinutes = Math.floor((endTime - timer.startTime - totalPaused) / 1000 / 60)
    
    if (durationMinutes < 1) {
      alert('Session too short (minimum 1 minute)')
      return
    }

    try {
      const domain = await db.domains.get(timer.selectedDomainId)
      if (!domain) return

      const totalMinutesToday = await getTotalMinutesToday()
      const domainMinutesToday = await getDomainMinutesToday(timer.selectedDomainId)
      
      if (totalMinutesToday + durationMinutes > DAILY_HARD_CAP_MINUTES) {
        alert(`Daily hard cap reached (${DAILY_HARD_CAP_MINUTES / 60} hours). Session not recorded.`)
        return
      }

      const softCapMinutes = domain.dailySoftCapMinutes || 360
      const applySoftCapPenalty = domainMinutesToday >= softCapMinutes

      const points = calculateSessionPoints(
        durationMinutes,
        domain.baseRate,
        domain.multiplier,
        applySoftCapPenalty
      )

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

      const newLifetimeMinutes = domain.lifetimeMinutes + durationMinutes
      const { level, multiplier } = getLevelAndMultiplier(newLifetimeMinutes)
      
      await db.domains.update(timer.selectedDomainId, {
        lifetimeMinutes: newLifetimeMinutes,
        level,
        multiplier
      })

      const activityName = timer.selectedActivityId 
        ? activities.find(a => a.id === timer.selectedActivityId)?.name 
        : undefined

      await db.ledger.add({
        timestamp: endTime,
        type: 'earn_session',
        pointsDelta: points,
        referenceId: sessionId,
        description: `Session: ${domain.name}${activityName ? ` - ${activityName}` : ''}`
      })

      // Show result modal
      setSessionResult({
        domain: domain.name,
        activity: activityName,
        duration: durationMinutes,
        points,
        multiplier: domain.multiplier,
        softCapApplied: applySoftCapPenalty
      })

      // Reset timer but keep selections
      const resetState: TimerState = {
        sessionState: 'idle',
        startTime: null,
        pausedAt: null,
        totalPausedTime: 0,
        elapsed: 0,
        selectedDomainId: timer.selectedDomainId,
        selectedActivityId: timer.selectedActivityId
      }
      
      setTimer(resetState)
      saveTimerState(resetState)
      await loadData()
      
    } catch (error) {
      console.error('Failed to save session:', error)
      alert('Failed to save session. Please try again.')
    }
  }

  const cancelTimer = () => {
    const resetState: TimerState = {
      sessionState: 'idle',
      startTime: null,
      pausedAt: null,
      totalPausedTime: 0,
      elapsed: 0,
      selectedDomainId: timer.selectedDomainId,
      selectedActivityId: timer.selectedActivityId
    }
    setTimer(resetState)
    saveTimerState(resetState)
  }

  const dismissResult = () => {
    setSessionResult(null)
  }

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const selectedDomain = domains.find(d => d.id === timer.selectedDomainId)
  const selectedActivity = activities.find(a => a.id === timer.selectedActivityId)
  const isSessionActive = timer.sessionState === 'running' || timer.sessionState === 'paused'
  const softCapLeft = Math.max(0, Math.floor((DAILY_HARD_CAP_MINUTES - todayStats.minutes) / 60))

  return (
    <div className="page fade-in">
      {/* Session Result Modal */}
      {sessionResult && (
        <div className="session-result-overlay" onClick={dismissResult}>
          <div className="session-result-modal" onClick={e => e.stopPropagation()}>
            <div className="result-icon">✓</div>
            <div className="result-title">Session Complete</div>
            <div className="result-domain">{sessionResult.domain}</div>
            {sessionResult.activity && (
              <div className="result-activity">{sessionResult.activity}</div>
            )}
            <div className="result-stats">
              <div className="result-stat">
                <span className="result-stat-value">{sessionResult.duration}</span>
                <span className="result-stat-label">minutes</span>
              </div>
              <div className="result-stat result-stat-points">
                <span className="result-stat-value">+{sessionResult.points.toLocaleString()}</span>
                <span className="result-stat-label">points</span>
              </div>
              <div className="result-stat">
                <span className="result-stat-value">{sessionResult.multiplier}x</span>
                <span className="result-stat-label">multiplier</span>
              </div>
            </div>
            {sessionResult.softCapApplied && (
              <div className="result-penalty">Soft cap penalty applied (30%)</div>
            )}
            <button className="btn btn-primary" onClick={dismissResult}>
              <Check size={18} className="btn-icon" />
              Bank Points
            </button>
          </div>
        </div>
      )}

      {/* Compact Summary Row */}
      <div className="today-summary">
        <div className="summary-balance">{balance.toLocaleString()} pts</div>
        <div className="summary-divider">•</div>
        <div className="summary-stat">{todayStats.sessions} sessions</div>
        <div className="summary-divider">•</div>
        <div className="summary-stat">{softCapLeft}h left</div>
      </div>

      {/* Timer - Hero when running */}
      <div className={`timer-container ${isSessionActive ? 'timer-active' : ''}`}>
        <div className={`timer-time ${isSessionActive ? 'timer-time-large' : ''}`}>
          {formatTime(timer.elapsed)}
        </div>
        {selectedDomain && (
          <div className="timer-context">
            <span className="timer-domain-name">{selectedDomain.name}</span>
            {selectedActivity && (
              <span className="timer-activity-name"> · {selectedActivity.name}</span>
            )}
          </div>
        )}
        {timer.sessionState === 'paused' && (
          <div className="timer-paused-badge">PAUSED</div>
        )}
      </div>

      {/* Domain Selection - Wrapping grid, collapses when selected */}
      {!isSessionActive && (
        <div className="selection-section">
          <div className="selection-label">Domain</div>
          {!timer.selectedDomainId ? (
            <div className="chips-grid">
              {domains.map(domain => (
                <button
                  key={domain.id}
                  onClick={() => setTimer(prev => ({ ...prev, selectedDomainId: domain.id!, selectedActivityId: null }))}
                  className="chip"
                >
                  {domain.name}
                  <span className="chip-meta">Lv{domain.level}</span>
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={() => setTimer(prev => ({ ...prev, selectedDomainId: null, selectedActivityId: null }))}
              className="selected-domain-chip"
            >
              {selectedDomain?.name}
              <span className="chip-meta">Lv{selectedDomain?.level}</span>
              <span className="chip-clear">✕</span>
            </button>
          )}
        </div>
      )}

      {/* Activity Selection - Shows after domain selected */}
      {!isSessionActive && timer.selectedDomainId && activities.length > 0 && (
        <div className="selection-section">
          <div className="selection-label">Activity <span className="optional-tag">optional</span></div>
          <div className="chips-grid">
            {activities.map(activity => (
              <button
                key={activity.id}
                onClick={() => setTimer(prev => ({ 
                  ...prev, 
                  selectedActivityId: prev.selectedActivityId === activity.id ? null : activity.id! 
                }))}
                className={`chip ${timer.selectedActivityId === activity.id ? 'chip-selected' : ''}`}
              >
                {activity.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="action-buttons">
        {timer.sessionState === 'idle' && (
          <button
            onClick={startTimer}
            disabled={!timer.selectedDomainId}
            className="btn btn-primary btn-large"
          >
            <Play className="btn-icon" size={20} fill="currentColor" />
            Start
          </button>
        )}

        {timer.sessionState === 'running' && (
          <>
            <button onClick={pauseTimer} className="btn btn-secondary btn-action">
              <Pause size={20} fill="currentColor" />
            </button>
            <button onClick={finishTimer} className="btn btn-success btn-action-main">
              <Check size={20} />
              Finish
            </button>
            <button onClick={cancelTimer} className="btn btn-ghost btn-action">
              <X size={20} />
            </button>
          </>
        )}

        {timer.sessionState === 'paused' && (
          <>
            <button onClick={resumeTimer} className="btn btn-primary btn-action">
              <Play size={20} fill="currentColor" />
            </button>
            <button onClick={finishTimer} className="btn btn-success btn-action-main">
              <Check size={20} />
              Finish
            </button>
            <button onClick={cancelTimer} className="btn btn-ghost btn-action">
              <X size={20} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}