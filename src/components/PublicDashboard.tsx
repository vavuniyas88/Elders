import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  Building2,
  Landmark,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { db } from '../firebase';
import type { PublicStatsSummary } from '../types';
import { formatTimestamp } from '../utils/calculations';
import { DonutChart, HorizontalComparisonChart } from './Charts';

const EMPTY_STATS: PublicStatsSummary = {
  totalRegistered: 0,
  aged60Plus: 0,
  aged60To69: 0,
  aged70Plus: 0,
  receivingAllowance: 0,
  notReceivingAllowance: 0,
  bankRecipients: 0,
  postOfficeRecipients: 0,
  maleCount: 0,
  femaleCount: 0,
  allowanceStatusCounts: {
    Active: 0,
    Suspended: 0,
    Pending: 0,
    Other: 0,
    'Not Applicable': 0,
  },
  gnDivisionStats: [],
  statsDate: '',
};

export function PublicDashboard({
  onGoToLogin,
  isStaffSignedIn = false,
  onReturnToWorkspace,
}: {
  onGoToLogin: () => void;
  isStaffSignedIn?: boolean;
  onReturnToWorkspace?: () => void;
}) {
  const { lang, setLang, t } = useLanguage();
  const [stats, setStats] = useState<PublicStatsSummary>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [hasPublishedStats, setHasPublishedStats] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'public_stats', 'summary'),
      (snap) => {
        if (snap.exists()) {
          setStats(snap.data() as PublicStatsSummary);
          setHasPublishedStats(true);
        } else {
          setStats(EMPTY_STATS);
          setHasPublishedStats(false);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Public stats listener error:', err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const kpiCards = [
    {
      label: t('kpiTotalRegistered'),
      value: stats.totalRegistered,
      icon: Users,
      accent: 'text-blue-700 bg-blue-50',
    },
    {
      label: t('kpiAged60Plus'),
      value: stats.aged60Plus,
      icon: Users,
      accent: 'text-slate-700 bg-slate-100',
    },
    {
      label: t('kpiAged70Plus'),
      value: stats.aged70Plus,
      icon: Users,
      accent: 'text-indigo-700 bg-indigo-50',
    },
    {
      label: t('kpiReceivingAllowance'),
      value: stats.receivingAllowance,
      icon: Wallet,
      accent: 'text-emerald-700 bg-emerald-50',
    },
    {
      label: t('kpiNotReceivingAllowance'),
      value: stats.notReceivingAllowance,
      icon: Wallet,
      accent: 'text-amber-700 bg-amber-50',
    },
    {
      label: t('kpiBankRecipients'),
      value: stats.bankRecipients,
      icon: Landmark,
      accent: 'text-blue-700 bg-blue-50',
    },
    {
      label: t('kpiPostOfficeRecipients'),
      value: stats.postOfficeRecipients,
      icon: Mail,
      accent: 'text-sky-700 bg-sky-50',
    },
  ];

  const divisionChartData = stats.gnDivisionStats
    .slice()
    .sort((a, b) => b.total - a.total)
    .map((d) => ({
      label: lang === 'ta' ? d.divisionNameTa : d.divisionNameEn,
      subLabel: d.code,
      primary: d.receivingAllowance,
      secondary: d.notReceivingAllowance,
    }));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar Contract: [Brand] — [4 nav links] — [1 primary CTA] */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#overview"
            className="flex items-center gap-2.5 text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            <img
              src="/assets/aistudio/IMG-20261121-WA0000_9601a62d.jpg"
              alt="Manthai West Divisional Secretariat Logo"
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded object-contain bg-white border border-slate-200 p-0.5 shrink-0"
            />
            <span>{t('shortBrand')}</span>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#overview"
              className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              {t('publicOverview')}
            </a>
            <a
              href="#age-groups"
              className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              {t('publicAgeGroups')}
            </a>
            <a
              href="#payments"
              className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              {t('publicPayments')}
            </a>
            <a
              href="#divisions"
              className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              {t('publicDivisions')}
            </a>
          </nav>

          <div className="shrink-0">
            {isStaffSignedIn && onReturnToWorkspace ? (
              <button
                type="button"
                onClick={onReturnToWorkspace}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                {t('navDashboard')}
              </button>
            ) : (
              <button
                type="button"
                onClick={onGoToLogin}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <LockKeyhole className="w-4 h-4" />
                {t('staffSignIn')}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Hero / Official Portal Intro + Workspace Toolbar */}
        <section
          id="overview"
          className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <div className="flex items-center gap-2 text-xs font-medium text-blue-800">
                <span>{t('appTitle')}</span>
                <span aria-hidden="true">·</span>
                <span>{t('appSubtitle')}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight text-balance">
                {t('publicPortalTitle')}
              </h1>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                {t('publicPortalSubtitle')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div
                className="inline-flex items-center p-1 bg-slate-100 rounded-md border border-slate-200"
                role="group"
                aria-label="Language Selector"
              >
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    lang === 'en'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLang('ta')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    lang === 'ta'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  தமிழ்
                </button>
              </div>
              {stats.statsDate && (
                <div className="text-xs text-slate-500 font-mono-tabular">
                  {t('lastSyncedDate')}: {stats.statsDate}
                  {stats.updatedAt ? ` · ${formatTimestamp(stats.updatedAt, true)}` : ''}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-600">
            <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <span>{t('publicPrivacyNotice')}</span>
          </div>
        </section>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="bg-white border border-slate-200 rounded-lg p-5 h-28 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <>
            {!hasPublishedStats && (
              <div className="bg-white border border-slate-200 rounded-lg p-5 text-sm text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <span>{t('noPublicStatsYet')}</span>
                {!isStaffSignedIn && (
                  <button
                    type="button"
                    onClick={onGoToLogin}
                    className="px-4 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap self-start sm:self-auto"
                  >
                    {t('staffSignIn')}
                  </button>
                )}
              </div>
            )}

            {/* Aggregate KPI Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {kpiCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.label}
                    className="bg-white border border-slate-200 rounded-lg p-5 flex items-start justify-between gap-3"
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
                  </div>
                );
              })}
            </section>

            {/* Charts: Age Groups & Payments */}
            <section
              id="age-groups"
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              <DonutChart
                title={t('chartAgeDistribution')}
                subtitle={`${t('aged60To69')} vs ${t('aged70Plus')}`}
                centerLabel={t('kpiAged60Plus')}
                slices={[
                  {
                    label: t('aged60To69'),
                    value: stats.aged60To69,
                    color: '#0284c7',
                  },
                  {
                    label: t('aged70Plus'),
                    value: stats.aged70Plus,
                    color: '#1e3a8a',
                  },
                ]}
              />

              <DonutChart
                title={t('chartAllowanceCoverage')}
                subtitle={`${t('receiving')} vs ${t('notReceiving')}`}
                centerLabel={t('kpiTotalRegistered')}
                slices={[
                  {
                    label: t('receiving'),
                    value: stats.receivingAllowance,
                    color: '#15803d',
                  },
                  {
                    label: t('notReceiving'),
                    value: stats.notReceivingAllowance,
                    color: '#d97706',
                  },
                ]}
              />
            </section>

            <section id="payments" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DonutChart
                title={t('chartPaymentMethods')}
                subtitle={`${t('bankPayment')} vs ${t('postOfficePayment')}`}
                centerLabel={t('receiving')}
                slices={[
                  {
                    label: t('bankPayment'),
                    value: stats.bankRecipients,
                    color: '#1d4ed8',
                  },
                  {
                    label: t('postOfficePayment'),
                    value: stats.postOfficeRecipients,
                    color: '#0ea5e9',
                  },
                ]}
              />

              <DonutChart
                title={t('chartGenderDistribution')}
                subtitle={`${t('male')} vs ${t('female')}`}
                centerLabel={t('kpiTotalRegistered')}
                slices={[
                  { label: t('male'), value: stats.maleCount, color: '#334155' },
                  { label: t('female'), value: stats.femaleCount, color: '#2563eb' },
                ]}
              />
            </section>

            {/* GN Division-Wise Chart & Table */}
            <section id="divisions" className="space-y-6">
              <HorizontalComparisonChart
                title={t('chartGnDivisionWise')}
                subtitle="Top GN Divisions by total elderly population (Allowance vs Non-Allowance)"
                primaryLabel={t('receiving')}
                secondaryLabel={t('notReceiving')}
                primaryColor="#1d4ed8"
                secondaryColor="#cbd5e1"
                data={divisionChartData}
                maxItems={15}
              />

              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-700" />
                    <h3 className="text-sm font-semibold text-slate-900">
                      {t('navDivisions')} — {t('publicOverview')}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 font-mono-tabular">
                    {stats.gnDivisionStats.length} Divisions
                  </span>
                </div>

                {stats.gnDivisionStats.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    {t('noPublicStatsYet')}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                        <tr>
                          <th className="px-4 py-3">{t('divisionCode')}</th>
                          <th className="px-4 py-3">{t('gnDivision')}</th>
                          <th className="px-4 py-3 text-right">{t('totalCitizens')}</th>
                          <th className="px-4 py-3 text-right">{t('aged60To69')}</th>
                          <th className="px-4 py-3 text-right">{t('aged70Plus')}</th>
                          <th className="px-4 py-3 text-right">{t('receiving')}</th>
                          <th className="px-4 py-3 text-right">{t('bank')}</th>
                          <th className="px-4 py-3 text-right">{t('postOffice')}</th>
                          <th className="px-4 py-3 text-right">{t('notReceiving')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {stats.gnDivisionStats.map((d) => (
                          <tr key={d.divisionId} className="hover:bg-slate-50/70">
                            <td className="px-4 py-2.5 font-mono-tabular text-xs text-slate-500">
                              {d.code}
                            </td>
                            <td className="px-4 py-2.5 font-medium text-slate-900">
                              {lang === 'ta' ? d.divisionNameTa : d.divisionNameEn}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-tabular font-semibold text-slate-900">
                              {d.total}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-tabular text-slate-700">
                              {d.aged60To69}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-tabular text-slate-700">
                              {d.aged70Plus}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-tabular text-emerald-700 font-medium">
                              {d.receivingAllowance}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-tabular text-blue-700">
                              {d.bankRecipients}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-tabular text-sky-700">
                              {d.postOfficeRecipients}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-tabular text-amber-700">
                              {d.notReceivingAllowance}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            {t('appTitle')} · {t('appSubtitle')}
          </span>
          <span>Mannar District · Northern Province · Sri Lanka</span>
        </div>
      </footer>
    </div>
  );
}
