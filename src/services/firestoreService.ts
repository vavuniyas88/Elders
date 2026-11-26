import type { User as FirebaseUser } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  createSecondaryAuthUser,
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import type {
  AuditAction,
  ElderlyCitizen,
  ElderlyCitizenFormInput,
  GnDivision,
  PublicStatsSummary,
  UserProfile,
  UserRole,
  UserStatus,
} from '../types';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  computePublicStats,
  isValidSriLankanNic,
  normalizeNic,
  OFFICIAL_MANTHAI_WEST_DIVISIONS,
  resolveLoginIdentifier,
} from '../utils/calculations';

function makeId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 20)
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}

function buildCitizenDocPayload(
  id: string,
  input: ElderlyCitizenFormInput,
  divisionName: string,
  actor: UserProfile,
  isCreate: boolean,
  existing?: ElderlyCitizen
) {
  const receiving = Boolean(input.receivingAllowance);
  const paymentMethod = receiving ? input.paymentMethod : 'None';
  const isBank = receiving && paymentMethod === 'Bank';
  const isPostOffice = receiving && paymentMethod === 'Post Office';

  return {
    id,
    fullName: input.fullName.trim().slice(0, 150),
    dateOfBirth: input.dateOfBirth.trim(),
    nicNumber: normalizeNic(input.nicNumber),
    gender: input.gender,
    telephone: input.telephone.trim().slice(0, 20),
    gnDivisionId: input.gnDivisionId,
    gnDivisionName: divisionName.slice(0, 120),
    address: input.address.trim().slice(0, 300),
    welfareRegNumber: input.welfareRegNumber.trim().slice(0, 60),
    receivingAllowance: receiving,
    paymentMethod,
    bankName: isBank ? input.bankName.trim().slice(0, 100) : '',
    bankBranch: isBank ? input.bankBranch.trim().slice(0, 100) : '',
    bankAccountNumber: isBank ? input.bankAccountNumber.trim().slice(0, 40) : '',
    postOfficeName: isPostOffice ? input.postOfficeName.trim().slice(0, 100) : '',
    allowanceStatus: receiving ? input.allowanceStatus : 'Not Applicable',
    remarks: input.remarks.trim().slice(0, 500),
    createdByUid: isCreate ? actor.uid : existing!.createdByUid,
    createdByName: isCreate ? actor.fullName.slice(0, 120) : existing!.createdByName,
    updatedByUid: actor.uid,
    updatedByName: actor.fullName.slice(0, 120),
    createdAt: isCreate ? serverTimestamp() : existing!.createdAt,
    updatedAt: serverTimestamp(),
  };
}

