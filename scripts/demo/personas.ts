/**
 * Demo tenant + user roster for the Phase 1 Arwa Energy fixture.
 *
 * Single source of truth for: tenant settings, the 21 user_profiles +
 * matching auth.users, and the 20 employees.records (everyone except
 * the external Tilqai-Grism superadmin). Other demo modules
 * (framework, scores, idps) reference rows here by email.
 */

export type UserRole = "employee" | "manager" | "ld_admin" | "coach" | "superadmin"

export const TENANT = {
  name: "Arwa Energy",
  slug: "arwa-energy-demo",
} as const

/**
 * Personas whose passwords are echoed at the end of a seed run.
 * Everyone else gets a cryptographically random password that is
 * generated, set on auth.users, then immediately discarded — to log in
 * as one of those users a demo operator must reset via the Supabase
 * dashboard.
 */
export const PRINTED_PERSONA_EMAILS = new Set([
  "yusuf.alsaadi@grism-demo.local",
  "aisha.albalushi@grism-demo.local",
  "khalid.alharthy@grism-demo.local",
  "fatima.allawati@grism-demo.local",
  "omar.almahrouqi@grism-demo.local",
  // Employee persona — added so the local demo switcher can sign in as
  // a regular employee (Saif owns an active IDP, so he is the natural
  // fixture for /employee/idp review). Must be re-seeded to rotate his
  // password into the printable set.
  "saif.alhabsi@grism-demo.local",
])

export type DemoUser = {
  full_name: string
  email: string
  role: UserRole
  role_title: string
  target_role_title: string | null
  department: string | null
  org_unit: string | null
  manager_email: string | null
  has_employee_record: boolean
  employee_number: string | null
  hire_date: string | null
}

const KH = "khalid.alharthy@grism-demo.local"
const FA = "fatima.allawati@grism-demo.local"
const OM = "omar.almahrouqi@grism-demo.local"

