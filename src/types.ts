import type { Timestamp } from 'firebase/firestore';

export type Language = 'en' | 'ta';

export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'inactive';

export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  fullName: string;
  designation: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  createdBy: string;
  createdAt?: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
}

export interface GnDivision {
  id: string;
  code: string;
  nameEn: string;
  nameTa: string;
  gnOfficerName: string;
  gnOfficerPhone: string;
  isActive: boolean;
  createdAt?: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
}

export type Gender = 'Male' | 'Female';
export type PaymentMethod = 'None' | 'Bank' | 'Post Office';
export type AllowanceStatus = 'Not Applicable' | 'Active' | 'Suspended' | 'Pending' | 'Other';

export interface ElderlyCitizen {
  id: string;
  fullName: string;
  dateOfBirth: string; // YYYY-MM-DD
  nicNumber: string;
  gender: Gender;
  telephone: string;
  gnDivisionId: string;
  gnDivisionName: string;
  address: string;
  welfareRegNumber: string;
  receivingAllowance: boolean;
  paymentMethod: PaymentMethod;
  bankName: string;
  bankBranch: string;
  bankAccountNumber: string;
  postOfficeName: string;
  allowanceStatus: AllowanceStatus;
  remarks: string;
  createdByUid: string;
  createdByName: string;
  updatedByUid: string;
  updatedByName: string;
  createdAt?: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
}

export interface ElderlyCitizenFormInput {
  fullName: string;
  dateOfBirth: string;
  nicNumber: string;
  gender: Gender;
  telephone: string;
  gnDivisionId: string;
  address: string;
  welfareRegNumber: string;
  receivingAllowance: boolean;
  paymentMethod: PaymentMethod;
  bankName: string;
  bankBranch: string;
  bankAccountNumber: string;
  postOfficeName: string;
  allowanceStatus: AllowanceStatus;
  remarks: string;
}

export type CitizenCategoryTab =
  | 'all_60_plus'
  | 'aged_60_69'
  | 'aged_70_plus'
  | 'allowance_recipients'
  | 'bank_recipients'
  | 'post_office_recipients'
  | 'non_allowance_70_plus';

export type SortField = 'fullName' | 'age' | 'gnDivisionName' | 'createdAt';
export type SortDirection = 'asc' | 'desc';

export interface FilterState {
  search: string;
  gnDivisionId: string;
  ageRange: 'all' | '60-69' | '70-79' | '80+';
  gender: 'all' | Gender;
  allowanceStatus: 'all' | AllowanceStatus;
  paymentMethod: 'all' | PaymentMethod;
  bankName: string;
  postOfficeName: string;
}

export type AuditAction =
  | 'CREATE_CITIZEN'
  | 'UPDATE_CITIZEN'
  | 'DELETE_CITIZEN'
  | 'CREATE_USER'
  | 'UPDATE_USER'
  | 'DELETE_USER'
  | 'CREATE_DIVISION'
  | 'UPDATE_DIVISION'
  | 'DELETE_DIVISION'
  | 'BACKUP_DATA'
  | 'RESTORE_DATA'
  | 'SYNC_STATS';

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  entityType: 'elderly_citizen' | 'user' | 'gn_division' | 'system';
  entityId: string;
  summary: string;
  performedByUid: string;
  performedByName: string;
  performedByRole: UserRole;
  timestamp?: Timestamp | Date | string;
}

export interface GnDivisionStat {
  divisionId: string;
  code: string;
  divisionNameEn: string;
  divisionNameTa: string;
  total: number;
  aged60To69: number;
  aged70Plus: number;
  receivingAllowance: number;
  notReceivingAllowance: number;
  bankRecipients: number;
  postOfficeRecipients: number;
}

export interface PublicStatsSummary {
  totalRegistered: number;
  aged60Plus: number;
  aged60To69: number;
  aged70Plus: number;
  receivingAllowance: number;
  notReceivingAllowance: number;
  bankRecipients: number;
  postOfficeRecipients: number;
  maleCount: number;
  femaleCount: number;
  allowanceStatusCounts: {
    Active: number;
    Suspended: number;
    Pending: number;
    Other: number;
    'Not Applicable': number;
  };
  gnDivisionStats: GnDivisionStat[];
  statsDate: string;
  updatedAt?: Timestamp | Date | string;
}

export type ReportType =
  | 'complete_register'
  | 'age_60_plus'
  | 'age_70_plus'
  | 'allowance_recipients'
  | 'bank_recipients'
  | 'post_office_recipients'
  | 'non_allowance_recipients'
  | 'gn_division_wise'
  | 'gender_wise';

export type AppRoute =
  | 'dashboard'
  | 'citizens'
  | 'divisions'
  | 'reports'
  | 'admin'
  | 'public';
