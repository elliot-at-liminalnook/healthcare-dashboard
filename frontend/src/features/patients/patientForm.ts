import type { BloodType, PatientRead, PatientStatus, PatientWrite } from '../../api/generated/model'
import { CreatePatientBody } from '../../api/generated/zod/patients/patients.zod.ts'
import { validate } from '../../api/validation.ts'
import { formatDate } from './format.ts'
import { STATUS_DISPLAY } from './status.ts'

/** What the form holds. Text inputs are always strings, so "empty" is `''`, not `null`. */
export interface PatientFormValues {
  first_name: string
  last_name: string
  preferred_name: string
  date_of_birth: string | null
  email: string
  phone: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  postal_code: string
  blood_type: BloodType | null
  allergies: string[]
  conditions: string[]
  status: PatientStatus
  last_visit: string | null
}

export const EMPTY_PATIENT: PatientFormValues = {
  first_name: '',
  last_name: '',
  preferred_name: '',
  date_of_birth: null,
  email: '',
  phone: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  postal_code: '',
  blood_type: null,
  allergies: [],
  conditions: [],
  status: 'active',
  last_visit: null,
}

export type PatientField = keyof PatientFormValues

/** What each field is called on screen. */
export const FIELD_LABELS: Record<PatientField, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  preferred_name: 'Preferred name',
  date_of_birth: 'Date of birth',
  email: 'Email',
  phone: 'Phone',
  address_line1: 'Address',
  address_line2: 'Apartment, unit or suite',
  city: 'City',
  state: 'State',
  postal_code: 'Postal code',
  blood_type: 'Blood type',
  allergies: 'Allergies',
  conditions: 'Conditions',
  status: 'Status',
  last_visit: 'Last visit',
}

export function toFormValues(patient: PatientRead): PatientFormValues {
  return {
    first_name: patient.first_name,
    last_name: patient.last_name,
    preferred_name: patient.preferred_name ?? '',
    date_of_birth: patient.date_of_birth,
    email: patient.email ?? '',
    phone: patient.phone ?? '',
    address_line1: patient.address_line1 ?? '',
    address_line2: patient.address_line2 ?? '',
    city: patient.city ?? '',
    state: patient.state ?? '',
    postal_code: patient.postal_code ?? '',
    blood_type: patient.blood_type,
    allergies: patient.allergies,
    conditions: patient.conditions,
    status: patient.status,
    last_visit: patient.last_visit,
  }
}

/** Trim text, and send "nothing entered" as null rather than an empty string. */
function toRequestBody(values: PatientFormValues) {
  const text = (value: string) => value.trim() || null
  return {
    ...values,
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    preferred_name: text(values.preferred_name),
    // Left out when empty, so the schema reports it as a missing required field.
    date_of_birth: values.date_of_birth ?? undefined,
    email: text(values.email),
    phone: text(values.phone),
    address_line1: text(values.address_line1),
    address_line2: text(values.address_line2),
    city: text(values.city),
    state: text(values.state),
    postal_code: text(values.postal_code),
  }
}

/** Client-side check, against the schema generated from the API. One message per field. */
export function validatePatient(values: PatientFormValues): Record<string, string> {
  return validate(CreatePatientBody, toRequestBody(values))
}

/** The request body for values that have passed `validatePatient`. */
export function toPatientWrite(values: PatientFormValues): PatientWrite {
  return CreatePatientBody.parse(toRequestBody(values))
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** What a newer copy of the record means for a form that is part-way through an edit. */
export interface IncomingChanges {
  /** Changed elsewhere and not touched here: safe to show the new value. */
  updated: PatientField[]
  /** Changed elsewhere and also edited here, to something different. Holds the other value. */
  conflicts: Partial<PatientFormValues>
}

/**
 * Compare a newer copy of the record (`incoming`) with the copy the form
 * started from (`baseline`) and what the form holds now (`current`).
 */
export function incomingChanges(
  baseline: PatientFormValues,
  current: PatientFormValues,
  incoming: PatientFormValues,
): IncomingChanges {
  const changes: IncomingChanges = { updated: [], conflicts: {} }
  for (const name of Object.keys(FIELD_LABELS) as PatientField[]) {
    if (sameValue(incoming[name], baseline[name])) continue // not changed elsewhere
    if (sameValue(current[name], incoming[name])) continue // both made the same change
    if (sameValue(current[name], baseline[name])) changes.updated.push(name)
    else Object.assign(changes.conflicts, { [name]: incoming[name] })
  }
  return changes
}

/** A field's value as a person would read it, for messages about changes. */
export function displayValue(name: PatientField, value: PatientFormValues[PatientField]): string {
  if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
    return 'nothing'
  }
  if (Array.isArray(value)) return value.join(', ')
  if (name === 'date_of_birth' || name === 'last_visit') return formatDate(value)
  if (name === 'status') return STATUS_DISPLAY[value as PatientStatus].label
  return value
}

export const COMMON_ALLERGIES = [
  'Penicillin',
  'Sulfa drugs',
  'Aspirin',
  'Ibuprofen',
  'Latex',
  'Peanuts',
  'Shellfish',
  'Pollen',
  'Dust mites',
  'Bee stings',
]

export const COMMON_CONDITIONS = [
  'Hypertension',
  'Hyperlipidemia',
  'Type 2 diabetes',
  'Asthma',
  'Anxiety',
  'Depression',
  'GERD',
  'Osteoarthritis',
  'Hypothyroidism',
  'Migraine',
]
