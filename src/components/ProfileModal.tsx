import React, { useState } from 'react';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { AlertCircle, CheckCircle2, KeyRound, User, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { auth } from '../firebase';
import { updateOwnUserProfile } from '../services/firestoreService';
import type { UserProfile } from '../types';

export function ProfileModal({
  isOpen,
  onClose,
  profile,
  onProfileUpdated,
}: {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onProfileUpdated: (updated: UserProfile) => void;
}) {
  const { t } = useLanguage();
  const [fullName, setFullName] = useState(profile.fullName);
  const [designation, setDesignation] = useState(profile.designation);
  const [phone, setPhone] = useState(profile.phone);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(
    null
  );

  if (!isOpen) return null;

  const hasPasswordProvider = Boolean(
    auth.currentUser?.providerData.some((p) => p.providerId === 'password')
  );

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (fullName.trim().length < 2) {
      setFeedback({ type: 'error', msg: 'Full name must be at least 2 characters.' });
      return;
    }
    setBusy(true);
    try {
      await updateOwnUserProfile(profile.uid, { fullName, designation, phone });
      onProfileUpdated({
        ...profile,
        fullName: fullName.trim(),
        designation: designation.trim(),
        phone: phone.trim(),
      });
      setFeedback({ type: 'success', msg: 'Profile updated successfully.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Failed to update profile.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!auth.currentUser) return;
    if (newPassword.length < 6) {
      setFeedback({
        type: 'error',
        msg: 'New password must be at least 6 characters.',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', msg: 'New passwords do not match.' });
      return;
    }

    setBusy(true);
    try {
      if (hasPasswordProvider && auth.currentUser.email && currentPassword) {
        const cred = EmailAuthProvider.credential(
          auth.currentUser.email,
          currentPassword
        );
        await reauthenticateWithCredential(auth.currentUser, cred);
      }
      await updatePassword(auth.currentUser, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFeedback({ type: 'success', msg: 'Password changed successfully.' });
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code === 'auth/requires-recent-login') {
        setFeedback({
          type: 'error',
          msg: 'For security, please sign out and sign in again before changing your password.',
        });
      } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setFeedback({
          type: 'error',
          msg: 'Current password is incorrect.',
        });
      } else {
        setFeedback({
          type: 'error',
          msg: err instanceof Error ? err.message : 'Failed to change password.',
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="app-card rounded-lg w-full max-w-lg overflow-hidden my-auto">
        <div className="app-crest-ribbon w-full" />
        <div className="px-6 py-4 border-b app-border flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold app-text">
              {t('profileSettings')}
            </h3>
            <p className="text-xs app-text-subtle mt-0.5 font-mono-tabular">
              {profile.username} · {profile.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 app-text-subtle hover:app-text rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {feedback && (
            <div
              className={`p-3 rounded-md border flex items-start gap-2 text-xs ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200'
                  : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60 text-red-800 dark:text-red-200'
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

          {/* Profile Info Form */}
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold app-text">
              <User className="w-4 h-4 app-accent-text" />
              <span>Account Profile ({profile.role === 'admin' ? t('roleAdmin') : t('roleUser')})</span>
            </div>
            <div>
              <label className="block text-xs font-medium app-text-muted mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="app-input w-full px-3 py-2 text-sm border rounded-md"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium app-text-muted mb-1">
                  Designation
                </label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="app-input w-full px-3 py-2 text-sm border rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium app-text-muted mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="app-input w-full px-3 py-2 text-sm border rounded-md font-mono-tabular"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={busy}
                className="app-btn-primary px-4 py-2 text-xs font-semibold rounded-md transition-colors"
              >
                Update Profile
              </button>
            </div>
          </form>

          {/* Change Password Section */}
          <form
            onSubmit={handleChangePassword}
            className="pt-5 border-t app-border space-y-3"
          >
            <div className="flex items-center gap-2 text-xs font-semibold app-text">
              <KeyRound className="w-4 h-4 app-accent-text" />
              <span>Change Password</span>
            </div>

            {!hasPasswordProvider ? (
              <p className="text-xs app-text-subtle">
                You signed in using Google Authentication. Manage your password through
                your Google Account security settings.
              </p>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium app-text-muted mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="app-input w-full px-3 py-2 text-sm border rounded-md"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium app-text-muted mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="app-input w-full px-3 py-2 text-sm border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium app-text-muted mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="app-input w-full px-3 py-2 text-sm border rounded-md"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-4 py-2 text-xs font-semibold app-text app-surface-muted hover:opacity-90 border app-border rounded-md transition-colors"
                  >
                    Update Password
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
