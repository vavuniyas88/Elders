# Security Specification — Manthai West Elderly Citizen Management System

## 1. Data Invariants
1. **Strict Authentication & Active Staff Gate**: Only authenticated users with an `active` profile in `/users/{uid}` (or the verified bootstrapped Admin `vavuniyas88@gmail.com`) may read or create operational records (`/elderly_citizens`, `/gn_divisions`, `/nic_index`).
2. **Role Separation (Admin vs. Officer)**:
   - Officers (`role: 'user'`) may view records and create new `elderly_citizens` records, but are strictly blocked by Firestore Security Rules from updating or deleting any `elderly_citizens` record, managing `users`, managing `gn_divisions`, viewing `audit_logs`, or deleting `nic_index`.
   - Only Admins (`role: 'admin'`) may update/delete `elderly_citizens`, manage `users`, manage `gn_divisions`, and read `audit_logs`.
3. **Public Privacy Isolation**: Unauthenticated public visitors can ONLY read `/public_stats/summary`, which strictly stores anonymous aggregate counts (`totalRegistered`, `aged60Plus`, `aged70Plus`, `receivingAllowance`, `notReceivingAllowance`, `bankRecipients`, `postOfficeRecipients`, `maleCount`, `femaleCount`, `allowanceStatusCounts`, `gnDivisionStats`). Public access to `/elderly_citizens`, `/users`, `/gn_divisions`, `/nic_index`, and `/audit_logs` is completely denied.
4. **NIC Uniqueness & Referential Integrity**: Creating an `elderly_citizens` record requires a valid existing `gnDivisionId` in `/gn_divisions`, an immutable `createdByUid == request.auth.uid`, server timestamp `request.time`, and an atomic `/nic_index/{nicNumber}` check (`!exists`) to prevent duplicates.
5. **Immutable Audit Trail**: All `/audit_logs/{logId}` entries require `performedByUid == request.auth.uid` and `timestamp == request.time`, and updates/deletes are unconditionally denied (`if false`).

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Citizen Read**: Unauthenticated client executes `list` or `get` on `/elderly_citizens`.
2. **Unauthenticated Public Stats Write**: Unauthenticated client attempts to overwrite `/public_stats/summary` with fabricated counts.
3. **Officer Record Update**: User with `role: 'user'` attempts `updateDoc` on an existing `/elderly_citizens/{id}` document.
4. **Officer Record Delete**: User with `role: 'user'` attempts `deleteDoc` on an existing `/elderly_citizens/{id}` document.
5. **Self Role Escalation**: User with `role: 'user'` attempts `updateDoc` on their own `/users/{uid}` changing `role` from `'user'` to `'admin'`.
6. **Self Activation Bypass**: Inactive user (`status: 'inactive'`) attempts `updateDoc` on their own `/users/{uid}` changing `status` to `'active'`.
7. **Shadow / Ghost Field Injection**: Staff user attempts `create` on `/elderly_citizens/{id}` with all valid fields plus an unexpected field `isVerifiedOverride: true`.
8. **Spoofed Author / Timestamp Forgery**: Staff user creates `/elderly_citizens/{id}` with `createdByUid: 'other_uid'` or a backdated client timestamp `createdAt`.
9. **Orphaned Division Reference**: Staff user creates `/elderly_citizens/{id}` referencing a non-existent `gnDivisionId: 'fake_div_999'`.
10. **Resource Exhaustion (1MB String Poisoning)**: Staff user submits `fullName` or `remarks` exceeding blueprint `maxLength`, or path ID exceeding 128 chars.
11. **Officer Audit Log Read or Tampering**: Non-admin user attempts to `list` `/audit_logs`, or any user attempts to `update` or `delete` an `/audit_logs/{logId}` entry.
12. **PII Leak in Public Stats**: Authenticated staff attempts to inject a `citizenNames` or `nicList` key into `/public_stats/summary`.
