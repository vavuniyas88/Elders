import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  Building2,
  Landmark,
  LockKeyhole,
  Mail,
  Users,
  Wallet,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { db } from '../firebase';
import type { PublicStatsSummary } from '../types';
import { DonutChart, HorizontalComparisonChart } from './Charts';
import { ThemeSwitcher } from './ThemeSwitcher';

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
      accent: 'app-accent-text app-accent-soft',
    },
    {
      label: t('kpiAged60Plus'),
      value: stats.aged60Plus,
      icon: Users,
      accent: 'app-text-muted app-surface-muted',
    },
    {
      label: t('kpiAged70Plus'),
      value: stats.aged70Plus,
      icon: Users,
      accent: 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50',
    },
    {
      label: t('kpiReceivingAllowance'),
      value: stats.receivingAllowance,
      icon: Wallet,
      accent: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50',
    },
    {
      label: t('kpiNotReceivingAllowance'),
      value: stats.notReceivingAllowance,
      icon: Wallet,
      accent: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50',
    },
    {
      label: t('kpiBankRecipients'),
      value: stats.bankRecipients,
      icon: Landmark,
      accent: 'app-accent-text app-accent-soft',
    },
    {
      label: t('kpiPostOfficeRecipients'),
      value: stats.postOfficeRecipients,
      icon: Mail,
      accent: 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50',
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
    <div className="min-h-screen app-canvas">
      {/* Top Bar: Brand — Nav Links — Theme, Language & Primary CTA */}
      <header className="app-surface border-b app-border sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <a
            href="#overview"
            className="flex items-center gap-2.5 text-sm sm:text-base font-bold tracking-tight app-text whitespace-nowrap min-w-0"
          >
            <img
              src="/assets/aistudio/IMG-20261121-WA0000_9601a62d.jpg"
              alt="Divisional Secretariat, Manthai West Logo"
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded object-contain bg-white border app-border p-0.5 shrink-0"
            />
            <span className="truncate">{t('shortBrand')}</span>
          </a>

          <nav className="hidden xl:flex items-center gap-5 text-sm font-medium app-text-muted">
            <a
              href="#overview"
              className="hover:app-accent-text transition-colors whitespace-nowrap shrink-0"
            >
              {t('publicOverview')}
            </a>
            <a
              href="#age-groups"
              className="hover:app-accent-text transition-colors whitespace-nowrap shrink-0"
            >
              {t('publicAgeGroups')}
            </a>
            <a
              href="#payments"
              className="hover:app-accent-text transition-colors whitespace-nowrap shrink-0"
            >
              {t('publicPayments')}
            </a>
            <a
              href="#divisions"
              className="hover:app-accent-text transition-colors whitespace-nowrap shrink-0"
            >
              {t('publicDivisions')}
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <ThemeSwitcher />

            <div
              className="inline-flex items-center p-0.5 app-surface-muted rounded-md border app-border"
              role="group"
              aria-label="Language Selector"
            >
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2 sm:px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  lang === 'en'
                    ? 'app-surface app-text shadow-xs'
                    : 'app-text-muted'
                }`}
              >
                <span className="hidden sm:inline">English</span>
                <span className="sm:hidden">EN</span>
              </button>
              <button
                type="button"
                onClick={() => setLang('ta')}
                className={`px-2 sm:px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  lang === 'ta'
                    ? 'app-surface app-text shadow-xs'
                    : 'app-text-muted'
                }`}
              >
                தமிழ்
              </button>
            </div>

            {isStaffSignedIn && onReturnToWorkspace ? (
              <button
                type="button"
                onClick={onReturnToWorkspace}
                className="px-3.5 py-1.5 text-xs sm:text-sm font-medium app-btn-primary rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                {t('navDashboard')}
              </button>
            ) : (
              <button
                type="button"
                onClick={onGoToLogin}
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium app-btn-primary rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <LockKeyhole className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>{t('staffSignIn')}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Clean Institutional Title Banner */}
        <section
          id="overview"
          className="app-card rounded-lg overflow-hidden"
        >
          <div className="app-crest-ribbon" />
          <div className="px-6 py-5 sm:px-8 sm:py-6 flex items-center justify-between gap-4">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold app-text tracking-tight text-balance">
              {t('appSubtitle')}
            </h1>
          </div>
        </section>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="app-card rounded-lg p-5 h-28 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <>
            {!hasPublishedStats && (
              <div className="app-card rounded-lg p-5 text-sm app-text-muted flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <span>{t('noPublicStatsYet')}</span>
                {!isStaffSignedIn && (
                  <button
                    type="button"
                    onClick={onGoToLogin}
                    className="px-4 py-2 text-xs font-medium app-accent-text app-accent-soft hover:opacity-90 rounded-md transition-colors whitespace-nowrap self-start sm:self-auto"
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
                    className="app-card rounded-lg p-5 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium app-text-subtle leading-snug">
                        {card.label}
                      </p>
                      <p className="mt-2 text-3xl font-bold app-text font-mono-tabular">
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
                    color: '#0f3d6e',
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
                    color: '#b88628',
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
                    color: 'var(--theme-accent)',
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
                  { label: t('male'), value: stats.maleCount, color: '#475569' },
                  { label: t('female'), value: stats.femaleCount, color: '#942031' },
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
                primaryColor="var(--theme-accent)"
                secondaryColor="#94a3b8"
                data={divisionChartData}
                maxItems={15}
              />

              <div className="app-card rounded-lg overflow-hidden">
                <div className="px-5 py-4 border-b app-border flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 app-accent-text" />
                    <h3 className="text-sm font-semibold app-text">
                      {t('navDivisions')} — {t('publicOverview')}
                    </h3>
                  </div>
                  <span className="text-xs app-text-subtle font-mono-tabular">
                    {stats.gnDivisionStats.length} Divisions
                  </span>
                </div>

                {stats.gnDivisionStats.length === 0 ? (
                  <div className="p-8 text-center text-sm app-text-subtle">
                    {t('noPublicStatsYet')}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="app-table-head text-xs font-semibold">
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
                      <tbody className="divide-y divide-[var(--theme-border)]">
                        {stats.gnDivisionStats.map((d) => (
                          <tr key={d.divisionId} className="app-table-row transition-colors">
                            <td className="px-4 py-2.5 font-mono-tabular text-xs app-text-subtle">
                              {d.code}
                            </td>
                            <td className="px-4 py-2.5 font-medium app-text">
                              {lang === 'ta' ? d.divisionNameTa : d.divisionNameEn}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-tabular font-semibold app-text">
                              {d.total}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-tabular app-text-muted">
                              {d.aged60To69}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-tabular app-text-muted">
                              {d.aged70Plus}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-tabular text-emerald-700 dark:text-emerald-400 font-medium">
                              {d.receivingAllowance}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-tabular app-accent-text">
                              {d.bankRecipients}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-tabular text-sky-700 dark:text-sky-400">
                              {d.postOfficeRecipients}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-tabular text-amber-700 dark:text-amber-400">
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

      <footer className="border-t app-border app-surface mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs app-text-subtle">
          <span>
            {t('appTitle')} · {t('appSubtitle')}
          </span>
          <span>Mannar District · Northern Province · Sri Lanka</span>
        </div>
      </footer>
    </div>
  );
}