export const USERS: DemoUser[] = [
  {
    full_name: "Yusuf Al-Saadi",
    email: "yusuf.alsaadi@grism-demo.local",
    role: "superadmin",
    role_title: "Tilqai-Grism Support",
    target_role_title: null,
    department: null,
    org_unit: null,
    manager_email: null,
    has_employee_record: false,
    employee_number: null,
    hire_date: null,
  },
  {
    full_name: "Aisha Al-Balushi",
    email: "aisha.albalushi@grism-demo.local",
    role: "ld_admin",
    role_title: "L&D Manager",
    target_role_title: "Head of L&D",
    department: "Human Resources",
    org_unit: "L&D",
    manager_email: null,
    has_employee_record: true,
    employee_number: "ARW-001",
    hire_date: "2022-03-01",
  },
  {
    full_name: "Maryam Al-Hinai",
    email: "maryam.alhinai@grism-demo.local",
    role: "coach",
    role_title: "Internal Coach",
    target_role_title: "Lead Coach",
    department: "Human Resources",
    org_unit: "L&D",
    manager_email: null,
    has_employee_record: true,
    employee_number: "ARW-002",
    hire_date: "2023-09-15",
  },
  {
    full_name: "Khalid Al-Harthy",
    email: KH,
    role: "manager",
    role_title: "Operations Manager",
    target_role_title: "Operations Director",
    department: "Operations",
    org_unit: "Operations",
    manager_email: null,
    has_employee_record: true,
    employee_number: "ARW-003",
    hire_date: "2018-01-10",
  },
  {
    full_name: "Fatima Al-Lawati",
    email: FA,
    role: "manager",
    role_title: "Engineering Manager",
    target_role_title: "Engineering Director",
    department: "Engineering",
    org_unit: "Engineering",
    manager_email: null,
    has_employee_record: true,
    employee_number: "ARW-004",
    hire_date: "2019-04-22",
  },
  {
    full_name: "Omar Al-Mahrouqi",
    email: OM,
    role: "manager",
    role_title: "Commercial Manager",
    target_role_title: "Commercial Director",
    department: "Commercial",
    org_unit: "Commercial",
    manager_email: null,
    has_employee_record: true,
    employee_number: "ARW-005",
    hire_date: "2020-06-01",
  },
  // Operations team — manager Khalid
  {
    full_name: "Salma Al-Riyami",
    email: "salma.alriyami@grism-demo.local",
    role: "employee",
    role_title: "Senior Operations Analyst",
    target_role_title: "Operations Manager",
    department: "Operations",
    org_unit: "Operations",
    manager_email: KH,
    has_employee_record: true,
    employee_number: "ARW-006",
    hire_date: "2020-09-12",
  },
  {
    full_name: "Hamed Al-Kindi",
    email: "hamed.alkindi@grism-demo.local",
    role: "employee",
    role_title: "Operations Coordinator",
    target_role_title: "Senior Operations Analyst",
    department: "Operations",
    org_unit: "Operations",
    manager_email: KH,
    has_employee_record: true,
    employee_number: "ARW-007",
    hire_date: "2021-11-03",
  },
  {
    full_name: "Noura Al-Wahaibi",
    email: "noura.alwahaibi@grism-demo.local",
    role: "employee",
    role_title: "Field Operations Specialist",
    target_role_title: "Operations Coordinator",
    department: "Operations",
    org_unit: "Field Ops",
    manager_email: KH,
    has_employee_record: true,
    employee_number: "ARW-008",
    hire_date: "2022-02-14",
  },
  {
    full_name: "Saif Al-Habsi",
    email: "saif.alhabsi@grism-demo.local",
    role: "employee",
    role_title: "Junior Operations Analyst",
    target_role_title: "Operations Analyst",
    department: "Operations",
    org_unit: "Operations",
    manager_email: KH,
    has_employee_record: true,
    employee_number: "ARW-009",
    hire_date: "2023-05-08",
  },
  {
    full_name: "Layla Al-Busaidi",
    email: "layla.albusaidi@grism-demo.local",
    role: "employee",
    role_title: "Operations Trainee",
    target_role_title: "Junior Operations Analyst",
    department: "Operations",
    org_unit: "Operations",
    manager_email: KH,
    has_employee_record: true,
    employee_number: "ARW-010",
    hire_date: "2024-08-20",
  },
  {
    full_name: "Hessa Al-Toubi",
    email: "hessa.altoubi@grism-demo.local",
    role: "employee",
    role_title: "Logistics Coordinator",
    target_role_title: "Senior Logistics Analyst",
    department: "Operations",
    org_unit: "Logistics",
    manager_email: KH,
    has_employee_record: true,
    employee_number: "ARW-011",
    hire_date: "2021-07-19",
  },
  // Engineering team — manager Fatima
  {
    full_name: "Mohammed Al-Mawali",
    email: "mohammed.almawali@grism-demo.local",
    role: "employee",
    role_title: "Senior Mechanical Engineer",
    target_role_title: "Engineering Manager",
    department: "Engineering",
    org_unit: "Mechanical",
    manager_email: FA,
    has_employee_record: true,
    employee_number: "ARW-012",
    hire_date: "2019-10-01",
  },
  {
    full_name: "Sultan Al-Battashi",
    email: "sultan.albattashi@grism-demo.local",
    role: "employee",
    role_title: "Process Engineer",
    target_role_title: "Senior Process Engineer",
    department: "Engineering",
    org_unit: "Process",
    manager_email: FA,
    has_employee_record: true,
    employee_number: "ARW-013",
    hire_date: "2021-03-15",
  },
  {
    full_name: "Najla Al-Farsi",
    email: "najla.alfarsi@grism-demo.local",
    role: "employee",
    role_title: "Mechanical Engineer",
    target_role_title: "Senior Mechanical Engineer",
    department: "Engineering",
    org_unit: "Mechanical",
    manager_email: FA,
    has_employee_record: true,
    employee_number: "ARW-014",
    hire_date: "2022-06-22",
  },
  {
    full_name: "Sami Al-Jabri",
    email: "sami.aljabri@grism-demo.local",
    role: "employee",
    role_title: "Junior Engineer",
    target_role_title: "Mechanical Engineer",
    department: "Engineering",
    org_unit: "Mechanical",
    manager_email: FA,
    has_employee_record: true,
    employee_number: "ARW-015",
    hire_date: "2024-01-08",
  },
  {
    full_name: "Maha Al-Hashmi",
    email: "maha.alhashmi@grism-demo.local",
    role: "employee",
    role_title: "Engineering Trainee",
    target_role_title: "Junior Engineer",
    department: "Engineering",
    org_unit: "Mechanical",
    manager_email: FA,
    has_employee_record: true,
    employee_number: "ARW-016",
    hire_date: "2024-09-02",
  },
  // Commercial team — manager Omar
  {
    full_name: "Rashid Al-Amri",
    email: "rashid.alamri@grism-demo.local",
    role: "employee",
    role_title: "Senior Commercial Analyst",
    target_role_title: "Commercial Manager",
    department: "Commercial",
    org_unit: "Commercial",
    manager_email: OM,
    has_employee_record: true,
    employee_number: "ARW-017",
    hire_date: "2020-11-25",
  },
  {
    full_name: "Khadija Al-Zadjali",
    email: "khadija.alzadjali@grism-demo.local",
    role: "employee",
    role_title: "Commercial Analyst",
    target_role_title: "Senior Commercial Analyst",
    department: "Commercial",
    org_unit: "Commercial",
    manager_email: OM,
    has_employee_record: true,
    employee_number: "ARW-018",
    hire_date: "2022-01-17",
  },
  {
    full_name: "Asma Al-Siyabi",
    email: "asma.alsiyabi@grism-demo.local",
    role: "employee",
    role_title: "Junior Commercial Analyst",
    target_role_title: "Commercial Analyst",
    department: "Commercial",
    org_unit: "Commercial",
    manager_email: OM,
    has_employee_record: true,
    employee_number: "ARW-019",
    hire_date: "2024-02-12",
  },
  {
    full_name: "Bader Al-Rawahi",
    email: "bader.alrawahi@grism-demo.local",
    role: "employee",
    role_title: "Commercial Trainee",
    target_role_title: "Junior Commercial Analyst",
    department: "Commercial",
    org_unit: "Commercial",
    manager_email: OM,
    has_employee_record: true,
    employee_number: "ARW-020",
    hire_date: "2024-10-07",
  },
]

/** Given a role_title, the proficiency level we expect for "most" competencies. */
export function targetLevelForRoleTitle(roleTitle: string): number {
  const t = roleTitle.toLowerCase()
  if (t.includes("trainee")) return 2
  if (t.includes("junior")) return 3
  if (t.includes("senior")) return 4
  if (t.includes("manager") || t.includes("head") || t.includes("director") || t.includes("lead")) return 4
  // Analyst / Engineer / Coordinator / Specialist / Coach default
  return 3
}
