import type { TranslationDictionary } from './types'

export const th: TranslationDictionary = {
  // Shell / Header
  appTitle: 'Reviewline',
  tagline: 'เอเจนต์ดำเนินการสืบสวน มนุษย์เป็นผู้อนุมัติ',
  webmcpActive: 'WebMCP ✓',
  webmcpInactive: 'WebMCP —',
  webmcpActiveTitle: 'ลงทะเบียนเครื่องมือ WebMCP แล้ว',
  webmcpInactiveTitle: 'ไม่มีเครื่องมือ WebMCP พร้อมใช้งาน',
  reset: 'รีเซ็ต',
  resetDemoStateAria: 'รีเซ็ตสถานะการสาธิต',
  toolInspectorSummary: 'เครื่องมือตรวจสอบ WebMCP ({count} เครื่องมือ)',

  // Language Toggle
  languageToggleAria: 'เปลี่ยนภาษาเป็น {targetLang}',
  langEn: 'EN',
  langTh: 'TH',

  // Incident Queue
  incidentQueueTitle: 'เหตุการณ์',
  incidentQueueRegionAria: 'Incident queue',
  selectedBadge: 'เลือกอยู่',

  // Evidence Panel
  evidencePanelTitle: 'ร่องรอยหลักฐาน',
  evidencePanelEmpty: 'เลือกเหตุการณ์จากคิวเพื่อตรวจสอบหลักฐาน',
  evidenceWorkspaceAria: 'พื้นที่ทำงานหลักฐาน',
  evidenceForAria: 'หลักฐานสำหรับ {id}',
  traceHeading: 'ร่องรอย (Trace)',
  cohortHeading: 'กลุ่มประชากร (Cohort)',

  // Simulation View
  simulationTitle: 'การจำลองการแก้ไขการ์ดเรล',
  simulationEmpty: 'ยังไม่มีการจำลอง รัน simulate_guardrail_patch เพื่อทดสอบกฎใหม่อีกครั้ง',
  simCompleted: 'เสร็จสิ้น',
  simAria: 'การจำลอง {simId}',
  resultIdentity: 'รหัสผลลัพธ์',
  baselinePolicy: 'นโยบายเดิม',
  candidatePolicy: 'นโยบายใหม่',
  executedAt: 'เวลาที่ประมวลผล',
  exactRule: 'กฎที่แน่นอน',
  ruleLabel: 'กฎ: {ruleKind}',
  thresholdLabel: 'เกณฑ์: {threshold}',
  enforcementLabel: 'การบังคับใช้: {enforcement}',
  noRegressions: 'ตรวจไม่พบการถดถอย',
  regressionsDetected: 'ตรวจพบการถดถอย {count} รายการ',
  cohortResultsAria: 'ผลลัพธ์รวมของผู้สมัคร',
  blockedCount: 'ถูกบล็อก: {count}',
  allowedCount: 'ได้รับอนุญาต: {count}',
  totalCases: 'จำนวนกรณีทั้งหมด: {count}',
  counterfactualReplay: 'การจำลองย้อนหลังสมมุติ',

  // Review Panel
  reviewPanelAria: 'แผงการตรวจสอบ',
  reviewPanelTitle: 'แผงการตรวจสอบโดยมนุษย์',
  noProposalPending: 'ไม่มีข้อเสนอที่รอดำเนินการ เอเจนต์สามารถร่างข้อเสนอได้หลังการจำลองที่ผ่านเกณฑ์เท่านั้น',
  noProposalDesc:
    'ยังไม่มีข้อเสนอที่รอการตัดสินใจของมนุษย์ในขณะนี้ เอเจนต์ต้องรันการจำลองและร่างข้อเสนอก่อน',
  humanReviewLine: 'ขอบเขตการตรวจสอบโดยมนุษย์',
  statusPending: 'รอดำเนินการ',
  rationaleHeading: 'เหตุผลประกอบ',
  notEligibleTitle: 'หลักฐานการจำลองไม่ผ่านเกณฑ์สำหรับการตัดสินใจของมนุษย์',
  notEligibleDesc:
    'ส่วนควบคุมการตัดสินใจยังไม่พร้อมใช้งาน กรุณารันการจำลองใหม่อีกครั้งโดยต้องมีกรณีที่กระตุ้นถูกบล็อก กรณีควบคุมปกติได้รับอนุญาต และไม่มีการถดถอย',
  reviewerIdentityLabel: 'ตัวตนของผู้ตรวจสอบ',
  reviewerIdentityPlaceholder: 'เช่น alice@platform-safety',
  reviewNoteLabel: 'บันทึกการตรวจสอบ',
  reviewNotePlaceholder: 'ระบุเหตุผลในการอนุมัติหรือปฏิเสธโดยมนุษย์...',
  confirmEvidenceLabel: 'ข้าพเจ้ายืนยันว่าได้ตรวจสอบผลการจำลองของกรณีที่กระตุ้นและกรณีควบคุมปกติเรียบร้อยแล้ว',
  confirmKeepPurchaseBlocked: 'ยืนยันแพตช์นโยบาย · บล็อกการสั่งซื้อต่อไป',
  confirmKeepRefundBlocked: 'ยืนยันแพตช์นโยบาย · บล็อกการคืนเงินต่อไป',
  confirmKeepDeploymentBlocked: 'ยืนยันแพตช์นโยบาย · บล็อกการปรับใช้ต่อไป',
  rejectProposalKeepBlock: 'ปฏิเสธข้อเสนอ · บังคับใช้การบล็อกปัจจุบันต่อไป',
  decisionRecorded: 'บันทึกการตัดสินใจแล้ว',
  purchaseRemainsBlocked: 'การสั่งซื้อยังคงถูกบล็อก',
  refundRemainsBlocked: 'การคืนเงินยังคงถูกบล็อก',
  deploymentRemainsBlocked: 'การปรับใช้ยังคงถูกบล็อก',
  completedStatus: 'เสร็จสิ้น',
  awaitingHumanDecision: 'รอการตัดสินใจของมนุษย์',
  openStatus: 'เปิดอยู่',
  noExternalDeployment: 'ไม่มีการปรับใช้ระบบภายนอก',

  // Audit Log
  auditLogTitle: 'บันทึกการตรวจสอบ',
  auditLogEmpty: 'ยังไม่มีรายการตรวจสอบ การตัดสินใจจะปรากฏที่นี่หลังจากการตรวจสอบโดยมนุษย์',
  auditLogAria: 'บันทึกการตรวจสอบ',

  // Session Timeline
  sessionTimelineTitle: 'ไทม์ไลน์เซสชัน',
  sessionTimelineEmpty: 'การเปลี่ยนแปลงความสามารถและการเรียกใช้เครื่องมือจะปรากฏที่นี่',
  sessionTimelineAria: 'ไทม์ไลน์เซสชัน',

  // Tool Inspector
  toolInspectorTitle: 'เครื่องมือ WebMCP',
  toolInspectorAria: 'เครื่องมือตรวจสอบ WebMCP',
  registeredStatus: '✓ ลงทะเบียนแล้ว ({count})',
  fallbackStatus: 'WebMCP ไม่พร้อมใช้งาน — โหมดเครื่องมือตรวจสอบสำหรับนักพัฒนา',
  inputSchemaSummary: 'สคีมาข้อมูลขาเข้า',
}