export async function ensureUserProfile(
  firebaseUser: FirebaseUser
): Promise<UserProfile | null> {
  const path = `users/${firebaseUser.uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }

    const email = (firebaseUser.email || '').toLowerCase();
    const isBootstrappedAdmin =
      email === BOOTSTRAPPED_ADMIN_EMAIL && firebaseUser.emailVerified;

    if (!firebaseUser.emailVerified && !isBootstrappedAdmin) {
      return null;
    }

    const rawHandle = (email.split('@')[0] || 'officer')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .slice(0, 64);
    const username = rawHandle.length >= 2 ? rawHandle : `staff_${firebaseUser.uid.slice(0, 6)}`;
    const fullName = (firebaseUser.displayName || username).trim().slice(0, 120);

    const profileData = {
      uid: firebaseUser.uid,
      username,
      email: email.slice(0, 150),
      fullName: fullName.length >= 2 ? fullName : 'Secretariat Officer',
      designation: isBootstrappedAdmin
        ? 'Elderly Development Officer (Admin)'
        : 'Authorized Officer',
      phone: '',
      role: (isBootstrappedAdmin ? 'admin' : 'user') as UserRole,
      status: (isBootstrappedAdmin ? 'active' : 'inactive') as UserStatus,
      createdBy: firebaseUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), profileData);
    const createdSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
    return createdSnap.exists() ? (createdSnap.data() as UserProfile) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateOwnUserProfile(
  uid: string,
  updates: { fullName: string; designation: string; phone: string }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      fullName: updates.fullName.trim().slice(0, 120),
      designation: updates.designation.trim().slice(0, 100),
      phone: updates.phone.trim().slice(0, 20),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createCitizenWithNicGuard(
  input: ElderlyCitizenFormInput,
  actor: UserProfile,
  currentCitizens: ElderlyCitizen[],
  divisions: GnDivision[]
): Promise<string> {
  const normalizedNic = normalizeNic(input.nicNumber);
  if (!isValidSriLankanNic(normalizedNic)) {
    throw new Error('Invalid NIC format. Enter 9 digits + V/X or 12 digits.');
  }

  // Friendly pre-check for duplicate NIC
  try {
    const existingNic = await getDoc(doc(db, 'nic_index', normalizedNic));
    if (existingNic.exists()) {
      throw new Error(
        `Duplicate NIC detected: An elderly citizen with NIC ${normalizedNic} is already registered.`
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Duplicate NIC')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.GET, `nic_index/${normalizedNic}`);
  }

  const division = divisions.find((d) => d.id === input.gnDivisionId);
  if (!division) {
    throw new Error('Selected Grama Niladhari Division does not exist.');
  }

  const citizenId = makeId('cit');
  const logId = makeId('log');
  const payload = buildCitizenDocPayload(
    citizenId,
    input,
    division.nameEn,
    actor,
    true
  );

  const localCitizenForStats: ElderlyCitizen = {
    ...(payload as unknown as ElderlyCitizen),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const nextStats = computePublicStats(
    [...currentCitizens, localCitizenForStats],
    divisions
  );

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'elderly_citizens', citizenId), payload);
    batch.set(doc(db, 'nic_index', normalizedNic), {
      nicNumber: normalizedNic,
      citizenId,
      createdByUid: actor.uid,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, 'audit_logs', logId), {
      id: logId,
      action: 'CREATE_CITIZEN' as AuditAction,
      entityType: 'elderly_citizen',
      entityId: citizenId,
      summary: `Registered ${payload.fullName} (NIC: ${normalizedNic}, GN: ${division.nameEn})`.slice(0, 300),
      performedByUid: actor.uid,
      performedByName: actor.fullName.slice(0, 120),
      performedByRole: actor.role,
      timestamp: serverTimestamp(),
    });
    batch.set(doc(db, 'public_stats', 'summary'), {
      ...nextStats,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return citizenId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `elderly_citizens/${citizenId}`);
  }
}

export async function updateCitizenRecord(
  existing: ElderlyCitizen,
  input: ElderlyCitizenFormInput,
  actor: UserProfile,
  currentCitizens: ElderlyCitizen[],
  divisions: GnDivision[]
): Promise<void> {
  const newNic = normalizeNic(input.nicNumber);
  if (!isValidSriLankanNic(newNic)) {
    throw new Error('Invalid NIC format. Enter 9 digits + V/X or 12 digits.');
  }

  const nicChanged = newNic !== existing.nicNumber;
  if (nicChanged) {
    try {
      const existingNicSnap = await getDoc(doc(db, 'nic_index', newNic));
      if (existingNicSnap.exists()) {
        throw new Error(
          `Duplicate NIC detected: Another record already uses NIC ${newNic}.`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Duplicate NIC')) {
        throw error;
      }
      handleFirestoreError(error, OperationType.GET, `nic_index/${newNic}`);
    }
  }

  const division = divisions.find((d) => d.id === input.gnDivisionId);
  if (!division) {
    throw new Error('Selected Grama Niladhari Division does not exist.');
  }

  const payload = buildCitizenDocPayload(
    existing.id,
    input,
    division.nameEn,
    actor,
    false,
    existing
  );

  const updatedList = currentCitizens.map((c) =>
    c.id === existing.id
      ? { ...(payload as unknown as ElderlyCitizen), createdAt: existing.createdAt, updatedAt: new Date() }
      : c
  );
  const nextStats = computePublicStats(updatedList, divisions);
  const logId = makeId('log');

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'elderly_citizens', existing.id), payload);
    if (nicChanged) {
      batch.delete(doc(db, 'nic_index', existing.nicNumber));
      batch.set(doc(db, 'nic_index', newNic), {
        nicNumber: newNic,
        citizenId: existing.id,
        createdByUid: actor.uid,
        createdAt: serverTimestamp(),
      });
    }
    batch.set(doc(db, 'audit_logs', logId), {
      id: logId,
      action: 'UPDATE_CITIZEN' as AuditAction,
      entityType: 'elderly_citizen',
      entityId: existing.id,
      summary: `Updated record for ${payload.fullName} (NIC: ${newNic})`.slice(0, 300),
      performedByUid: actor.uid,
      performedByName: actor.fullName.slice(0, 120),
      performedByRole: actor.role,
      timestamp: serverTimestamp(),
    });
    batch.set(doc(db, 'public_stats', 'summary'), {
      ...nextStats,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `elderly_citizens/${existing.id}`);
  }
}

export async function deleteCitizenRecord(
  citizen: ElderlyCitizen,
  actor: UserProfile,
  currentCitizens: ElderlyCitizen[],
  divisions: GnDivision[]
): Promise<void> {
  const remaining = currentCitizens.filter((c) => c.id !== citizen.id);
  const nextStats = computePublicStats(remaining, divisions);
  const logId = makeId('log');

  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'elderly_citizens', citizen.id));
    batch.delete(doc(db, 'nic_index', citizen.nicNumber));
    batch.set(doc(db, 'audit_logs', logId), {
      id: logId,
      action: 'DELETE_CITIZEN' as AuditAction,
      entityType: 'elderly_citizen',
      entityId: citizen.id,
      summary: `Deleted record for ${citizen.fullName} (NIC: ${citizen.nicNumber})`.slice(0, 300),
      performedByUid: actor.uid,
      performedByName: actor.fullName.slice(0, 120),
      performedByRole: actor.role,
      timestamp: serverTimestamp(),
    });
    batch.set(doc(db, 'public_stats', 'summary'), {
      ...nextStats,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `elderly_citizens/${citizen.id}`);
  }
}

export async function createGnDivision(
  input: {
    code: string;
    nameEn: string;
    nameTa: string;
    gnOfficerName: string;
    gnOfficerPhone: string;
    isActive: boolean;
  },
  actor: UserProfile,
  currentCitizens: ElderlyCitizen[],
  currentDivisions: GnDivision[]
): Promise<void> {
  const id = makeId('gn');
  const logId = makeId('log');
  const newDivPayload = {
    id,
    code: input.code.trim().slice(0, 30),
    nameEn: input.nameEn.trim().slice(0, 100),
    nameTa: input.nameTa.trim().slice(0, 120),
    gnOfficerName: input.gnOfficerName.trim().slice(0, 120),
    gnOfficerPhone: input.gnOfficerPhone.trim().slice(0, 20),
    isActive: input.isActive,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const nextDivisions: GnDivision[] = [
    ...currentDivisions,
    { ...(newDivPayload as unknown as GnDivision), createdAt: new Date(), updatedAt: new Date() },
  ];
  const nextStats = computePublicStats(currentCitizens, nextDivisions);

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'gn_divisions', id), newDivPayload);
    batch.set(doc(db, 'audit_logs', logId), {
      id: logId,
      action: 'CREATE_DIVISION' as AuditAction,
      entityType: 'gn_division',
      entityId: id,
      summary: `Added GN Division ${newDivPayload.code} - ${newDivPayload.nameEn}`.slice(0, 300),
      performedByUid: actor.uid,
      performedByName: actor.fullName.slice(0, 120),
      performedByRole: actor.role,
      timestamp: serverTimestamp(),
    });
    batch.set(doc(db, 'public_stats', 'summary'), {
      ...nextStats,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `gn_divisions/${id}`);
  }
}

export async function updateGnDivision(
  existing: GnDivision,
  input: {
    code: string;
    nameEn: string;
    nameTa: string;
    gnOfficerName: string;
    gnOfficerPhone: string;
    isActive: boolean;
  },
  actor: UserProfile,
  currentCitizens: ElderlyCitizen[],
  currentDivisions: GnDivision[]
): Promise<void> {
  const logId = makeId('log');
  const updatedPayload = {
    id: existing.id,
    code: input.code.trim().slice(0, 30),
    nameEn: input.nameEn.trim().slice(0, 100),
    nameTa: input.nameTa.trim().slice(0, 120),
    gnOfficerName: input.gnOfficerName.trim().slice(0, 120),
    gnOfficerPhone: input.gnOfficerPhone.trim().slice(0, 20),
    isActive: input.isActive,
    createdAt: existing.createdAt,
    updatedAt: serverTimestamp(),
  };

  const nextDivisions = currentDivisions.map((d) =>
    d.id === existing.id
      ? { ...(updatedPayload as unknown as GnDivision), updatedAt: new Date() }
      : d
  );
  const nextStats = computePublicStats(currentCitizens, nextDivisions);

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'gn_divisions', existing.id), updatedPayload);
    batch.set(doc(db, 'audit_logs', logId), {
      id: logId,
      action: 'UPDATE_DIVISION' as AuditAction,
      entityType: 'gn_division',
      entityId: existing.id,
      summary: `Updated GN Division ${updatedPayload.code} - ${updatedPayload.nameEn}`.slice(0, 300),
      performedByUid: actor.uid,
      performedByName: actor.fullName.slice(0, 120),
      performedByRole: actor.role,
      timestamp: serverTimestamp(),
    });
    batch.set(doc(db, 'public_stats', 'summary'), {
      ...nextStats,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `gn_divisions/${existing.id}`);
  }
}

export async function deleteGnDivision(
  division: GnDivision,
  actor: UserProfile,
  currentCitizens: ElderlyCitizen[],
  currentDivisions: GnDivision[]
): Promise<void> {
  const linkedCount = currentCitizens.filter((c) => c.gnDivisionId === division.id).length;
  if (linkedCount > 0) {
    throw new Error(
      `Cannot delete "${division.nameEn}" because ${linkedCount} elderly citizen record(s) are assigned to it.`
    );
  }

  const nextDivisions = currentDivisions.filter((d) => d.id !== division.id);
  const nextStats = computePublicStats(currentCitizens, nextDivisions);
  const logId = makeId('log');

  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'gn_divisions', division.id));
    batch.set(doc(db, 'audit_logs', logId), {
      id: logId,
      action: 'DELETE_DIVISION' as AuditAction,
      entityType: 'gn_division',
      entityId: division.id,
      summary: `Deleted GN Division ${division.code} - ${division.nameEn}`.slice(0, 300),
      performedByUid: actor.uid,
      performedByName: actor.fullName.slice(0, 120),
      performedByRole: actor.role,
      timestamp: serverTimestamp(),
    });
    batch.set(doc(db, 'public_stats', 'summary'), {
      ...nextStats,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `gn_divisions/${division.id}`);
  }
}

export async function seedDefaultGnDivisions(
  actor: UserProfile,
  existingDivisions: GnDivision[],
  currentCitizens: ElderlyCitizen[]
): Promise<number> {
  const existingIds = new Set(existingDivisions.map((d) => d.id));
  const existingCodes = new Set(existingDivisions.map((d) => d.code));
  const linkedDivIds = new Set(currentCitizens.map((c) => c.gnDivisionId));

  // Remove any unlinked legacy placeholder divisions (MW-01..MW-24) if upgrading to MN/01..MN/36
  const legacyToRemove = existingDivisions.filter(
    (d) => d.code.startsWith('MW-') && !linkedDivIds.has(d.id)
  );
  const legacyRemovedIds = new Set(legacyToRemove.map((d) => d.id));

  const missing = OFFICIAL_MANTHAI_WEST_DIVISIONS.filter(
    (d) => !existingIds.has(d.id) && !existingCodes.has(d.code)
  );
  if (missing.length === 0 && legacyToRemove.length === 0) return 0;

  const addedDivisions: GnDivision[] = [];
  const batch = writeBatch(db);

  for (const oldDiv of legacyToRemove) {
    batch.delete(doc(db, 'gn_divisions', oldDiv.id));
  }

  for (const item of missing) {
    const payload = {
      id: item.id,
      code: item.code,
      nameEn: item.nameEn,
      nameTa: item.nameTa,
      gnOfficerName: item.gnOfficerName,
      gnOfficerPhone: item.gnOfficerPhone,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    batch.set(doc(db, 'gn_divisions', item.id), payload);
    addedDivisions.push({
      ...(payload as unknown as GnDivision),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const logId = makeId('log');
  batch.set(doc(db, 'audit_logs', logId), {
    id: logId,
    action: 'CREATE_DIVISION' as AuditAction,
    entityType: 'gn_division',
    entityId: 'manthai_west_seed',
    summary: `Initialized ${missing.length} Manthai West GN Divisions (MN/01–MN/36)`.slice(0, 300),
    performedByUid: actor.uid,
    performedByName: actor.fullName.slice(0, 120),
    performedByRole: actor.role,
    timestamp: serverTimestamp(),
  });

  const remainingExisting = existingDivisions.filter(
    (d) => !legacyRemovedIds.has(d.id)
  );
  const nextStats = computePublicStats(currentCitizens, [
    ...remainingExisting,
    ...addedDivisions,
  ]);
  batch.set(doc(db, 'public_stats', 'summary'), {
    ...nextStats,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return missing.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'gn_divisions');
  }
}

export async function createStaffUserAccount(
  input: {
    username: string;
    email?: string;
    password: string;
    fullName: string;
    designation: string;
    phone: string;
    role: UserRole;
    status: UserStatus;
  },
  actor: UserProfile
): Promise<void> {
  const cleanUsername = input.username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (cleanUsername.length < 2) {
    throw new Error('Username must be at least 2 alphanumeric characters.');
  }
  const authEmail = input.email?.trim()
    ? input.email.trim().toLowerCase()
    : resolveLoginIdentifier(cleanUsername);

  const uid = await createSecondaryAuthUser(authEmail, input.password);
  const logId = makeId('log');

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', uid), {
      uid,
      username: cleanUsername.slice(0, 64),
      email: authEmail.slice(0, 150),
      fullName: input.fullName.trim().slice(0, 120),
      designation: input.designation.trim().slice(0, 100),
      phone: input.phone.trim().slice(0, 20),
      role: input.role,
      status: input.status,
      createdBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'audit_logs', logId), {
      id: logId,
      action: 'CREATE_USER' as AuditAction,
      entityType: 'user',
      entityId: uid,
      summary: `Created ${input.role} account "${cleanUsername}" (${input.fullName.trim()})`.slice(0, 300),
      performedByUid: actor.uid,
      performedByName: actor.fullName.slice(0, 120),
      performedByRole: actor.role,
      timestamp: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${uid}`);
  }
}

