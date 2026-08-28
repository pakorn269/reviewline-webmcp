import { describe, it, expect } from 'vitest'
import { getLocalizedEvent } from './timelineTranslations'
import type { SessionEvent } from '../domain/domain'

describe('session timeline localization', () => {
  const sampleEvent: SessionEvent = {
    id: 'event-0001',
    ts: '2026-08-26T02:00:00Z',
    kind: 'registered',
    actor: 'system',
    toolName: 'list_incidents',
    detail: 'Capability became available for the current workflow phase.',
  }

  const selectionEvent: SessionEvent = {
    id: 'event-0002',
    ts: '2026-08-26T02:00:01Z',
    kind: 'workflow',
    actor: 'human',
    detail: 'Incident selected: inc-001',
  }

  it('returns original values when language is en', () => {
    const localized = getLocalizedEvent(sampleEvent, 'en')
    expect(localized.kind).toBe('registered')
    expect(localized.actor).toBe('system')
    expect(localized.detail).toBe('Capability became available for the current workflow phase.')
    expect(localized.toolName).toBe('list_incidents')
  })

  it('translates kind, actor, and capability detail when language is th', () => {
    const localized = getLocalizedEvent(sampleEvent, 'th')
    expect(localized.kind).toBe('ลงทะเบียนแล้ว')
    expect(localized.actor).toBe('ระบบ')
    expect(localized.detail).toBe('ความสามารถพร้อมใช้งานสำหรับขั้นตอนเวิร์กโฟลว์ปัจจุบัน')
    expect(localized.toolName).toBe('list_incidents')
  })

  it('translates selection detail and human actor when language is th', () => {
    const localized = getLocalizedEvent(selectionEvent, 'th')
    expect(localized.kind).toBe('เวิร์กโฟลว์')
    expect(localized.actor).toBe('มนุษย์')
    expect(localized.detail).toBe('เลือกเหตุการณ์: inc-001')
  })
})
