import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import type { ElderlyCitizen, GnDivision, ReportType } from '../types';
import {
  calculateAge,
  computePublicStats,
  getLocalIsoDate,
  toDateValue,
} from '../utils/calculations';
import { exportToExcel, exportToPdf, type ExportColumn } from '../utils/exportUtils';

const REPORT_LIST: Array<{ id: ReportType; title: string; subtitle: string }> = [
  {
    id: 'complete_register',
    title: '1. Complete Elderly Citizens Register',
    subtitle: 'All registered elderly citizens in the selected division and period',
  },
  {
    id: 'age_60_plus',
    title: '2. Age 60+ Report',
    subtitle: 'All elderly citizens aged 60 years and above',
  },
  {
    id: 'age_70_plus',
    title: '3. Age 70+ Report',
    subtitle: 'All senior citizens aged 70 years and above',
  },
  {
    id: 'allowance_recipients',
    title: '4. Elderly Allowance Recipients Report',
    subtitle: 'Citizens receiving monthly elderly welfare allowances',
  },
  {
    id: 'bank_recipients',
    title: '5. Bank Payment Recipients Report',
    subtitle: 'Allowance recipients paid through bank branches',
  },
  {
    id: 'post_office_recipients',
    title: '6. Post Office Payment Recipients Report',
    subtitle: 'Allowance recipients paid through Post Offices',
  },
  {
    id: 'non_allowance_recipients',
    title: '7. Non-Allowance Recipients Report',
    subtitle: 'Registered elderly citizens not currently receiving allowances',
  },
  {
    id: 'gn_division_wise',
    title: '8. GN Division-wise Report',
    subtitle: 'Aggregated age, allowance, and payment breakdown per GN division',
  },
  {
    id: 'gender_wise',
    title: '9. Gender-wise Report',
    subtitle: 'Elderly demographic and allowance summary grouped by gender',
  },
];

