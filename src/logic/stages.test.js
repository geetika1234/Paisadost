import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  STAGES, getStage, hasReachedStage,
  getStatus, isClosedStatus, matchStatusView, AGENT_CLOSE_REASONS,
} from './stages'

// Source of every app file except tests and this module, for structural guards.
const SRC_DIR = 'src'
const appSources = readdirSync(SRC_DIR, { recursive: true })
  .filter(f => /\.jsx?$/.test(f) && !/\.test\.jsx?$/.test(f) && !f.includes('._'))
  .filter(f => !f.endsWith(join('logic', 'stages.js')))
  .map(f => ({ file: f, text: readFileSync(join(SRC_DIR, f), 'utf8') }))

describe('stage vocabulary', () => {
  it('lists the five live stages in rank order', () => {
    expect(STAGES.map(s => s.key)).toEqual(['new', 'visited', 'pain_identified', 'roi_shown', 'login_started'])
    const ranks = STAGES.map(s => s.rank)
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
  })

  it('every live stage has a screen that records its event', () => {
    const all = appSources.map(s => s.text).join('\n')
    for (const s of STAGES) {
      expect(all, `${s.key} is live but nothing records '${s.event}'`).toContain(`'${s.event}'`)
    }
  })

  it('no screen redeclares its own stage map', () => {
    for (const { file, text } of appSources) {
      for (const banned of ['STAGE_MAP', 'STAGE_CONFIG', 'STAGE_LABEL', 'STAGE_ORDER', 'ROI_STAGES']) {
        expect(text.includes(banned), `${file} declares ${banned}; import from logic/stages instead`).toBe(false)
      }
    }
  })

  it('falls back to Nayi Lead for unknown stages instead of crashing', () => {
    expect(getStage(undefined).label).toBe('Nayi Lead')
    expect(getStage('garbage').label).toBe('Nayi Lead')
  })

  it('keeps retired stages ranked above Login Done', () => {
    expect(getStage('disbursed').label).toBe('Disbursed')
    expect(hasReachedStage('disbursed', 'login_started')).toBe(true)
    expect(hasReachedStage('visited', 'roi_shown')).toBe(false)
  })
})

describe('lead status', () => {
  it('treats leads without a status as Active', () => {
    expect(getStatus(undefined).key).toBe('active')
    expect(isClosedStatus(undefined)).toBe(false)
  })

  it('splits statuses into open and closed views', () => {
    expect(['active', 'nurture'].filter(s => matchStatusView(s, 'open'))).toEqual(['active', 'nurture'])
    expect(['lost', 'not_qualified', 'rejected', 'dormant'].every(s => matchStatusView(s, 'closed'))).toBe(true)
    expect(matchStatusView('active', 'nurture')).toBe(false)
    expect(matchStatusView('lost', 'open')).toBe(false)
  })

  it('offers agents only the statuses the database lets them set', () => {
    expect(Object.keys(AGENT_CLOSE_REASONS).sort()).toEqual(['lost', 'not_qualified'])
    for (const reasons of Object.values(AGENT_CLOSE_REASONS)) expect(reasons.length).toBeGreaterThan(0)
  })
})
