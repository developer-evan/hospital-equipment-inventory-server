export interface DefaultDepartmentSeed {
  name: string;
  code: string;
  location?: string;
}

/**
 * Seeded on first boot (see SeedService). Codes are short, unique,
 * upper-case mnemonics used e.g. as a prefix for auto-generated asset
 * numbers.
 */
export const DEFAULT_DEPARTMENTS: DefaultDepartmentSeed[] = [
  { name: 'Theatre', code: 'THR' },
  { name: 'ICU', code: 'ICU' },
  { name: 'HDU', code: 'HDU' },
  { name: 'Newborn Unit', code: 'NBU' },
  { name: 'Maternity/Labour', code: 'MAT' },
  { name: 'Laboratory', code: 'LAB' },
  { name: 'Radiology', code: 'RAD' },
  { name: 'Dental', code: 'DEN' },
  { name: 'CSSD', code: 'CSSD' },
  { name: 'Renal Unit', code: 'REN' },
  { name: 'Physiotherapy', code: 'PHY' },
  { name: 'Laundry', code: 'LDY' },
  { name: 'Kitchen', code: 'KIT' },
  { name: 'Mortuary', code: 'MOR' },
  { name: 'Wards', code: 'WRD' },
  { name: 'OPD', code: 'OPD' },
  { name: 'Eye Clinic', code: 'EYE' },
  { name: 'ENT', code: 'ENT' },
  { name: 'Pharmacy', code: 'PHM' },
];
