import React, { useEffect, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  DatabaseBackup,
  Edit3,
  History,
  KeyRound,
  RefreshCw,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  createStaffUserAccount,
  deleteStaffUserProfile,
  recordBackupExportLog,
  restoreSystemBackup,
  syncPublicStats,
  updateStaffUserProfile,
  type SystemBackupPayload,
} from '../services/firestoreService';
import type {
  AuditLogEntry,
  ElderlyCitizen,
  GnDivision,
  UserProfile,
  UserRole,
  UserStatus,
} from '../types';
import { formatTimestamp, getLocalIsoDate } from '../utils/calculations';

export function AdminManagementView({
  currentUser,
  citizens,
  divisions,
}: {
  currentUser: UserProfile;
  citizens: ElderlyCitizen[];
  divisions: GnDivision[];
}) {
  const { t } = useLanguage();
  const [subTab, setSubTab] = useState<'users' | 'audit' | 'backup'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditFilter, setAuditFilter] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  // User Modal state
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [designation, setDesignation] = useState('Authorized Officer');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [status, setStatus] = useState<UserStatus>('active');

  useEffect(() => {
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        setUsers(snap.docs.map((d) => d.data() as UserProfile));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    const logsQuery = query(
      collection(db, 'audit_logs'),
      orderBy('timestamp', 'desc'),
      limit(200)
    );
    const unsubLogs = onSnapshot(
      logsQuery,
      (snap) => {
        setAuditLogs(snap.docs.map((d) => d.data() as AuditLogEntry));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'audit_logs')
    );

    return () => {
      unsubUsers();
      unsubLogs();
    };
  }, []);

  const hasAdminUsernameAccount = users.some(
    (u) => u.username.trim().toLowerCase() === 'admin'
  );

  const openCreateUser = () => {
    setEditingUser(null);
    setUsername('');
    setEmail('');
    setPassword('');
    setFullName('');
    setDesignation('Authorized Officer');
    setPhone('');
    setRole('user');
    setStatus('active');
    setUserModalOpen(true);
  };

  const openSetupAdminUsername = () => {
    setEditingUser(null);
    setUsername('admin');
    setEmail('');
    setPassword('');
    setFullName('System Administrator');
    setDesignation('Administrator');
    setPhone('');
    setRole('admin');
    setStatus('active');
    setUserModalOpen(true);
  };

  const openEditUser = (u: UserProfile) => {
    setEditingUser(u);
    setUsername(u.username);
    setEmail(u.email);
    setPassword('');
    setFullName(u.fullName);
    setDesignation(u.designation);
    setPhone(u.phone);
    setRole(u.role);
    setStatus(u.status);
    setUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setBusy(true);
    try {
      if (editingUser) {
        await updateStaffUserProfile(
          editingUser,
          { fullName, designation, phone, role, status },
          currentUser
        );
        setFeedback({
          type: 'success',
          msg: `Updated staff account "${editingUser.username}".`,
        });
      } else {
        const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
        if (cleanUsername.length < 2) {
          throw new Error('Username must be at least 2 alphanumeric characters.');
        }
        if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
          throw new Error(`Username "${cleanUsername}" is already assigned to another staff account.`);
        }
        if (password.length < 6) {
          throw new Error('Initial password must be at least 6 characters.');
        }
        await createStaffUserAccount(
          {
            username: cleanUsername,
            email,
            password,
            fullName,
            designation,
            phone,
            role,
            status,
          },
          currentUser
        );
        setFeedback({
          type: 'success',
          msg: `Created ${role} account "${cleanUsername}". They can now sign in with username "${cleanUsername}" and their assigned password.`,
        });
      }
      setUserModalOpen(false);
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (
        code === 'auth/operation-not-allowed' ||
        code === 'auth/admin-restricted-operation'
      ) {
        setFeedback({
          type: 'error',
          msg: 'Email/Password sign-in must be enabled in Firebase Console (Authentication -> Sign-in method -> Email/Password) before creating username/password accounts.',
        });
      } else if (code === 'auth/email-already-in-use') {
        setFeedback({
          type: 'error',
          msg: 'That login email/username already exists in Firebase Authentication. Use a different email/username or manage the existing account in Firebase Console -> Authentication.',
        });
      } else if (code === 'auth/weak-password') {
        setFeedback({
          type: 'error',
          msg: 'Password is too weak. Please enter a password with at least 6 characters.',
        });
      } else {
        setFeedback({
          type: 'error',
          msg: err instanceof Error ? err.message : 'Failed to save user account.',
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setBusy(true);
    setFeedback(null);
    try {
      await deleteStaffUserProfile(deletingUser, currentUser);
      setFeedback({
        type: 'success',
        msg: `Removed staff user profile "${deletingUser.username}".`,
      });
      setDeletingUser(null);
    } catch (err) {
      setFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Failed to delete user.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleUserStatus = async (u: UserProfile) => {
    if (u.uid === currentUser.uid) {
      setFeedback({
        type: 'error',
        msg: 'You cannot deactivate your own active administrator session.',
      });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const nextStatus: UserStatus = u.status === 'active' ? 'inactive' : 'active';
      await updateStaffUserProfile(
        u,
        {
          fullName: u.fullName,
          designation: u.designation,
          phone: u.phone,
          role: u.role,
          status: nextStatus,
        },
        currentUser
      );
      setFeedback({
        type: 'success',
        msg: `User "${u.username}" is now ${nextStatus}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Failed to change user status.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadBackup = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const payload: SystemBackupPayload = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        system: 'Manthai West Elderly Citizen Management System',
        gnDivisions: divisions.map((d) => ({
          id: d.id,
          code: d.code,
          nameEn: d.nameEn,
          nameTa: d.nameTa,
          gnOfficerName: d.gnOfficerName,
          gnOfficerPhone: d.gnOfficerPhone,
          isActive: d.isActive,
        })),
        elderlyCitizens: citizens.map((c) => ({
          id: c.id,
          fullName: c.fullName,
          dateOfBirth: c.dateOfBirth,
          nicNumber: c.nicNumber,
          gender: c.gender,
          telephone: c.telephone,
          gnDivisionId: c.gnDivisionId,
          address: c.address,
          welfareRegNumber: c.welfareRegNumber,
          receivingAllowance: c.receivingAllowance,
          paymentMethod: c.paymentMethod,
          bankName: c.bankName,
          bankBranch: c.bankBranch,
          bankAccountNumber: c.bankAccountNumber,
          postOfficeName: c.postOfficeName,
          allowanceStatus: c.allowanceStatus,
          remarks: c.remarks,
        })),
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `manthai_west_ecms_backup_${getLocalIsoDate()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await recordBackupExportLog(currentUser, citizens.length, divisions.length);
      setFeedback({
        type: 'success',
        msg: `Exported JSON backup (${citizens.length} citizens, ${divisions.length} GN divisions).`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Backup export failed.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setFeedback(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as SystemBackupPayload;
      const result = await restoreSystemBackup(parsed, divisions, citizens, currentUser);
      setFeedback({
        type: 'success',
        msg: `Restore complete: Added ${result.divisionsAdded} GN division(s) and ${result.citizensAdded} citizen record(s) (${result.citizensSkipped} duplicate/invalid skipped).`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Failed to restore backup file.',
      });
    } finally {
      e.target.value = '';
      setBusy(false);
    }
  };

  const handleSyncPublic = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const synced = await syncPublicStats(citizens, divisions, currentUser);
      setFeedback({
        type: 'success',
        msg: `Public dashboard statistics synchronized (${synced.totalRegistered} total citizens).`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Failed to sync public statistics.',
      });
    } finally {
      setBusy(false);
    }
  };

  const filteredLogs = auditLogs.filter((l) => {
    if (!auditFilter.trim()) return true;
    const q = auditFilter.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      l.summary.toLowerCase().includes(q) ||
      l.performedByName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{t('navAdmin')}</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage authorized staff accounts, audit trail, and database backups
          </p>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="bg-white border border-slate-200 rounded-lg p-1.5 inline-flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setSubTab('users')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors ${
            subTab === 'users'
              ? 'bg-blue-700 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          {t('userManagement')}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('audit')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors ${
            subTab === 'audit'
              ? 'bg-blue-700 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <History className="w-4 h-4" />
          {t('auditLogs')}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('backup')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors ${
            subTab === 'backup'
              ? 'bg-blue-700 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <DatabaseBackup className="w-4 h-4" />
          {t('backupRestore')}
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-md border flex items-start gap-2.5 text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* TAB 1: User Management */}
      {subTab === 'users' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {t('userManagement')}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Only active Admin and User accounts can access private citizen records.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!hasAdminUsernameAccount && (
                <button
                  type="button"
                  onClick={openSetupAdminUsername}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md"
                >
                  <KeyRound className="w-4 h-4" />
                  Setup &quot;admin&quot; Username Login
                </button>
              )}
              <button
                type="button"
                onClick={openCreateUser}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md"
              >
                <UserPlus className="w-4 h-4" />
                {t('createUser')}
              </button>
            </div>
          </div>

          {!hasAdminUsernameAccount && (
            <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900">
              <span>
                No username-based <strong>admin</strong> login account exists yet. Click{' '}
                <strong>Setup &quot;admin&quot; Username Login</strong> to assign a password for signing
                in with username <code className="font-mono-tabular font-semibold">admin</code>{' '}
                (requires Email/Password enabled in Firebase Console).
              </span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Full Name</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-900">{u.fullName}</div>
                      <div className="text-[11px] text-slate-400">{u.designation}</div>
                    </td>
                    <td className="px-4 py-2.5 font-mono-tabular text-xs text-slate-700">
                      {u.username}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{u.email}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-800">
                      {u.role === 'admin' ? t('roleAdmin') : t('roleUser')}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium">
                      <button
                        type="button"
                        disabled={busy || u.uid === currentUser.uid}
                        onClick={() => handleToggleUserStatus(u)}
                        className={`underline decoration-dotted disabled:no-underline ${
                          u.status === 'active'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {u.status === 'active' ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditUser(u)}
                          className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                          title={t('edit')}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {u.uid !== currentUser.uid && (
                          <button
                            type="button"
                            onClick={() => setDeletingUser(u)}
                            className="p-1.5 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded"
                            title={t('delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Audit Logs */}
      {subTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {t('auditLogs')}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Immutable system log of record additions, updates, deletions, and admin actions
              </p>
            </div>
            <input
              type="text"
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
              placeholder="Filter logs by user or action..."
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-md w-full sm:w-64"
            />
          </div>

          {filteredLogs.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No audit log entries recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Performed By</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-mono-tabular text-xs text-slate-500 whitespace-nowrap">
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td className="px-4 py-2.5 font-mono-tabular text-xs font-semibold text-slate-800 whitespace-nowrap">
                        {log.action}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-700 whitespace-nowrap">
                        {log.performedByName} ({log.performedByRole})
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-700">
                        {log.summary}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Backup, Restore & Public Stats Sync */}
      {subTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                1. Data Backup (Export JSON)
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Download a complete snapshot of all GN divisions and elderly citizen
                records ({citizens.length} records) as an offline JSON backup file.
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={handleDownloadBackup}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md"
            >
              <DatabaseBackup className="w-4 h-4" />
              {t('downloadBackup')}
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                2. Data Restore (Import JSON)
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Restore GN divisions and elderly citizen records from a previously
                exported JSON backup. Existing NIC numbers are safely skipped to prevent
                duplicates.
              </p>
            </div>
            <label className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>{t('restoreBackup')}</span>
              <input
                type="file"
                accept=".json,application/json"
                disabled={busy}
                onChange={handleRestoreFile}
                className="hidden"
              />
            </label>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                3. {t('syncPublicStats')}
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Recompute anonymous age-group, allowance, and GN division totals from
                the main database and publish them to the Public Portal.
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={handleSyncPublic}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md"
            >
              <RefreshCw className="w-4 h-4" />
              {t('syncPublicStats')}
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit User Modal */}
      {userModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingUser ? `Edit User: ${editingUser.username}` : t('createUser')}
              </h3>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingUser)}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. edo_officer1"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular disabled:bg-slate-50"
                  />
                </div>

                {!editingUser && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Email (Optional — auto-mapped if blank)
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={`${username.trim().toLowerCase() || 'username'}@manthaiwest.gov.lk`}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Initial Password *
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                      />
                    </div>
                    <div className="sm:col-span-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600">
                      Login identifier:{' '}
                      <span className="font-mono-tabular font-semibold text-slate-900">
                        {username.trim().toLowerCase() || 'username'}
                      </span>{' '}
                      (Firebase Auth email:{' '}
                      <span className="font-mono-tabular text-slate-800">
                        {email.trim()
                          ? email.trim().toLowerCase()
                          : `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'username'}@manthaiwest.gov.lk`}
                      </span>
                      )
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Role *
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="user">{t('roleUser')}</option>
                    <option value="admin">{t('roleAdmin')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Status *
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as UserStatus)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md"
                >
                  {busy ? 'Saving...' : t('saveRecord')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation */}
      {deletingUser && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-50 text-red-700 rounded-md shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Delete User Account
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  Are you sure you want to remove{' '}
                  <strong>
                    {deletingUser.fullName} ({deletingUser.username})
                  </strong>
                  ? They will immediately lose access to the system.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleDeleteUser}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md"
              >
                {busy ? 'Deleting...' : t('confirmDeleteBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
