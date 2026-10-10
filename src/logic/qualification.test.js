import { describe, it, expect } from 'vitest'
import {
  EMPTY_LOAN_REQ, missingQualificationAnswers, canSubmitQualification,
  buildQualificationPayload, lakhLabel, qualificationRows,
} from './qualification'

const complete = {
  ...EMPTY_LOAN_REQ,
  loanRequired: '500000', loanPurpose: 'Stock', neededBy: '15 din me',
  familyIncome: '60000', hasExistingLoan: false, decisionMaker: 'Main khud',
  shopAge: '2-5 saal', pastBounce: false, hasProperty: true, propertyTypes: ['Dukaan'],
  consent: true,
}

describe('qualification answers', () => {
  it('lists every unanswered question for a blank form, in asking order', () => {
    expect(missingQualificationAnswers(EMPTY_LOAN_REQ)).toEqual([
      'Loan amount', 'Loan kis kaam ke liye', 'Kab tak chahiye', 'Ghar ki total income',
      'Existing loan', 'Faisla kaun lega', 'Dukaan kitni purani', 'EMI bounce', 'Property',
    ])
  })

  it('treats a "Nahi" answer as answered, not missing', () => {
    expect(missingQualificationAnswers(complete)).toEqual([])
  })

  it('needs a loan amount and the customer consent to submit, nothing else', () => {
    expect(canSubmitQualification({ ...EMPTY_LOAN_REQ, loanRequired: '200000', consent: true })).toBe(true)
    expect(canSubmitQualification({ ...complete, consent: false })).toBe(false)
    expect(canSubmitQualification({ ...complete, loanRequired: '' })).toBe(false)
  })

  it('builds a clean payload and clears details for "Nahi" answers', () => {
    const now = new Date('2026-10-10T10:00:00Z')
    const p = buildQualificationPayload({
      ...complete, loanRequired: '5,00,000', hasExistingLoan: false, totalLoanAmount: '90000', totalEmi: '4000',
      hasProperty: false, propertyTypes: ['Ghar'],
    }, now)
    expect(p.loanRequired).toBe(500000)
    expect(p.totalLoanAmount).toBe(0)
    expect(p.totalEmi).toBe(0)
    expect(p.propertyTypes).toEqual([])
    expect(p.consent).toBe(true)
    expect(p.submittedAt).toBe('2026-10-10T10:00:00.000Z')
  })

  it('keeps unanswered yes/no questions as null, never false', () => {
    const p = buildQualificationPayload({ ...EMPTY_LOAN_REQ, loanRequired: '1', consent: true })
    expect(p.hasExistingLoan).toBeNull()
    expect(p.pastBounce).toBeNull()
    expect(p.hasProperty).toBeNull()
  })
})

describe('lakhLabel', () => {
  it('says amounts the way they are said aloud', () => {
    expect(lakhLabel('500000')).toBe('5 lakh')
    expect(lakhLabel('150000')).toBe('1.5 lakh')
    expect(lakhLabel('125000')).toBe('1.25 lakh')
    expect(lakhLabel('85000')).toBe('85,000')
    expect(lakhLabel('')).toBe('')
  })
})

describe('qualificationRows (manager view)', () => {
  it('shows a dash for blank answers and the EMI for existing loans', () => {
    const rows = Object.fromEntries(qualificationRows({
      loanRequired: 300000, hasExistingLoan: true, totalLoanAmount: 200000, totalEmi: 8000,
    }))
    expect(rows['Loan amount']).toBe('₹3,00,000')
    expect(rows['Existing loan']).toBe('Haan · ₹2,00,000 · EMI ₹8,000/mahina')
    expect(rows['Faisla']).toBe('—')
    expect(rows['EMI kabhi bounce']).toBe('—')
  })
})