export async function updateStaffUserProfile(
  target: UserProfile,
  updates: {
    fullName: string;
    designation: string;
    phone: string;
    role: UserRole;
    status: UserStatus;
  },
  actor: UserProfile
): Promise<void> {
  const logId = makeId('log');
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', target.uid), {
      ...target,
      fullName: updates.fullName.trim().slice(0, 120),
      designation: updates.designation.trim().slice(0, 100),
      phone: updates.phone.trim().slice(0, 20),
      role: updates.role,
      status: updates.status,
      createdAt: target.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'audit_logs', logId), {
      id: logId,
      action: 'UPDATE_USER' as AuditAction,
      entityType: 'user',
      entityId: target.uid,
      summary: `Updated user ${target.username}: role=${updates.role}, status=${updates.status}`.slice(0, 300),
      performedByUid: actor.uid,
      performedByName: actor.fullName.slice(0, 120),
      performedByRole: actor.role,
      timestamp: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${target.uid}`);
  }
}

export async function deleteStaffUserProfile(
  target: UserProfile,
  actor: UserProfile
): Promise<void> {
  if (target.uid === actor.uid) {
    throw new Error('You cannot delete your own active administrator account.');
  }
  const logId = makeId('log');
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', target.uid));
    batch.set(doc(db, 'audit_logs', logId), {
      id: logId,
      action: 'DELETE_USER' as AuditAction,
      entityType: 'user',
      entityId: target.uid,
      summary: `Removed staff user profile "${target.username}" (${target.fullName})`.slice(0, 300),
      performedByUid: actor.uid,
      performedByName: actor.fullName.slice(0, 120),
      performedByRole: actor.role,
      timestamp: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${target.uid}`);
  }
}

