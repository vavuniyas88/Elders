import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  FilterX,
  Info,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import type {
  AllowanceStatus,
  CitizenCategoryTab,
  ElderlyCitizen,
  FilterState,
  Gender,
  GnDivision,
  PaymentMethod,
  SortDirection,
  SortField,
  UserRole,
} from '../types';
import {
  calculateAge,
  filterCitizensByCategory,
  formatTimestamp,
  getAgeGroupLabel,
  toDateValue,
} from '../utils/calculations';

const INITIAL_FILTERS: FilterState = {
  search: '',
  gnDivisionId: 'all',
  ageRange: 'all',
  gender: 'all',
  allowanceStatus: 'all',
  paymentMethod: 'all',
  bankName: 'all',
  postOfficeName: 'all',
};

const PAGE_SIZE = 15;

export function CitizenRegistryView({
  citizens,
  divisions,
  userRole,
  referenceDate,
  activeCategory,
  onChangeCategory,
  onOpenRegister,
  onEditCitizen,
  onDeleteCitizen,
}: {
  citizens: ElderlyCitizen[];
  divisions: GnDivision[];
  userRole: UserRole;
  referenceDate: Date;
  activeCategory: CitizenCategoryTab;
  onChangeCategory: (cat: CitizenCategoryTab) => void;
  onOpenRegister: () => void;
  onEditCitizen: (citizen: ElderlyCitizen) => void;
  onDeleteCitizen: (citizen: ElderlyCitizen) => Promise<void>;
}) {
  const { lang, t } = useLanguage();
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [viewingCitizen, setViewingCitizen] = useState<ElderlyCitizen | null>(null);
  const [deletingCitizen, setDeletingCitizen] = useState<ElderlyCitizen | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isAdmin = userRole === 'admin';

  const categoryTabs: Array<{ id: CitizenCategoryTab; label: string; count: number }> =
    useMemo(() => {
      const ids: CitizenCategoryTab[] = [
        'all_60_plus',
        'aged_60_69',
        'aged_70_plus',
        'allowance_recipients',
        'bank_recipients',
        'post_office_recipients',
        'non_allowance_70_plus',
      ];
      const labels: Record<CitizenCategoryTab, string> = {
        all_60_plus: t('catAll60Plus'),
        aged_60_69: t('catAged60To69'),
        aged_70_plus: t('catAged70Plus'),
        allowance_recipients: t('catAllowanceRecipients'),
        bank_recipients: t('catBankRecipients'),
        post_office_recipients: t('catPostOfficeRecipients'),
        non_allowance_70_plus: t('catNonAllowance'),
      };
      return ids.map((id) => ({
        id,
        label: labels[id],
        count: filterCitizensByCategory(citizens, id, referenceDate).length,
      }));
    }, [citizens, referenceDate, t]);

  const uniqueBanks = useMemo(() => {
    const set = new Set<string>();
    for (const c of citizens) {
      if (c.bankName.trim()) set.add(c.bankName.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [citizens]);

  const uniquePostOffices = useMemo(() => {
    const set = new Set<string>();
    for (const c of citizens) {
      if (c.postOfficeName.trim()) set.add(c.postOfficeName.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [citizens]);

  const filteredAndSorted = useMemo(() => {
    const base = filterCitizensByCategory(citizens, activeCategory, referenceDate);
    const q = filters.search.trim().toLowerCase();

    const matched = base.filter((c) => {
      if (q) {
        const hit =
          c.fullName.toLowerCase().includes(q) ||
          c.nicNumber.toLowerCase().includes(q) ||
          c.telephone.toLowerCase().includes(q) ||
          c.welfareRegNumber.toLowerCase().includes(q);
        if (!hit) return false;
      }

      if (filters.gnDivisionId !== 'all' && c.gnDivisionId !== filters.gnDivisionId) {
        return false;
      }

      const age = calculateAge(c.dateOfBirth, referenceDate);
      if (filters.ageRange === '60-69' && !(age >= 60 && age <= 69)) return false;
      if (filters.ageRange === '70-79' && !(age >= 70 && age <= 79)) return false;
      if (filters.ageRange === '80+' && !(age >= 80)) return false;

      if (filters.gender !== 'all' && c.gender !== filters.gender) return false;

      if (
        filters.allowanceStatus !== 'all' &&
        c.allowanceStatus !== filters.allowanceStatus
      ) {
        return false;
      }

      if (filters.paymentMethod !== 'all' && c.paymentMethod !== filters.paymentMethod) {
        return false;
      }

      if (filters.bankName !== 'all' && c.bankName.trim() !== filters.bankName) {
        return false;
      }

      if (
        filters.postOfficeName !== 'all' &&
        c.postOfficeName.trim() !== filters.postOfficeName
      ) {
        return false;
      }

      return true;
    });

    return matched.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'fullName') {
        cmp = a.fullName.localeCompare(b.fullName);
      } else if (sortField === 'age') {
        cmp =
          calculateAge(a.dateOfBirth, referenceDate) -
          calculateAge(b.dateOfBirth, referenceDate);
      } else if (sortField === 'gnDivisionName') {
        cmp = a.gnDivisionName.localeCompare(b.gnDivisionName);
      } else {
        const ta = toDateValue(a.createdAt)?.getTime() ?? 0;
        const tb = toDateValue(b.createdAt)?.getTime() ?? 0;
        cmp = ta - tb;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [citizens, activeCategory, filters, sortField, sortDirection, referenceDate]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAndSorted.slice(start, start + PAGE_SIZE);
  }, [filteredAndSorted, currentPage]);

  const updateFilter = <K extends keyof FilterState>(key: K, val: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(INITIAL_FILTERS);
    setPage(1);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCitizen) return;
    setDeleteLoading(true);
    try {
      await onDeleteCitizen(deletingCitizen);
      setDeletingCitizen(null);
      if (viewingCitizen?.id === deletingCitizen.id) {
        setViewingCitizen(null);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const getStatusClass = (status: AllowanceStatus): string => {
    switch (status) {
      case 'Active':
        return 'text-emerald-700';
      case 'Pending':
        return 'text-amber-700';
      case 'Suspended':
        return 'text-red-700';
      default:
        return 'text-slate-600';
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{t('navCitizens')}</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Dynamic age categories, multi-criteria filtering, and citizen record registry
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

      {!isAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-md px-4 py-2.5 flex items-center gap-2.5 text-xs text-blue-900">
          <Info className="w-4 h-4 text-blue-700 shrink-0" />
          <span>{t('readOnlyOfficerNotice')}</span>
        </div>
      )}

      {/* 7 Dynamic Category Tabs */}
      <div className="bg-white border border-slate-200 rounded-lg p-1.5 flex flex-wrap gap-1">
        {categoryTabs.map((tab) => {
          const active = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                onChangeCategory(tab.id);
                setPage(1);
              }}
              className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-2 ${
                active
                  ? 'bg-blue-700 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`font-mono-tabular ${
                  active ? 'text-blue-100' : 'text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Multi-Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              aria-label={t('sortBy')}
            >
              <option value="createdAt">{t('sortBy')}: {t('sortRecent')}</option>
              <option value="fullName">{t('sortBy')}: {t('sortName')}</option>
              <option value="age">{t('sortBy')}: {t('sortAge')}</option>
              <option value="gnDivisionName">{t('sortBy')}: {t('sortDivision')}</option>
            </select>

            <button
              type="button"
              onClick={() =>
                setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
              }
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md border border-slate-200 whitespace-nowrap"
            >
              {sortDirection === 'asc' ? 'Asc ↑' : 'Desc ↓'}
            </button>

            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md whitespace-nowrap"
            >
              <FilterX className="w-3.5 h-3.5" />
              {t('clearFilters')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2.5 pt-1">
          <select
            value={filters.gnDivisionId}
            onChange={(e) => updateFilter('gnDivisionId', e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
            aria-label={t('filterDivision')}
          >
            <option value="all">{t('filterDivision')}: {t('allOption')}</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {lang === 'ta' ? d.nameTa : d.nameEn}
              </option>
            ))}
          </select>

          <select
            value={filters.ageRange}
            onChange={(e) =>
              updateFilter('ageRange', e.target.value as FilterState['ageRange'])
            }
            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
            aria-label={t('filterAgeRange')}
          >
            <option value="all">{t('filterAgeRange')}: {t('allOption')}</option>
            <option value="60-69">60–69 {t('yearsOld')}</option>
            <option value="70-79">70–79 {t('yearsOld')}</option>
            <option value="80+">80+ {t('yearsOld')}</option>
          </select>

          <select
            value={filters.gender}
            onChange={(e) =>
              updateFilter('gender', e.target.value as 'all' | Gender)
            }
            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
            aria-label={t('filterGender')}
          >
            <option value="all">{t('filterGender')}: {t('allOption')}</option>
            <option value="Male">{t('male')}</option>
            <option value="Female">{t('female')}</option>
          </select>

          <select
            value={filters.allowanceStatus}
            onChange={(e) =>
              updateFilter(
                'allowanceStatus',
                e.target.value as 'all' | AllowanceStatus
              )
            }
            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
            aria-label={t('filterAllowanceStatus')}
          >
            <option value="all">{t('filterAllowanceStatus')}: {t('allOption')}</option>
            <option value="Active">{t('statusActive')}</option>
            <option value="Pending">{t('statusPending')}</option>
            <option value="Suspended">{t('statusSuspended')}</option>
            <option value="Other">{t('statusOther')}</option>
            <option value="Not Applicable">{t('statusNotApplicable')}</option>
          </select>

          <select
            value={filters.paymentMethod}
            onChange={(e) =>
              updateFilter('paymentMethod', e.target.value as 'all' | PaymentMethod)
            }
            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
            aria-label={t('filterPaymentMethod')}
          >
            <option value="all">{t('filterPaymentMethod')}: {t('allOption')}</option>
            <option value="Bank">{t('bank')}</option>
            <option value="Post Office">{t('postOffice')}</option>
            <option value="None">{t('no')}</option>
          </select>

          <select
            value={filters.bankName}
            onChange={(e) => updateFilter('bankName', e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
            aria-label={t('filterBankName')}
          >
            <option value="all">{t('filterBankName')}: {t('allOption')}</option>
            {uniqueBanks.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <select
            value={filters.postOfficeName}
            onChange={(e) => updateFilter('postOfficeName', e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
            aria-label={t('filterPostOffice')}
          >
            <option value="all">{t('filterPostOffice')}: {t('allOption')}</option>
            {uniquePostOffices.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <span>
            {t('matchingRecords')}:{' '}
            <strong className="font-mono-tabular text-slate-900">
              {filteredAndSorted.length.toLocaleString()}
            </strong>
          </span>
          <span className="font-mono-tabular">
            Page {currentPage} of {totalPages}
          </span>
        </div>
      </div>

      {/* Citizens Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {paginatedRows.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm text-slate-500">{t('noRecordsFound')}</p>
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-medium text-blue-700 hover:underline"
            >
              {t('clearFilters')}
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
                  <th className="px-4 py-3">{t('gender')}</th>
                  <th className="px-4 py-3">{t('gnDivision')}</th>
                  <th className="px-4 py-3">{t('telephone')}</th>
                  <th className="px-4 py-3">{t('paymentMethod')}</th>
                  <th className="px-4 py-3">{t('allowanceStatus')}</th>
                  <th className="px-4 py-3 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRows.map((c) => {
                  const age = calculateAge(c.dateOfBirth, referenceDate);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-900">{c.fullName}</div>
                        {c.welfareRegNumber && (
                          <div className="text-[11px] text-slate-500 font-mono-tabular">
                            Welfare: {c.welfareRegNumber}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono-tabular text-xs text-slate-700">
                        {c.nicNumber}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono-tabular">
                        <span className="font-semibold text-slate-900">{age}</span>
                        <span className="text-[11px] text-slate-400 ml-1">
                          ({getAgeGroupLabel(age)})
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">{c.gender}</td>
                      <td className="px-4 py-2.5 text-slate-700">{c.gnDivisionName}</td>
                      <td className="px-4 py-2.5 font-mono-tabular text-xs text-slate-700">
                        {c.telephone}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-700">
                        {c.receivingAllowance ? (
                          <div>
                            <div className="font-medium text-slate-900">
                              {c.paymentMethod}
                            </div>
                            <div className="text-slate-500 truncate max-w-[160px]">
                              {c.paymentMethod === 'Bank'
                                ? `${c.bankName} (${c.bankBranch})`
                                : c.postOfficeName}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">{t('no')}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-medium">
                        <span className={getStatusClass(c.allowanceStatus)}>
                          {c.allowanceStatus}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingCitizen(c)}
                            className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                            title={t('viewDetails')}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditCitizen(c)}
                                className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                                title={t('edit')}
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingCitizen(c)}
                                className="p-1.5 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded"
                                title={t('delete')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span className="font-mono-tabular">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, filteredAndSorted.length)} of{' '}
              {filteredAndSorted.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Citizen Detail Modal */}
      {viewingCitizen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {viewingCitizen.fullName}
                </h3>
                <p className="text-xs text-slate-500 font-mono-tabular mt-0.5">
                  NIC: {viewingCitizen.nicNumber} · Age:{' '}
                  {calculateAge(viewingCitizen.dateOfBirth, referenceDate)}{' '}
                  {t('yearsOld')} (
                  {getAgeGroupLabel(
                    calculateAge(viewingCitizen.dateOfBirth, referenceDate)
                  )}
                  )
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingCitizen(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-500 block">{t('dateOfBirth')}</span>
                  <span className="font-mono-tabular font-medium text-slate-900">
                    {viewingCitizen.dateOfBirth}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">{t('gender')}</span>
                  <span className="font-medium text-slate-900">
                    {viewingCitizen.gender}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">{t('telephone')}</span>
                  <span className="font-mono-tabular font-medium text-slate-900">
                    {viewingCitizen.telephone}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">{t('gnDivision')}</span>
                  <span className="font-medium text-slate-900">
                    {viewingCitizen.gnDivisionName}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-xs text-slate-500 block">{t('address')}</span>
                  <span className="font-medium text-slate-900">
                    {viewingCitizen.address}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">
                    {t('welfareRegNumber')}
                  </span>
                  <span className="font-mono-tabular font-medium text-slate-900">
                    {viewingCitizen.welfareRegNumber || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">
                    {t('isReceivingAllowance')}
                  </span>
                  <span className="font-medium text-slate-900">
                    {viewingCitizen.receivingAllowance ? t('yes') : t('no')}
                  </span>
                </div>
              </div>

              {viewingCitizen.receivingAllowance && (
                <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-slate-500 block">
                      {t('paymentMethod')}
                    </span>
                    <span className="font-medium text-slate-900">
                      {viewingCitizen.paymentMethod}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">
                      {t('allowanceStatus')}
                    </span>
                    <span
                      className={`font-semibold ${getStatusClass(
                        viewingCitizen.allowanceStatus
                      )}`}
                    >
                      {viewingCitizen.allowanceStatus}
                    </span>
                  </div>
                  {viewingCitizen.paymentMethod === 'Bank' ? (
                    <>
                      <div>
                        <span className="text-xs text-slate-500 block">
                          {t('bankName')}
                        </span>
                        <span className="font-medium text-slate-900">
                          {viewingCitizen.bankName}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 block">
                          {t('bankBranch')}
                        </span>
                        <span className="font-medium text-slate-900">
                          {viewingCitizen.bankBranch}
                        </span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-xs text-slate-500 block">
                          {t('bankAccountNumber')}
                        </span>
                        <span className="font-mono-tabular font-medium text-slate-900">
                          {viewingCitizen.bankAccountNumber || '—'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="sm:col-span-2">
                      <span className="text-xs text-slate-500 block">
                        {t('postOfficeName')}
                      </span>
                      <span className="font-medium text-slate-900">
                        {viewingCitizen.postOfficeName}
                      </span>
                    </div>
                  )}
                  {viewingCitizen.remarks && (
                    <div className="sm:col-span-2">
                      <span className="text-xs text-slate-500 block">
                        {t('remarks')}
                      </span>
                      <span className="text-slate-700">{viewingCitizen.remarks}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                <div>
                  Created by {viewingCitizen.createdByName} on{' '}
                  <span className="font-mono-tabular">
                    {formatTimestamp(viewingCitizen.createdAt)}
                  </span>
                </div>
                <div>
                  Last updated by {viewingCitizen.updatedByName} on{' '}
                  <span className="font-mono-tabular">
                    {formatTimestamp(viewingCitizen.updatedAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-end gap-2">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingCitizen;
                    setViewingCitizen(null);
                    onEditCitizen(target);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md"
                >
                  {t('edit')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewingCitizen(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Delete Confirmation Dialog */}
      {deletingCitizen && isAdmin && (
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
                  {t('confirmDeleteTitle')}
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  {t('confirmDeleteCitizenMsg')}
                </p>
                <div className="mt-2.5 text-xs font-medium text-slate-900 font-mono-tabular bg-slate-50 border border-slate-200 rounded p-2.5">
                  {deletingCitizen.fullName} · NIC: {deletingCitizen.nicNumber}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCitizen(null)}
                disabled={deleteLoading}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-md"
              >
                {deleteLoading ? 'Deleting...' : t('confirmDeleteBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
