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
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-lg overflow-hidden my-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {t('profileSettings')}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-mono-tabular">
              {profile.username} · {profile.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {feedback && (
            <div
              className={`p-3 rounded-md border flex items-start gap-2 text-xs ${
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

          {/* Profile Info Form */}
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <User className="w-4 h-4 text-blue-700" />
              <span>Account Profile ({profile.role === 'admin' ? t('roleAdmin') : t('roleUser')})</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md"
              >
                Update Profile
              </button>
            </div>
          </form>

          {/* Change Password Section */}
          <form
            onSubmit={handleChangePassword}
            className="pt-5 border-t border-slate-200 space-y-3"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <KeyRound className="w-4 h-4 text-blue-700" />
              <span>Change Password</span>
            </div>

            {!hasPasswordProvider ? (
              <p className="text-xs text-slate-500">
                You signed in using Google Authentication. Manage your password through
                your Google Account security settings.
              </p>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md"
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
