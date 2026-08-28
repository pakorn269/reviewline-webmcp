import type { SessionEvent } from '../domain/domain'
import type { Language } from './types'

const KIND_TRANSLATIONS: Record<string, string> = {
  registered: 'ลงทะเบียนแล้ว',
  unregistered: 'ยกเลิกการลงทะเบียน',
  workflow: 'เวิร์กโฟลว์',
  invoked: 'เรียกใช้งาน',
  result: 'ผลลัพธ์',
  decision: 'การตัดสินใจ',
}

const ACTOR_TRANSLATIONS: Record<string, string> = {
  system: 'ระบบ',
  human: 'มนุษย์',
  agent: 'เอเจนต์',
}

const EXACT_DETAIL_TRANSLATIONS: Record<string, string> = {
  'Capability became available for the current workflow phase.':
    'ความสามารถพร้อมใช้งานสำหรับขั้นตอนเวิร์กโฟลว์ปัจจุบัน',
  'Capability removed by the least-authority workflow.':
    'ความสามารถถูกนำออกตามหลักสิทธิ์ขั้นต่ำสุดของเวิร์กโฟลว์',
  'Simulation replay completed.': 'การจำลองรันซ้ำเสร็จสิ้น',
  'Review gate proposal drafted.': 'ร่างข้อเสนอการตรวจสอบเสร็จสิ้น',
  'Human decision recorded.': 'บันทึกการตัดสินใจของมนุษย์แล้ว',
}

function localizeDetail(detail: string): string {
  if (EXACT_DETAIL_TRANSLATIONS[detail]) {
    return EXACT_DETAIL_TRANSLATIONS[detail]
  }

  const selectedMatch = detail.match(/^Incident selected:\s*(.+)$/)
  if (selectedMatch) {
    return `เลือกเหตุการณ์: ${selectedMatch[1]}`
  }

  const toolInvokedMatch = detail.match(/^([a-z_]+) tool invoked\.?$/i)
  if (toolInvokedMatch) {
    return `เรียกใช้งานเครื่องมือ ${toolInvokedMatch[1]}`
  }

  const toolCompletedMatch = detail.match(/^([a-z_]+) tool completed\.?$/i)
  if (toolCompletedMatch) {
    return `เครื่องมือ ${toolCompletedMatch[1]} ทำงานเสร็จสิ้น`
  }

  return detail
}

export function getLocalizedEvent(
  event: SessionEvent,
  language: Language,
): {
  id: string
  ts: string
  kind: string
  actor: string
  detail: string
  toolName?: string
} {
  if (language !== 'th') {
    return {
      id: event.id,
      ts: event.ts,
      kind: event.kind,
      actor: event.actor,
      detail: event.detail,
      toolName: event.toolName,
    }
  }

  return {
    id: event.id,
    ts: event.ts,
    kind: KIND_TRANSLATIONS[event.kind] ?? event.kind,
    actor: ACTOR_TRANSLATIONS[event.actor] ?? event.actor,
    detail: localizeDetail(event.detail),
    toolName: event.toolName,
  }
}
