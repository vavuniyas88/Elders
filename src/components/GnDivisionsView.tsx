import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit3,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  createGnDivision,
  deleteGnDivision,
  seedDefaultGnDivisions,
  updateGnDivision,
} from '../services/firestoreService';
import type { ElderlyCitizen, GnDivision, UserProfile } from '../types';
import { computePublicStats, getLocalIsoDate } from '../utils/calculations';
import { exportToExcel, exportToPdf } from '../utils/exportUtils';

export function GnDivisionsView({
  divisions,
  citizens,
  currentUser,
  referenceDate,
}: {
  divisions: GnDivision[];
  citizens: ElderlyCitizen[];
  currentUser: UserProfile;
  referenceDate: Date;
}) {
  const { lang, t } = useLanguage();
  const isAdmin = currentUser.role === 'admin';

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GnDivision | null>(null);
  const [deleting, setDeleting] = useState<GnDivision | null>(null);
  const [code, setCode] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [gnOfficerName, setGnOfficerName] = useState('');
  const [gnOfficerPhone, setGnOfficerPhone] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(
    null
  );

  const stats = useMemo(
    () => computePublicStats(citizens, divisions, referenceDate),
    [citizens, divisions, referenceDate]
  );

  const statByDivisionId = useMemo(
    () => new Map(stats.gnDivisionStats.map((s) => [s.divisionId, s])),
    [stats.gnDivisionStats]
  );

  const openAdd = () => {
    setEditing(null);
    setCode('');
    setNameEn('');
    setNameTa('');
    setGnOfficerName('');
    setGnOfficerPhone('');
    setIsActive(true);
    setModalOpen(true);
  };

  const openEdit = (div: GnDivision) => {
    setEditing(div);
    setCode(div.code);
    setNameEn(div.nameEn);
    setNameTa(div.nameTa);
    setGnOfficerName(div.gnOfficerName);
    setGnOfficerPhone(div.gnOfficerPhone);
    setIsActive(div.isActive);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!code.trim() || !nameEn.trim() || !nameTa.trim()) {
      setFeedback({
        type: 'error',
        msg: 'Division Code, English Name, and Tamil Name are required.',
      });
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await updateGnDivision(
          editing,
          { code, nameEn, nameTa, gnOfficerName, gnOfficerPhone, isActive },
          currentUser,
          citizens,
          divisions
        );
        setFeedback({ type: 'success', msg: `Updated GN Division ${nameEn}.` });
      } else {
        await createGnDivision(
          { code, nameEn, nameTa, gnOfficerName, gnOfficerPhone, isActive },
          currentUser,
          citizens,
          divisions
        );
        setFeedback({ type: 'success', msg: `Added GN Division ${nameEn}.` });
      }
      setModalOpen(false);
    } catch (err) {
      setFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Failed to save GN division.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setFeedback(null);
    try {
      await deleteGnDivision(deleting, currentUser, citizens, divisions);
      setFeedback({ type: 'success', msg: `Deleted GN Division ${deleting.nameEn}.` });
      setDeleting(null);
    } catch (err) {
      setFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Unable to delete GN division.',
      });
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const handleSeedDivisions = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const count = await seedDefaultGnDivisions(currentUser, divisions, citizens);
      setFeedback({
        type: 'success',
        msg:
          count > 0
            ? `Initialized ${count} Manthai West GN Divisions.`
            : 'All default Manthai West GN Divisions are already present.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Failed to initialize GN divisions.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleExportDivisionReport = (format: 'xlsx' | 'pdf') => {
    const columns = [
      { header: 'Code', key: 'code' },
      { header: 'GN Division', key: 'name' },
      { header: 'Total Elderly', key: 'total' },
      { header: 'Aged 60-69', key: 'aged60To69' },
      { header: 'Aged 70+', key: 'aged70Plus' },
      { header: 'Receiving Allowance', key: 'receiving' },
      { header: 'Bank Recipients', key: 'bank' },
      { header: 'Post Office Recipients', key: 'postOffice' },
      { header: 'Not Receiving', key: 'notReceiving' },
    ];
    const rows = stats.gnDivisionStats.map((s) => ({
      code: s.code,
      name: s.divisionNameEn,
      total: s.total,
      aged60To69: s.aged60To69,
      aged70Plus: s.aged70Plus,
      receiving: s.receivingAllowance,
      bank: s.bankRecipients,
      postOffice: s.postOfficeRecipients,
      notReceiving: s.notReceivingAllowance,
    }));
    const meta = {
      generatedDate: getLocalIsoDate(referenceDate),
      totalCount: rows.length,
    };
    if (format === 'xlsx') {
      exportToExcel(
        `manthai_west_gn_division_report_${meta.generatedDate}.xlsx`,
        'GN Division-Wise Elderly Statistics Report',
        columns,
        rows,
        meta
      );
    } else {
      exportToPdf(
        `manthai_west_gn_division_report_${meta.generatedDate}.pdf`,
        'GN Division-Wise Elderly Statistics Report',
        columns,
        rows,
        meta
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{t('navDivisions')}</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Grama Niladhari divisions and real-time division-wise elderly welfare statistics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleExportDivisionReport('xlsx')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md"
          >
            <Download className="w-3.5 h-3.5" />
            Excel
          </button>
          <button
            type="button"
            onClick={() => handleExportDivisionReport('pdf')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md"
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
          {isAdmin && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={handleSeedDivisions}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-800 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-md"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {t('loadDefaultDivisions')}
              </button>
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md"
              >
                <Plus className="w-4 h-4" />
                {t('addGnDivision')}
              </button>
            </>
          )}
        </div>
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

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {divisions.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-slate-500">
              No Grama Niladhari Divisions configured yet.
            </p>
            {isAdmin && (
              <button
                type="button"
                disabled={busy}
                onClick={handleSeedDivisions}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md"
              >
                <Plus className="w-4 h-4" />
                {t('loadDefaultDivisions')}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">{t('divisionCode')}</th>
                  <th className="px-4 py-3">{t('gnDivision')}</th>
                  <th className="px-4 py-3">{t('gnOfficerName')}</th>
                  <th className="px-4 py-3 text-right">{t('totalCitizens')}</th>
                  <th className="px-4 py-3 text-right">{t('aged60To69')}</th>
                  <th className="px-4 py-3 text-right">{t('aged70Plus')}</th>
                  <th className="px-4 py-3 text-right">{t('receiving')}</th>
                  <th className="px-4 py-3 text-right">{t('bank')}</th>
                  <th className="px-4 py-3 text-right">{t('postOffice')}</th>
                  <th className="px-4 py-3 text-right">{t('notReceiving')}</th>
                  {isAdmin && <th className="px-4 py-3 text-right">{t('actions')}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {divisions
                  .slice()
                  .sort((a, b) => a.code.localeCompare(b.code))
                  .map((div) => {
                    const s = statByDivisionId.get(div.id);
                    return (
                      <tr key={div.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 font-mono-tabular text-xs text-slate-600">
                          {div.code}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-slate-900">
                            {lang === 'ta' ? div.nameTa : div.nameEn}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {lang === 'ta' ? div.nameEn : div.nameTa}
                            {!div.isActive ? ' · Inactive' : ''}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">
                          <div>{div.gnOfficerName || '—'}</div>
                          {div.gnOfficerPhone && (
                            <div className="font-mono-tabular text-slate-400">
                              {div.gnOfficerPhone}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono-tabular font-semibold text-slate-900">
                          {s?.total ?? 0}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono-tabular text-slate-700">
                          {s?.aged60To69 ?? 0}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono-tabular text-slate-700">
                          {s?.aged70Plus ?? 0}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono-tabular text-emerald-700 font-medium">
                          {s?.receivingAllowance ?? 0}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono-tabular text-blue-700">
                          {s?.bankRecipients ?? 0}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono-tabular text-sky-700">
                          {s?.postOfficeRecipients ?? 0}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono-tabular text-amber-700">
                          {s?.notReceivingAllowance ?? 0}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-2.5 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(div)}
                                className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                                title={t('edit')}
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleting(div)}
                                className="p-1.5 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded"
                                title={t('delete')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Division Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editing ? t('editGnDivision') : t('addGnDivision')}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t('divisionCode')} *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={30}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="MW-25"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Active Division
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t('divisionNameEn')} *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="Adampan"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t('divisionNameTa')} *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={nameTa}
                    onChange={(e) => setNameTa(e.target.value)}
                    placeholder="அடம்பன்"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t('gnOfficerName')}
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    value={gnOfficerName}
                    onChange={(e) => setGnOfficerName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t('gnOfficerPhone')}
                  </label>
                  <input
                    type="text"
                    maxLength={20}
                    value={gnOfficerPhone}
                    onChange={(e) => setGnOfficerPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono-tabular"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
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

      {/* Delete Division Confirmation */}
      {deleting && (
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
                  Delete GN Division
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  Are you sure you want to delete{' '}
                  <strong>
                    {deleting.code} — {deleting.nameEn}
                  </strong>
                  ? Divisions with assigned citizens cannot be deleted.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleDelete}
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
