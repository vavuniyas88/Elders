import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  Building2,
  FileBarChart2,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { AdminManagementView } from './components/AdminManagementView';
import { CitizenFormModal } from './components/CitizenFormModal';
import { CitizenRegistryView } from './components/CitizenRegistryView';
import { DashboardView } from './components/DashboardView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GnDivisionsView } from './components/GnDivisionsView';
import { LoginView } from './components/LoginView';
import { ProfileModal } from './components/ProfileModal';
import { PublicDashboard } from './components/PublicDashboard';
import { ReportsView } from './components/ReportsView';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  createCitizenWithNicGuard,
  deleteCitizenRecord,
  ensureUserProfile,
  seedDefaultGnDivisions,
  syncPublicStats,
  updateCitizenRecord,
} from './services/firestoreService';
import type {
  AppRoute,
  CitizenCategoryTab,
  ElderlyCitizen,
  ElderlyCitizenFormInput,
  GnDivision,
  UserProfile,
} from './types';
import { getLocalIsoDate } from './utils/calculations';

function AppShell() {
  const { lang, setLang, t } = useLanguage();

  // Auth & Profile State
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [unauthView, setUnauthView] = useState<'public' | 'login'>('public');

  // Navigation State
  const [route, setRoute] = useState<AppRoute>('dashboard');
  const [activeCategory, setActiveCategory] =
    useState<CitizenCategoryTab>('all_60_plus');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Domain Data State
  const [citizens, setCitizens] = useState<ElderlyCitizen[]>([]);
  const [divisions, setDivisions] = useState<GnDivision[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Modals State
  const [citizenModalOpen, setCitizenModalOpen] = useState(false);
  const [editingCitizen, setEditingCitizen] = useState<ElderlyCitizen | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Automatic Daily Age Calculation Refresh Timer
  const [referenceDate, setReferenceDate] = useState<Date>(() => new Date());

  useEffect(() => {
    const scheduleMidnightRefresh = () => {
      const now = new Date();
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        2
      );
      const msUntilMidnight = nextMidnight.getTime() - now.getTime();
      return window.setTimeout(() => {
        setReferenceDate(new Date());
      }, msUntilMidnight);
    };
    const timerId = scheduleMidnightRefresh();
    return () => window.clearTimeout(timerId);
  }, [referenceDate]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setUserProfile(null);
        setCitizens([]);
        setDivisions([]);
        setAuthReady(true);
        return;
      }

      setProfileLoading(true);
      try {
        const profile = await ensureUserProfile(fbUser);
        setUserProfile(profile);
      } catch (err) {
        console.error('Failed to load user profile:', err);
        setUserProfile(null);
      } finally {
        setProfileLoading(false);
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // Attach Firestore real-time listeners only when staff user is active
  const isStaffActive = Boolean(
    authReady && firebaseUser && userProfile && userProfile.status === 'active'
  );

  useEffect(() => {
    if (!isStaffActive) {
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    let citizensReady = false;
    let divisionsReady = false;

    const checkReady = () => {
      if (citizensReady && divisionsReady) {
        setDataLoading(false);
      }
    };

    const unsubDivs = onSnapshot(
      collection(db, 'gn_divisions'),
      (snap) => {
        setDivisions(snap.docs.map((d) => d.data() as GnDivision));
        divisionsReady = true;
        checkReady();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'gn_divisions')
    );

    const unsubCitizens = onSnapshot(
      collection(db, 'elderly_citizens'),
      (snap) => {
        setCitizens(snap.docs.map((d) => d.data() as ElderlyCitizen));
        citizensReady = true;
        checkReady();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'elderly_citizens')
    );

    return () => {
      unsubDivs();
      unsubCitizens();
    };
  }, [isStaffActive]);

  // Auto-seed all 36 official Manthai West GN Divisions for Admin on first load (or upgrade unlinked legacy MW-* placeholders)
  const autoSeededRef = React.useRef(false);
  useEffect(() => {
    if (
      !isStaffActive ||
      dataLoading ||
      !userProfile ||
      userProfile.role !== 'admin' ||
      autoSeededRef.current
    ) {
      return;
    }
    const hasAllOfficial = divisions.some((d) => d.code.startsWith('MN/'));
    if (divisions.length === 0 || !hasAllOfficial) {
      autoSeededRef.current = true;
      void seedDefaultGnDivisions(userProfile, divisions, citizens).catch(() => {});
    }
  }, [isStaffActive, dataLoading, userProfile, divisions, citizens]);

  // Keep public_stats/summary date-synced when day rolls over while staff is online
  useEffect(() => {
    if (!isStaffActive || dataLoading) return;
    if (citizens.length > 0 || divisions.length > 0) {
      void syncPublicStats(citizens, divisions).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getLocalIsoDate(referenceDate), isStaffActive, dataLoading]);

  const handleSaveCitizen = async (
    input: ElderlyCitizenFormInput,
    editing: ElderlyCitizen | null
  ) => {
    if (!userProfile) return;
    if (editing) {
      await updateCitizenRecord(editing, input, userProfile, citizens, divisions);
    } else {
      await createCitizenWithNicGuard(input, userProfile, citizens, divisions);
    }
  };

  const handleDeleteCitizen = async (citizen: ElderlyCitizen) => {
    if (!userProfile || userProfile.role !== 'admin') return;
    await deleteCitizenRecord(citizen, userProfile, citizens, divisions);
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setRoute('dashboard');
    setUnauthView('public');
  };

  // Initial Loading Screen
  if (!authReady || profileLoading) {
    return (
      <div className="min-h-screen app-canvas flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[var(--theme-accent)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm app-text-muted">{t('loadingData')}</p>
        </div>
      </div>
    );
  }

  // Unauthenticated Public / Login Routing
  if (!firebaseUser) {
    if (unauthView === 'login') {
      return <LoginView onBackToPublic={() => setUnauthView('public')} />;
    }
    return <PublicDashboard onGoToLogin={() => setUnauthView('login')} />;
  }

  // Signed in, but account is Inactive or Missing Profile
  if (!userProfile || userProfile.status !== 'active') {
    return (
      <div className="min-h-screen app-canvas flex items-center justify-center p-6">
        <div className="max-w-md w-full app-card rounded-lg overflow-hidden">
          <div className="app-crest-ribbon" />
          <div className="p-7 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src="/assets/aistudio/IMG-20261121-WA0000_9601a62d.jpg"
                alt="Manthai West Divisional Secretariat Logo"
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded object-contain bg-white border app-border p-0.5 shrink-0"
              />
              <div>
                <h2 className="text-base font-bold app-text">
                  Account Pending Activation
                </h2>
                <p className="text-xs app-text-subtle">{firebaseUser.email}</p>
              </div>
            </div>
            <p className="text-sm app-text-muted leading-relaxed">
              Your account is currently <strong>inactive</strong> or awaiting approval
              from the Manthai West Divisional Secretariat Administrator. Once activated,
              reload this page to access the system.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSignOut}
                className="px-4 py-2 text-xs font-semibold app-btn-primary rounded-md"
              >
                {t('signOut')}
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-xs font-medium app-surface app-text border app-border rounded-md hover:opacity-90"
              >
                Refresh Status
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Staff Public Preview Route
  if (route === 'public') {
    return (
      <PublicDashboard
        isStaffSignedIn
        onGoToLogin={() => setRoute('dashboard')}
        onReturnToWorkspace={() => setRoute('dashboard')}
      />
    );
  }

  const isAdmin = userProfile.role === 'admin';

  const navItems: Array<{
    id: AppRoute;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    adminOnly?: boolean;
  }> = [
    { id: 'dashboard', label: t('navDashboard'), icon: LayoutDashboard },
    { id: 'citizens', label: t('navCitizens'), icon: Users },
    { id: 'divisions', label: t('navDivisions'), icon: Building2 },
    { id: 'reports', label: t('navReports'), icon: FileBarChart2 },
    { id: 'admin', label: t('navAdmin'), icon: Shield, adminOnly: true },
  ];

  const activeNavLabel =
    navItems.find((n) => n.id === route)?.label || t('navDashboard');

  return (
    <div className="min-h-screen app-canvas flex">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden no-print"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Navigation Sidebar */}
      <aside
        className={`no-print fixed lg:static inset-y-0 left-0 z-50 w-64 app-sidebar border-r app-sidebar-border text-slate-100 flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="app-crest-ribbon" />
          <div className="p-5 border-b app-sidebar-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src="/assets/aistudio/IMG-20261121-WA0000_9601a62d.jpg"
                alt="Manthai West Divisional Secretariat Logo"
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded object-contain bg-white p-0.5 shrink-0 shadow-xs"
              />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white leading-snug">
                  {t('shortBrand')}
                </div>
                <div className="text-[11px] text-[var(--theme-sidebar-muted)] truncate mt-0.5">
                  {t('appSubtitle')}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1 text-slate-300 hover:text-white"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="p-3 space-y-1">
            {navItems
              .filter((item) => !item.adminOnly || isAdmin)
              .map((item) => {
                const Icon = item.icon;
                const active = route === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setRoute(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                      active
                        ? 'app-btn-primary shadow-xs'
                        : 'text-slate-200 app-sidebar-item-hover hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}

            <div className="pt-3 mt-3 border-t app-sidebar-border">
              <button
                type="button"
                onClick={() => {
                  setRoute('public');
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-slate-200 app-sidebar-item-hover hover:text-white rounded-md transition-colors whitespace-nowrap"
              >
                <Globe className="w-4 h-4 shrink-0" />
                <span className="truncate">{t('navPublicPreview')}</span>
              </button>
            </div>
          </nav>
        </div>

        {/* User Footer Info */}
        <div className="p-4 border-t app-sidebar-border space-y-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">
              {userProfile.fullName}
            </div>
            <div className="text-xs text-[var(--theme-sidebar-muted)] truncate">
              {isAdmin ? t('roleAdmin') : t('roleUser')} · {userProfile.username}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setProfileModalOpen(true)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-100 bg-white/10 hover:bg-white/15 rounded transition-colors"
            >
              <UserCog className="w-3.5 h-3.5" />
              Profile
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-100 bg-white/10 hover:bg-red-700 rounded transition-colors whitespace-nowrap"
              title={t('signOut')}
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>{t('signOut')}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Context Header */}
        <header className="no-print h-16 app-surface border-b app-border px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 app-text-muted hover:opacity-80 rounded-md"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-sm truncate">
              <span className="app-text-subtle hidden sm:inline">
                {t('appTitle')}
              </span>
              <span className="app-text-subtle hidden sm:inline">/</span>
              <span className="font-semibold app-text truncate">
                {activeNavLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <ThemeSwitcher />

            <div className="inline-flex items-center p-0.5 app-surface-muted rounded border app-border">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  lang === 'en' ? 'app-surface app-text shadow-xs' : 'app-text-muted'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('ta')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  lang === 'ta' ? 'app-surface app-text shadow-xs' : 'app-text-muted'
                }`}
              >
                தமிழ்
              </button>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-900/60 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">{t('signOut')}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {dataLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-7 h-7 border-2 border-[var(--theme-accent)] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm app-text-subtle">{t('loadingData')}</p>
            </div>
          ) : (
            <>
              {route === 'dashboard' && (
                <DashboardView
                  citizens={citizens}
                  divisions={divisions}
                  referenceDate={referenceDate}
                  onOpenRegister={() => {
                    setEditingCitizen(null);
                    setCitizenModalOpen(true);
                  }}
                  onNavigateToCategory={(cat) => {
                    setActiveCategory(cat);
                    setRoute('citizens');
                  }}
                />
              )}

              {route === 'citizens' && (
                <CitizenRegistryView
                  citizens={citizens}
                  divisions={divisions}
                  userRole={userProfile.role}
                  referenceDate={referenceDate}
                  activeCategory={activeCategory}
                  onChangeCategory={setActiveCategory}
                  onOpenRegister={() => {
                    setEditingCitizen(null);
                    setCitizenModalOpen(true);
                  }}
                  onEditCitizen={(c) => {
                    setEditingCitizen(c);
                    setCitizenModalOpen(true);
                  }}
                  onDeleteCitizen={handleDeleteCitizen}
                />
              )}

              {route === 'divisions' && (
                <GnDivisionsView
                  divisions={divisions}
                  citizens={citizens}
                  currentUser={userProfile}
                  referenceDate={referenceDate}
                />
              )}

              {route === 'reports' && (
                <ReportsView
                  citizens={citizens}
                  divisions={divisions}
                  referenceDate={referenceDate}
                />
              )}

              {route === 'admin' && isAdmin && (
                <AdminManagementView
                  currentUser={userProfile}
                  citizens={citizens}
                  divisions={divisions}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Registration / Edit Citizen Modal */}
      <CitizenFormModal
        isOpen={citizenModalOpen}
        onClose={() => {
          setCitizenModalOpen(false);
          setEditingCitizen(null);
        }}
        divisions={divisions}
        existingCitizens={citizens}
        editingCitizen={editingCitizen}
        referenceDate={referenceDate}
        onSave={handleSaveCitizen}
      />

      {/* Profile & Password Modal */}
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        profile={userProfile}
        onProfileUpdated={setUserProfile}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <AppShell />
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