export async function syncPublicStats(
  citizens: ElderlyCitizen[],
  divisions: GnDivision[],
  actor?: UserProfile
): Promise<PublicStatsSummary> {
  const stats = computePublicStats(citizens, divisions);
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'public_stats', 'summary'), {
      ...stats,
      updatedAt: serverTimestamp(),
    });
    if (actor) {
      const logId = makeId('log');
      batch.set(doc(db, 'audit_logs', logId), {
        id: logId,
        action: 'SYNC_STATS' as AuditAction,
        entityType: 'system',
        entityId: 'public_stats_summary',
        summary: `Synchronized public aggregated statistics (${stats.totalRegistered} records)`.slice(0, 300),
        performedByUid: actor.uid,
        performedByName: actor.fullName.slice(0, 120),
        performedByRole: actor.role,
        timestamp: serverTimestamp(),
      });
    }
    await batch.commit();
    return { ...stats, updatedAt: new Date() };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'public_stats/summary');
  }
}

export async function recordBackupExportLog(
  actor: UserProfile,
  citizenCount: number,
  divisionCount: number
): Promise<void> {
  const logId = makeId('log');
  try {
    await setDoc(doc(db, 'audit_logs', logId), {
      id: logId,
      action: 'BACKUP_DATA' as AuditAction,
      entityType: 'system',
      entityId: 'backup_export',
      summary: `Exported system backup (${citizenCount} citizens, ${divisionCount} GN divisions)`.slice(0, 300),
      performedByUid: actor.uid,
      performedByName: actor.fullName.slice(0, 120),
      performedByRole: actor.role,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `audit_logs/${logId}`);
  }
}

export interface SystemBackupPayload {
  version: string;
  exportedAt: string;
  system: string;
  gnDivisions: Array<{
    id: string;
    code: string;
    nameEn: string;
    nameTa: string;
    gnOfficerName?: string;
    gnOfficerPhone?: string;
    isActive?: boolean;
  }>;
  elderlyCitizens: Array<ElderlyCitizenFormInput & { id?: string }>;
}

export async function restoreSystemBackup(
  backup: SystemBackupPayload,
  existingDivisions: GnDivision[],
  existingCitizens: ElderlyCitizen[],
  actor: UserProfile
): Promise<{ divisionsAdded: number; citizensAdded: number; citizensSkipped: number }> {
  if (
    !backup ||
    !Array.isArray(backup.gnDivisions) ||
    !Array.isArray(backup.elderlyCitizens)
  ) {
    throw new Error('Invalid backup JSON file structure.');
  }

  // 1. Restore missing GN Divisions first
  const divMap = new Map(existingDivisions.map((d) => [d.id, d]));
  let divisionsAdded = 0;
  const divBatch = writeBatch(db);
  for (const rawDiv of backup.gnDivisions) {
    if (!rawDiv.id || !rawDiv.nameEn || !rawDiv.code) continue;
    if (!divMap.has(rawDiv.id)) {
      const payload = {
        id: rawDiv.id.slice(0, 128),
        code: rawDiv.code.slice(0, 30),
        nameEn: rawDiv.nameEn.slice(0, 100),
        nameTa: (rawDiv.nameTa || rawDiv.nameEn).slice(0, 120),
        gnOfficerName: (rawDiv.gnOfficerName || '').slice(0, 120),
        gnOfficerPhone: (rawDiv.gnOfficerPhone || '').slice(0, 20),
        isActive: rawDiv.isActive !== false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      divBatch.set(doc(db, 'gn_divisions', payload.id), payload);
      divMap.set(payload.id, {
        ...(payload as unknown as GnDivision),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      divisionsAdded += 1;
    }
  }

  try {
    if (divisionsAdded > 0) {
      await divBatch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'gn_divisions');
  }

  // 2. Restore Citizens (skipping duplicate NICs)
  const existingNicSet = new Set(existingCitizens.map((c) => c.nicNumber));
  let existingNicSnapSet = new Set<string>();
  try {
    const nicDocs = await getDocs(collection(db, 'nic_index'));
    existingNicSnapSet = new Set(nicDocs.docs.map((d) => d.id));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'nic_index');
  }

  let citizensAdded = 0;
  let citizensSkipped = 0;
  const restoredCitizens: ElderlyCitizen[] = [...existingCitizens];

  // Chunk into batches of 150 citizens (300 writes per batch, safe under 500 limit)
  const validToInsert: Array<{ citizenId: string; nic: string; payload: ReturnType<typeof buildCitizenDocPayload> }> = [];

  for (const item of backup.elderlyCitizens) {
    const nic = normalizeNic(item.nicNumber || '');
    if (!isValidSriLankanNic(nic) || existingNicSet.has(nic) || existingNicSnapSet.has(nic)) {
      citizensSkipped += 1;
      continue;
    }
    const div = divMap.get(item.gnDivisionId);
    if (!div) {
      citizensSkipped += 1;
      continue;
    }
    existingNicSet.add(nic);
    const citizenId =
      item.id && /^[a-zA-Z0-9_-]{1,128}$/.test(item.id)
        ? item.id
        : makeId('cit');
    const payload = buildCitizenDocPayload(citizenId, item, div.nameEn, actor, true);
    validToInsert.push({ citizenId, nic, payload });
    restoredCitizens.push({
      ...(payload as unknown as ElderlyCitizen),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  for (let i = 0; i < validToInsert.length; i += 150) {
    const chunk = validToInsert.slice(i, i + 150);
    const batch = writeBatch(db);
    for (const entry of chunk) {
      batch.set(doc(db, 'elderly_citizens', entry.citizenId), entry.payload);
      batch.set(doc(db, 'nic_index', entry.nic), {
        nicNumber: entry.nic,
        citizenId: entry.citizenId,
        createdByUid: actor.uid,
        createdAt: serverTimestamp(),
      });
      citizensAdded += 1;
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'elderly_citizens');
    }
  }

  // 3. Refresh Public Stats & Audit Log
  const allDivisions = Array.from(divMap.values());
  const nextStats = computePublicStats(restoredCitizens, allDivisions);
  const logId = makeId('log');
  try {
    const finalBatch = writeBatch(db);
    finalBatch.set(doc(db, 'public_stats', 'summary'), {
      ...nextStats,
      updatedAt: serverTimestamp(),
    });
    finalBatch.set(doc(db, 'audit_logs', logId), {
      id: logId,
      action: 'RESTORE_DATA' as AuditAction,
      entityType: 'system',
      entityId: 'backup_restore',
      summary: `Restored backup: +${divisionsAdded} divisions, +${citizensAdded} citizens (${citizensSkipped} skipped)`.slice(0, 300),
      performedByUid: actor.uid,
      performedByName: actor.fullName.slice(0, 120),
      performedByRole: actor.role,
      timestamp: serverTimestamp(),
    });
    await finalBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'public_stats/summary');
  }

  return { divisionsAdded, citizensAdded, citizensSkipped };
}
