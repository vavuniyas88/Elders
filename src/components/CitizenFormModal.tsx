import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import type {
  AllowanceStatus,
  ElderlyCitizen,
  ElderlyCitizenFormInput,
  Gender,
  GnDivision,
  PaymentMethod,
} from '../types';
import {
  calculateAge,
  getAgeGroupLabel,
  getLocalIsoDate,
  isValidPhone,
  isValidSriLankanNic,
  normalizeNic,
} from '../utils/calculations';

const INITIAL_INPUT: ElderlyCitizenFormInput = {
  fullName: '',
  dateOfBirth: '',
  nicNumber: '',
  gender: 'Male',
  telephone: '',
  gnDivisionId: '',
  address: '',
  welfareRegNumber: '',
  receivingAllowance: false,
  paymentMethod: 'None',
  bankName: '',
  bankBranch: '',
  bankAccountNumber: '',
  postOfficeName: '',
  allowanceStatus: 'Not Applicable',
  remarks: '',
};

export function CitizenFormModal({
  isOpen,
  onClose,
  divisions,
  existingCitizens,
  editingCitizen,
  referenceDate,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  divisions: GnDivision[];
  existingCitizens: ElderlyCitizen[];
  editingCitizen: ElderlyCitizen | null;
  referenceDate: Date;
  onSave: (input: ElderlyCitizenFormInput, editing: ElderlyCitizen | null) => Promise<void>;
}) {
  const { lang, t } = useLanguage();
  const [form, setForm] = useState<ElderlyCitizenFormInput>(INITIAL_INPUT);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setSuccessMsg('');
    if (editingCitizen) {
      setForm({
        fullName: editingCitizen.fullName,
        dateOfBirth: editingCitizen.dateOfBirth,
        nicNumber: editingCitizen.nicNumber,
        gender: editingCitizen.gender,
        telephone: editingCitizen.telephone,
        gnDivisionId: editingCitizen.gnDivisionId,
        address: editingCitizen.address,
        welfareRegNumber: editingCitizen.welfareRegNumber,
        receivingAllowance: editingCitizen.receivingAllowance,
        paymentMethod: editingCitizen.paymentMethod,
        bankName: editingCitizen.bankName,
        bankBranch: editingCitizen.bankBranch,
        bankAccountNumber: editingCitizen.bankAccountNumber,
        postOfficeName: editingCitizen.postOfficeName,
        allowanceStatus: editingCitizen.allowanceStatus,
        remarks: editingCitizen.remarks,
      });
    } else {
      const sorted = divisions
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code));
      setForm({
        ...INITIAL_INPUT,
        gnDivisionId: sorted[0]?.id ?? '',
      });
    }
  }, [isOpen, editingCitizen, divisions]);

  const computedAge = useMemo(
    () => (form.dateOfBirth ? calculateAge(form.dateOfBirth, referenceDate) : null),
    [form.dateOfBirth, referenceDate]
  );

  const ageCategory = computedAge !== null ? getAgeGroupLabel(computedAge) : '—';

  if (!isOpen) return null;

  const activeDivisions = divisions
    .filter((d) => d.isActive || d.id === form.gnDivisionId)
    .sort((a, b) => a.code.localeCompare(b.code));

  const handleToggleAllowance = (receiving: boolean) => {
    if (receiving) {
      setForm((prev) => ({
        ...prev,
        receivingAllowance: true,
        paymentMethod: prev.paymentMethod === 'None' ? 'Bank' : prev.paymentMethod,
        allowanceStatus:
          prev.allowanceStatus === 'Not Applicable' ? 'Active' : prev.allowanceStatus,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        receivingAllowance: false,
        paymentMethod: 'None',
        bankName: '',
        bankBranch: '',
        bankAccountNumber: '',
        postOfficeName: '',
        allowanceStatus: 'Not Applicable',
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (form.fullName.trim().length < 2) {
      setErrorMsg('Full Name is required (minimum 2 characters).');
      return;
    }
    if (!form.dateOfBirth || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(form.dateOfBirth)) {
      setErrorMsg('Please enter a valid Date of Birth.');
      return;
    }
    if (form.dateOfBirth > getLocalIsoDate(referenceDate)) {
      setErrorMsg('Date of Birth cannot be in the future.');
      return;
    }
    const age = calculateAge(form.dateOfBirth, referenceDate);
    if (age < 60) {
      setErrorMsg(
        `Calculated age is ${age} years. Only citizens aged 60 and above can be registered in the Elderly Citizen Management System.`
      );
      return;
    }

    const nic = normalizeNic(form.nicNumber);
    if (!isValidSriLankanNic(nic)) {
      setErrorMsg(
        'Invalid NIC format. Enter 9 digits + V/X (e.g. 521451234V) or 12 digits (e.g. 195214501234).'
      );
      return;
    }

    const duplicate = existingCitizens.find(
      (c) => c.nicNumber === nic && c.id !== editingCitizen?.id
    );
    if (duplicate) {
      setErrorMsg(
        `Duplicate NIC detected: ${duplicate.fullName} is already registered with NIC ${nic}.`
      );
      return;
    }

    if (!isValidPhone(form.telephone)) {
      setErrorMsg('Please enter a valid telephone number (9–15 digits).');
      return;
    }
    if (!form.gnDivisionId) {
      setErrorMsg('Please select a Grama Niladhari Division.');
      return;
    }
    if (form.address.trim().length < 3) {
      setErrorMsg('Residential Address is required.');
      return;
    }

    if (form.receivingAllowance) {
      if (form.paymentMethod !== 'Bank' && form.paymentMethod !== 'Post Office') {
        setErrorMsg('Please select a Payment Method (Bank or Post Office).');
        return;
      }
      if (form.paymentMethod === 'Bank') {
        if (!form.bankName.trim() || !form.bankBranch.trim()) {
          setErrorMsg('Bank Name and Bank Branch are required for Bank payments.');
          return;
        }
      }
      if (form.paymentMethod === 'Post Office' && !form.postOfficeName.trim()) {
        setErrorMsg('Post Office Name is required for Post Office payments.');
        return;
      }
      if (form.allowanceStatus === 'Not Applicable') {
        setErrorMsg('Please select a valid Allowance Status.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await onSave(
        {
          ...form,
          nicNumber: nic,
        },
        editingCitizen
      );
      setSuccessMsg(
        editingCitizen
          ? 'Elderly citizen record updated successfully.'
          : 'Elderly citizen registered successfully.'
      );
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to save citizen record.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="app-card rounded-lg w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        <div className="app-crest-ribbon w-full shrink-0" />
        <div className="px-6 py-4 border-b app-border flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 className="text-lg font-bold app-text">
              {editingCitizen ? t('editCitizen') : t('registerCitizen')}
            </h2>
            <p className="text-xs app-text-subtle mt-0.5">
              {t('appTitle')} · Automatic age &amp; duplicate NIC verification enabled
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 app-text-subtle hover:app-text rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-md flex items-start gap-2.5 text-sm text-red-800 dark:text-red-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-md flex items-start gap-2.5 text-sm text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {divisions.length === 0 && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-md text-sm text-amber-900 dark:text-amber-200">
              No Grama Niladhari Divisions exist yet. An Administrator must initialize or
              add GN Divisions under the <strong>GN Divisions</strong> tab first.
            </div>
          )}

          {/* Section 1: Personal Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold app-text pb-2 border-b app-border">
              1. {t('personalInfoSection')}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium app-text-muted mb-1">
                  {t('fullName')} <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Enter full legal name"
                  className="app-input w-full px-3 py-2 text-sm border rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-medium app-text-muted mb-1">
                  {t('dateOfBirth')} <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  max={getLocalIsoDate(referenceDate)}
                  value={form.dateOfBirth}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                  className="app-input w-full px-3 py-2 text-sm border rounded-md font-mono-tabular"
                />
              </div>

              <div>
                <label className="block text-xs font-medium app-text-muted mb-1">
                  {t('calculatedAge')}
                </label>
                <div className="px-3 py-2 text-sm app-surface-muted border app-border rounded-md flex items-center justify-between">
                  <span className="font-mono-tabular font-semibold app-text">
                    {computedAge !== null ? `${computedAge} ${t('yearsOld')}` : '—'}
                  </span>
                  <span className="text-xs font-medium app-accent-text">
                    {t('ageCategory')}: {ageCategory}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium app-text-muted mb-1">
                  {t('nicNumber')} <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={12}
                  value={form.nicNumber}
                  onChange={(e) =>
                    setForm({ ...form, nicNumber: e.target.value.toUpperCase() })
                  }
                  placeholder="521451234V or 195214501234"
                  className="app-input w-full px-3 py-2 text-sm border rounded-md font-mono-tabular"
                />
                <p className="mt-1 text-[11px] app-text-subtle">{t('nicHelper')}</p>
              </div>

              <div>
                <label className="block text-xs font-medium app-text-muted mb-1">
                  {t('gender')} <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value as Gender })}
                  className="app-input w-full px-3 py-2 text-sm border rounded-md"
                >
                  <option value="Male">{t('male')}</option>
                  <option value="Female">{t('female')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium app-text-muted mb-1">
                  {t('telephone')} <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  required
                  maxLength={20}
                  value={form.telephone}
                  onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                  placeholder="0771234567"
                  className="app-input w-full px-3 py-2 text-sm border rounded-md font-mono-tabular"
                />
              </div>

              <div>
                <label className="block text-xs font-medium app-text-muted mb-1">
                  {t('gnDivision')} <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <select
                  required
                  value={form.gnDivisionId}
                  onChange={(e) => setForm({ ...form, gnDivisionId: e.target.value })}
                  className="app-input w-full px-3 py-2 text-sm border rounded-md"
                >
                  <option value="">{t('selectGnDivision')}</option>
                  {activeDivisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} — {lang === 'ta' ? d.nameTa : d.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium app-text-muted mb-1">
                  {t('address')} <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={300}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Street, Village, GN Division"
                  className="app-input w-full px-3 py-2 text-sm border rounded-md"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Welfare Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold app-text pb-2 border-b app-border">
              2. {t('welfareInfoSection')}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium app-text-muted mb-1">
                  {t('welfareRegNumber')}
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={form.welfareRegNumber}
                  onChange={(e) =>
                    setForm({ ...form, welfareRegNumber: e.target.value })
                  }
                  placeholder="e.g. MW/WEL/2026/0012"
                  className="app-input w-full px-3 py-2 text-sm border rounded-md font-mono-tabular"
                />
              </div>

              <div>
                <label className="block text-xs font-medium app-text-muted mb-1">
                  {t('isReceivingAllowance')} <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <div className="inline-flex items-center p-1 app-surface-muted rounded-md border app-border w-full">
                  <button
                    type="button"
                    onClick={() => handleToggleAllowance(true)}
                    className={`flex-1 py-1.5 text-sm font-medium rounded transition-colors ${
                      form.receivingAllowance
                        ? 'app-btn-primary'
                        : 'app-text-muted hover:app-text'
                    }`}
                  >
                    {t('yes')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAllowance(false)}
                    className={`flex-1 py-1.5 text-sm font-medium rounded transition-colors ${
                      !form.receivingAllowance
                        ? 'bg-slate-800 dark:bg-slate-600 text-white'
                        : 'app-text-muted hover:app-text'
                    }`}
                  >
                    {t('no')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Conditional Allowance & Payment Fields */}
          {form.receivingAllowance && (
            <div className="space-y-4 app-surface-muted border app-border rounded-lg p-4">
              <h3 className="text-sm font-semibold app-text pb-2 border-b app-border">
                3. {t('allowanceInfoSection')}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium app-text-muted mb-1">
                    {t('paymentMethod')} <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => {
                      const method = e.target.value as PaymentMethod;
                      setForm((prev) => ({
                        ...prev,
                        paymentMethod: method,
                        bankName: method === 'Bank' ? prev.bankName : '',
                        bankBranch: method === 'Bank' ? prev.bankBranch : '',
                        bankAccountNumber:
                          method === 'Bank' ? prev.bankAccountNumber : '',
                        postOfficeName:
                          method === 'Post Office' ? prev.postOfficeName : '',
                      }));
                    }}
                    className="app-input w-full px-3 py-2 text-sm border rounded-md"
                  >
                    <option value="Bank">{t('bank')}</option>
                    <option value="Post Office">{t('postOffice')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium app-text-muted mb-1">
                    {t('allowanceStatus')} <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <select
                    value={form.allowanceStatus}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        allowanceStatus: e.target.value as AllowanceStatus,
                      })
                    }
                    className="app-input w-full px-3 py-2 text-sm border rounded-md"
                  >
                    <option value="Active">{t('statusActive')}</option>
                    <option value="Pending">{t('statusPending')}</option>
                    <option value="Suspended">{t('statusSuspended')}</option>
                    <option value="Other">{t('statusOther')}</option>
                  </select>
                </div>

                {form.paymentMethod === 'Bank' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium app-text-muted mb-1">
                        {t('bankName')} <span className="text-red-600 dark:text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={100}
                        value={form.bankName}
                        onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                        placeholder="e.g. Bank of Ceylon / People's Bank"
                        className="app-input w-full px-3 py-2 text-sm border rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium app-text-muted mb-1">
                        {t('bankBranch')} <span className="text-red-600 dark:text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={100}
                        value={form.bankBranch}
                        onChange={(e) => setForm({ ...form, bankBranch: e.target.value })}
                        placeholder="e.g. Adampan / Mannar"
                        className="app-input w-full px-3 py-2 text-sm border rounded-md"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium app-text-muted mb-1">
                        {t('bankAccountNumber')}
                      </label>
                      <input
                        type="text"
                        maxLength={40}
                        value={form.bankAccountNumber}
                        onChange={(e) =>
                          setForm({ ...form, bankAccountNumber: e.target.value })
                        }
                        placeholder="Account Number"
                        className="app-input w-full px-3 py-2 text-sm border rounded-md font-mono-tabular"
                      />
                    </div>
                  </>
                )}

                {form.paymentMethod === 'Post Office' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium app-text-muted mb-1">
                      {t('postOfficeName')} <span className="text-red-600 dark:text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={form.postOfficeName}
                      onChange={(e) =>
                        setForm({ ...form, postOfficeName: e.target.value })
                      }
                      placeholder="e.g. Adampan Post Office / Vidathaltheevu Sub-Post Office"
                      className="app-input w-full px-3 py-2 text-sm border rounded-md"
                    />
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium app-text-muted mb-1">
                    {t('remarks')}
                  </label>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={form.remarks}
                    onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                    placeholder="Additional notes regarding allowance or verification"
                    className="app-input w-full px-3 py-2 text-sm border rounded-md"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t app-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium app-text-muted app-surface border app-border hover:app-surface-muted rounded-md transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || divisions.length === 0}
              className="app-btn-primary px-5 py-2 text-sm font-semibold disabled:opacity-60 rounded-md transition-colors"
            >
              {submitting
                ? 'Saving...'
                : editingCitizen
                ? t('updateRecord')
                : t('saveRecord')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