export function ReportsView({
  citizens,
  divisions,
  referenceDate,
}: {
  citizens: ElderlyCitizen[];
  divisions: GnDivision[];
  referenceDate: Date;
}) {
  const { lang, t } = useLanguage();
  const [selectedReport, setSelectedReport] = useState<ReportType>('complete_register');
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const generatedDate = getLocalIsoDate(referenceDate);

  const dateAndDivisionFiltered = useMemo(() => {
    return citizens.filter((c) => {
      if (selectedDivisionId !== 'all' && c.gnDivisionId !== selectedDivisionId) {
        return false;
      }
      if (dateFrom || dateTo) {
        const created = toDateValue(c.createdAt);
        const createdIso = created ? getLocalIsoDate(created) : '';
        if (!createdIso) return false;
        if (dateFrom && createdIso < dateFrom) return false;
        if (dateTo && createdIso > dateTo) return false;
      }
      return true;
    });
  }, [citizens, selectedDivisionId, dateFrom, dateTo]);

  const { columns, rows, reportMetaTitle } = useMemo<{
    columns: ExportColumn[];
    rows: Array<Record<string, string | number>>;
    reportMetaTitle: string;
  }>(() => {
    const activeReportDef = REPORT_LIST.find((r) => r.id === selectedReport)!;
    const cleanTitle = activeReportDef.title.replace(/^\d+\.\s*/, '');

    if (selectedReport === 'gn_division_wise') {
      const targetDivs =
        selectedDivisionId === 'all'
          ? divisions
          : divisions.filter((d) => d.id === selectedDivisionId);
      const stats = computePublicStats(
        dateAndDivisionFiltered,
        targetDivs,
        referenceDate
      );
      const cols: ExportColumn[] = [
        { header: 'Code', key: 'code' },
        { header: 'GN Division', key: 'division' },
        { header: 'Total Elderly', key: 'total' },
        { header: 'Aged 60-69', key: 'aged60To69' },
        { header: 'Aged 70+', key: 'aged70Plus' },
        { header: 'Allowance Recipients', key: 'receiving' },
        { header: 'Bank Payments', key: 'bank' },
        { header: 'Post Office Payments', key: 'postOffice' },
        { header: 'Not Receiving', key: 'notReceiving' },
      ];
      const mapped = stats.gnDivisionStats.map((d) => ({
        code: d.code,
        division: d.divisionNameEn,
        total: d.total,
        aged60To69: d.aged60To69,
        aged70Plus: d.aged70Plus,
        receiving: d.receivingAllowance,
        bank: d.bankRecipients,
        postOffice: d.postOfficeRecipients,
        notReceiving: d.notReceivingAllowance,
      }));
      return { columns: cols, rows: mapped, reportMetaTitle: cleanTitle };
    }

    if (selectedReport === 'gender_wise') {
      const genders: Array<'Male' | 'Female'> = ['Male', 'Female'];
      const cols: ExportColumn[] = [
        { header: 'Gender', key: 'gender' },
        { header: 'Total Citizens', key: 'total' },
        { header: 'Aged 60-69', key: 'aged60To69' },
        { header: 'Aged 70+', key: 'aged70Plus' },
        { header: 'Receiving Allowance', key: 'receiving' },
        { header: 'Bank Payments', key: 'bank' },
        { header: 'Post Office Payments', key: 'postOffice' },
        { header: 'Not Receiving', key: 'notReceiving' },
      ];
      const mapped = genders.map((g) => {
        const subset = dateAndDivisionFiltered.filter((c) => c.gender === g);
        return {
          gender: g,
          total: subset.length,
          aged60To69: subset.filter((c) => {
            const a = calculateAge(c.dateOfBirth, referenceDate);
            return a >= 60 && a <= 69;
          }).length,
          aged70Plus: subset.filter(
            (c) => calculateAge(c.dateOfBirth, referenceDate) >= 70
          ).length,
          receiving: subset.filter((c) => c.receivingAllowance).length,
          bank: subset.filter(
            (c) => c.receivingAllowance && c.paymentMethod === 'Bank'
          ).length,
          postOffice: subset.filter(
            (c) => c.receivingAllowance && c.paymentMethod === 'Post Office'
          ).length,
          notReceiving: subset.filter((c) => !c.receivingAllowance).length,
        };
      });
      return { columns: cols, rows: mapped, reportMetaTitle: cleanTitle };
    }

    const filteredCitizens = dateAndDivisionFiltered.filter((c) => {
      const age = calculateAge(c.dateOfBirth, referenceDate);
      switch (selectedReport) {
        case 'complete_register':
          return true;
        case 'age_60_plus':
          return age >= 60;
        case 'age_70_plus':
          return age >= 70;
        case 'allowance_recipients':
          return c.receivingAllowance;
        case 'bank_recipients':
          return c.receivingAllowance && c.paymentMethod === 'Bank';
        case 'post_office_recipients':
          return c.receivingAllowance && c.paymentMethod === 'Post Office';
        case 'non_allowance_recipients':
          return !c.receivingAllowance;
        default:
          return true;
      }
    });

    const cols: ExportColumn[] = [
      { header: 'Full Name', key: 'fullName' },
      { header: 'NIC Number', key: 'nicNumber' },
      { header: 'DOB', key: 'dateOfBirth' },
      { header: 'Age', key: 'age' },
      { header: 'Gender', key: 'gender' },
      { header: 'Telephone', key: 'telephone' },
      { header: 'GN Division', key: 'gnDivisionName' },
      { header: 'Welfare Reg No', key: 'welfareRegNumber' },
      { header: 'Allowance', key: 'receiving' },
      { header: 'Payment Channel', key: 'paymentChannel' },
      { header: 'Status', key: 'allowanceStatus' },
    ];

    const mapped = filteredCitizens.map((c) => ({
      fullName: c.fullName,
      nicNumber: c.nicNumber,
      dateOfBirth: c.dateOfBirth,
      age: calculateAge(c.dateOfBirth, referenceDate),
      gender: c.gender,
      telephone: c.telephone,
      gnDivisionName: c.gnDivisionName,
      welfareRegNumber: c.welfareRegNumber || '—',
      receiving: c.receivingAllowance ? 'Yes' : 'No',
      paymentChannel: !c.receivingAllowance
        ? '—'
        : c.paymentMethod === 'Bank'
        ? `${c.bankName} (${c.bankBranch})`
        : c.postOfficeName,
      allowanceStatus: c.allowanceStatus,
    }));

    return { columns: cols, rows: mapped, reportMetaTitle: cleanTitle };
  }, [
    selectedReport,
    selectedDivisionId,
    dateAndDivisionFiltered,
    divisions,
    referenceDate,
  ]);

  const divisionLabel =
    selectedDivisionId === 'all'
      ? 'All GN Divisions'
      : divisions.find((d) => d.id === selectedDivisionId)?.nameEn || 'Selected Division';

  const handleExcel = () => {
    exportToExcel(
      `manthai_west_${selectedReport}_${generatedDate}.xlsx`,
      reportMetaTitle,
      columns,
      rows,
      {
        generatedDate,
        totalCount: rows.length,
        divisionFilter: divisionLabel,
      }
    );
  };

  const handlePdf = () => {
    exportToPdf(
      `manthai_west_${selectedReport}_${generatedDate}.pdf`,
      reportMetaTitle,
      columns,
      rows,
      {
        generatedDate,
        totalCount: rows.length,
        divisionFilter: divisionLabel,
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold app-text">{t('reportsTitle')}</h2>
          <p className="text-sm app-text-subtle mt-0.5">
            Generate official registers and statistical reports in Excel, PDF, or Print format
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-md"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {t('exportExcel')}
          </button>
          <button
            type="button"
            onClick={handlePdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold app-btn-primary rounded-md"
          >
            <FileText className="w-4 h-4" />
            {t('downloadPdf')}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium app-text app-surface border app-border hover:bg-[var(--theme-surface-muted)] rounded-md"
          >
            <Printer className="w-4 h-4" />
            {t('printReport')}
          </button>
        </div>
      </div>

      {/* Report Selector & Filters */}
      <div className="no-print app-card rounded-lg p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium app-text-muted mb-1">
              {t('selectReportType')}
            </label>
            <select
              value={selectedReport}
              onChange={(e) => setSelectedReport(e.target.value as ReportType)}
              className="w-full px-3 py-2 text-sm app-input border rounded-md"
            >
              {REPORT_LIST.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium app-text-muted mb-1">
              {t('filterDivision')}
            </label>
            <select
              value={selectedDivisionId}
              onChange={(e) => setSelectedDivisionId(e.target.value)}
              className="w-full px-3 py-2 text-sm app-input border rounded-md"
            >
              <option value="all">{t('allOption')} GN Divisions</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {lang === 'ta' ? d.nameTa : d.nameEn}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium app-text-muted mb-1">
                {t('dateFrom')}
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-2.5 py-2 text-xs app-input border rounded-md font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium app-text-muted mb-1">
                {t('dateTo')}
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-2.5 py-2 text-xs app-input border rounded-md font-mono-tabular"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Printable Report Sheet */}
      <div className="app-card rounded-lg overflow-hidden print-full-width">
        <div className="app-crest-ribbon" />
        {/* Official Report Header (shown on screen & print) */}
        <div className="px-6 py-5 border-b app-border app-surface-muted">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3.5">
              <img
                src="/assets/aistudio/IMG-20261121-WA0000_9601a62d.jpg"
                alt="Manthai West Divisional Secretariat Logo"
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded object-contain bg-white border app-border p-0.5 shrink-0"
              />
              <div>
                <p className="text-xs font-bold app-accent-text uppercase tracking-wide">
                  {t('appTitle')}
                </p>
                <p className="text-xs app-text-subtle">{t('appSubtitle')}</p>
                <h3 className="mt-1.5 text-lg font-bold app-text">
                  {reportMetaTitle}
                </h3>
              </div>
            </div>
            <div className="text-xs app-text-muted space-y-0.5 sm:text-right font-mono-tabular">
              <div>
                {t('generatedDate')}: <strong className="app-text">{generatedDate}</strong>
              </div>
              <div>
                {t('totalRecords')}: <strong className="app-text">{rows.length}</strong>
              </div>
              <div>GN Division: {divisionLabel}</div>
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm app-text-subtle">
            No records match the selected report filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead className="app-table-head text-xs font-semibold">
                <tr>
                  <th className="px-3 py-2.5 w-10">#</th>
                  {columns.map((col) => (
                    <th key={col.key} className="px-3 py-2.5 whitespace-nowrap">
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--theme-border)]">
                {rows.map((row, idx) => (
                  <tr key={idx} className="app-table-row transition-colors">
                    <td className="px-3 py-2 font-mono-tabular text-xs app-text-subtle">
                      {idx + 1}
                    </td>
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className="px-3 py-2 app-text font-mono-tabular"
                      >
                        {String(row[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
