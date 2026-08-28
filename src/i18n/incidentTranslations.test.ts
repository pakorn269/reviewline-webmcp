import { describe, it, expect } from 'vitest'
import { makeInitialState } from '../domain/domain'
import { getLocalizedIncident } from './incidentTranslations'

describe('incident content localization', () => {
  const state = makeInitialState()
  const inc001 = state.incidents[0]
  const inc002 = state.incidents[1]
  const inc003 = state.incidents[2]

  it('returns original incident unchanged when language is en', () => {
    const localized = getLocalizedIncident(inc001, 'en')
    expect(localized.summary).toBe(inc001.summary)
    expect(localized.agent).toBe('procurement-agent')
    expect(localized.trace[0].message).toBe(inc001.trace[0].message)
    expect(localized.cohort[0].label).toBe('Blocked order (prompt injection)')
  })

  it('localizes inc-001 summary, agent, traces, and cohort when language is th', () => {
    const localized = getLocalizedIncident(inc001, 'th')
    expect(localized.agent).toContain('เอเจนต์ฝ่ายจัดซื้อ')
    expect(localized.summary).toContain('เนื้อหาในหน้าเพจของซัพพลายเออร์พยายามแทนที่เพดานการจัดซื้อ')
    expect(localized.trace[0].message).toBe('เอเจนต์ดึงข้อมูลหน้าแค็ตตาล็อกซัพพลายเออร์สำหรับผู้ขาย ACME-7731')
    expect(localized.trace[1].message).toContain('หน้าเพจของซัพพลายเออร์มีคำสั่งแทรกแซง')
    expect(localized.trace[2].message).toContain('เอเจนต์ตัดสินใจส่งคำสั่งซื้อจำนวน $142,000')
    expect(localized.trace[3].message).toContain('เกตเวย์การดัดแปลงบล็อก')
    expect(localized.cohort[0].label).toContain('คำสั่งซื้อที่ถูกบล็อก (พรอมต์แทรกแซง)')
    expect(localized.cohort[1].label).toContain('ผู้ขายใกล้เคียง — กรณีควบคุมปกติ')
  })

  it('localizes inc-002 and inc-003 when language is th', () => {
    const loc2 = getLocalizedIncident(inc002, 'th')
    expect(loc2.agent).toContain('เอเจนต์ฝ่ายสนับสนุน')
    expect(loc2.summary).toContain('คำขอคืนเงิน')
    expect(loc2.cohort[0].label).toContain('การคืนเงินที่ถูกบล็อก')

    const loc3 = getLocalizedIncident(inc003, 'th')
    expect(loc3.agent).toContain('เอเจนต์ฝ่ายปรับใช้')
    expect(loc3.summary).toContain('การปรับใช้ถูกบล็อก')
    expect(loc3.cohort[0].label).toContain('การปรับใช้ที่ถูกบล็อก')
  })
})
