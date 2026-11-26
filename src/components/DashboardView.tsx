import React, { useMemo } from 'react';
import {
  Landmark,
  Mail,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import type {
  CitizenCategoryTab,
  ElderlyCitizen,
  GnDivision,
} from '../types';
import {
  calculateAge,
  computePublicStats,
  formatTimestamp,
  toDateValue,
} from '../utils/calculations';
import { DonutChart, HorizontalComparisonChart } from './Charts';

export function DashboardView({
  citizens,
  divisions,
  referenceDate,
  onOpenRegister,
  onNavigateToCategory,
}: {
  citizens: ElderlyCitizen[];
  divisions: GnDivision[];
  referenceDate: Date;
  onOpenRegister: () => void;
  onNavigateToCategory: (cat: CitizenCategoryTab) => void;
}) {
  const { lang, t } = useLanguage();

  const stats = useMemo(
    () => computePublicStats(citizens, divisions, referenceDate),
    [citizens, divisions, referenceDate]
  );

  const recentCitizens = useMemo(() => {
    return citizens
      .slice()
      .sort((a, b) => {
        const da = toDateValue(a.createdAt)?.getTime() ?? 0;
        const dbTime = toDateValue(b.createdAt)?.getTime() ?? 0;
        return dbTime - da;
      })
      .slice(0, 6);
  }, [citizens]);

  // Recent 30-day registrations count
  const recent30DaysCount = useMemo(() => {
    const cutoff = referenceDate.getTime() - 30 * 24 * 60 * 60 * 1000;
    return citizens.filter((c) => {
      const dt = toDateValue(c.createdAt)?.getTime() ?? 0;
      return dt >= cutoff;
    }).length;
  }, [citizens, referenceDate]);

  const kpiCards: Array<{
    label: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
    category?: CitizenCategoryTab;
  }> = [
    {
      label: t('kpiTotalRegistered'),
      value: stats.totalRegistered,
      icon: Users,
      accent: 'text-blue-700 bg-blue-50',
      category: 'all_60_plus',
    },
    {
      label: t('kpiAged60Plus'),
      value: stats.aged60Plus,
      icon: Users,
      accent: 'text-slate-700 bg-slate-100',
      category: 'all_60_plus',
    },
    {
      label: t('kpiAged70Plus'),
      value: stats.aged70Plus,
      icon: Users,
      accent: 'text-indigo-700 bg-indigo-50',
      category: 'aged_70_plus',
    },
    {
      label: t('kpiReceivingAllowance'),
      value: stats.receivingAllowance,
      icon: Wallet,
      accent: 'text-emerald-700 bg-emerald-50',
      category: 'allowance_recipients',
    },
    {
      label: t('kpiNotReceivingAllowance'),
      value: stats.notReceivingAllowance,
      icon: Wallet,
      accent: 'text-amber-700 bg-amber-50',
      category: 'non_allowance_70_plus',
    },
    {
      label: t('kpiBankRecipients'),
      value: stats.bankRecipients,
      icon: Landmark,
      accent: 'text-blue-700 bg-blue-50',
      category: 'bank_recipients',
    },
    {
      label: t('kpiPostOfficeRecipients'),
      value: stats.postOfficeRecipients,
      icon: Mail,
      accent: 'text-sky-700 bg-sky-50',
      category: 'post_office_recipients',
    },
  ];

  const divisionChartData = useMemo(() => {
    return stats.gnDivisionStats
      .slice()
      .sort((a, b) => b.total - a.total)
      .map((d) => ({
        label: lang === 'ta' ? d.divisionNameTa : d.divisionNameEn,
        subLabel: d.code,
        primary: d.receivingAllowance,
        secondary: d.notReceivingAllowance,
      }));
  }, [stats.gnDivisionStats, lang]);

  return (
    <div className="space-y-6">
      {/* Top Action Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{t('navDashboard')}</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {t('appTitle')} · {recent30DaysCount} new registration(s) in the last 30 days
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenRegister}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          {t('registerCitizen')}
        </button>
      </div>

      {/* 7 Required KPI Statistic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => card.category && onNavigateToCategory(card.category)}
              className="text-left bg-white border border-slate-200 hover:border-blue-300 rounded-lg p-5 flex items-start justify-between gap-3 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 leading-snug">
                  {card.label}
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900 font-mono-tabular">
                  {card.value.toLocaleString()}
                </p>
              </div>
              <div className={`p-2 rounded-md shrink-0 ${card.accent}`}>
                <Icon className="w-4 h-4" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Pie / Donut Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DonutChart
          title={t('chartAgeDistribution')}
          subtitle={`${t('aged60To69')} vs ${t('aged70Plus')}`}
          centerLabel={t('kpiAged60Plus')}
          slices={[
            { label: t('aged60To69'), value: stats.aged60To69, color: '#0284c7' },
            { label: t('aged70Plus'), value: stats.aged70Plus, color: '#1e3a8a' },
          ]}
        />

        <DonutChart
          title={t('chartPaymentMethods')}
          subtitle={`${t('bankPayment')} vs ${t('postOfficePayment')}`}
          centerLabel={t('receiving')}
          slices={[
            { label: t('bankPayment'), value: stats.bankRecipients, color: '#1d4ed8' },
            {
              label: t('postOfficePayment'),
              value: stats.postOfficeRecipients,
              color: '#0ea5e9',
            },
            {
              label: t('notReceiving'),
              value: stats.notReceivingAllowance,
              color: '#cbd5e1',
            },
          ]}
        />
      </div>

      {/* Bar Charts: GN Division-Wise & Allowance Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HorizontalComparisonChart
          title={t('chartGnDivisionWise')}
          subtitle="Receiving allowance vs Not receiving across GN divisions"
          primaryLabel={t('receiving')}
          secondaryLabel={t('notReceiving')}
          primaryColor="#1d4ed8"
          secondaryColor="#cbd5e1"
          data={divisionChartData}
          maxItems={10}
        />

        <DonutChart
          title={t('allowanceStatus')}
          subtitle={`${t('male')}: ${stats.maleCount} · ${t('female')}: ${stats.femaleCount}`}
          centerLabel={t('kpiTotalRegistered')}
          slices={[
            {
              label: t('statusActive'),
              value: stats.allowanceStatusCounts.Active,
              color: '#15803d',
            },
            {
              label: t('statusPending'),
              value: stats.allowanceStatusCounts.Pending,
              color: '#d97706',
            },
            {
              label: t('statusSuspended'),
              value: stats.allowanceStatusCounts.Suspended,
              color: '#dc2626',
            },
            {
              label: t('statusOther'),
              value: stats.allowanceStatusCounts.Other,
              color: '#64748b',
            },
            {
              label: t('statusNotApplicable'),
              value: stats.allowanceStatusCounts['Not Applicable'],
              color: '#e2e8f0',
            },
          ]}
        />
      </div>

      {/* Recent Registrations Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-slate-900">
            {t('recentRegistrations')}
          </h3>
          <button
            type="button"
            onClick={() => onNavigateToCategory('all_60_plus')}
            className="text-xs font-medium text-blue-700 hover:underline"
          >
            View All Records &rarr;
          </button>
        </div>

        {recentCitizens.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-slate-500">
              No elderly citizens have been registered yet.
            </p>
            <button
              type="button"
              onClick={onOpenRegister}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              {t('registerFirstCitizen')}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">{t('fullName')}</th>
                  <th className="px-4 py-3">{t('nicNumber')}</th>
                  <th className="px-4 py-3 text-right">{t('sortAge')}</th>
                  <th className="px-4 py-3">{t('gnDivision')}</th>
                  <th className="px-4 py-3">{t('paymentMethod')}</th>
                  <th className="px-4 py-3">Registered On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentCitizens.map((c) => {
                  const age = calculateAge(c.dateOfBirth, referenceDate);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        {c.fullName}
                      </td>
                      <td className="px-4 py-2.5 font-mono-tabular text-xs text-slate-700">
                        {c.nicNumber}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono-tabular text-slate-900">
                        {age}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {c.gnDivisionName}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {c.receivingAllowance ? c.paymentMethod : t('no')}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 font-mono-tabular">
                        {formatTimestamp(c.createdAt, false)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
