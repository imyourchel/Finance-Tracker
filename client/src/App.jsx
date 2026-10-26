import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { FinanceProvider } from "./context/FinanceContext";

import Auth from "./pages/Auth";
import LevelUpCelebration from "./components/gamification/LevelUpCelebration";
import XpFeedback from "./components/gamification/XpFeedback";
import QuickAdd from "./components/quickadd/QuickAdd";

// Halaman dimuat saat dibuka saja supaya pembukaan pertama lebih cepat
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Budgets = lazy(() => import("./pages/Budgets"));
const Goals = lazy(() => import("./pages/Goals"));
const Settings = lazy(() => import("./pages/Settings"));
const InitialBalance = lazy(() => import("./pages/InitialBalance"));
const Recurring = lazy(() => import("./pages/Recurring"));
const Wallets = lazy(() => import("./pages/Wallets"));
const WalletDetail = lazy(() => import("./pages/WalletDetail"));
const Debts = lazy(() => import("./pages/Debts"));
const Wrapped = lazy(() => import("./pages/Wrapped"));
const FinancialHealth = lazy(() => import("./pages/FinancialHealth"));
const TransactionEditor = lazy(() => import("./pages/TransactionEditor"));
const Achievements = lazy(() => import("./pages/Achievements"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const DataTools = lazy(() => import("./pages/DataTools"));

import Sidebar from "./components/Layout/Sidebar";
import MobileNav from "./components/Layout/MobileNav";
import OnboardingTour from "./components/onboarding/OnboardingTour";
import ReminderCenter from "./components/reminders/ReminderCenter";
import "./styles/layout.css";
import ScrollToTop from "./components/Layout/ScrollToTop";
import ErrorBoundary from "./components/ErrorBoundary";
import TopProgress from "./components/Layout/TopProgress";
import AppLoader from "./components/Layout/AppLoader";
import ConfirmHost from "./components/ui/ConfirmDialog";

function PrivateRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) return <AppLoader />;

    return user ? children : <Navigate to="/login" replace />;
}

// Halaman login/lupa password tidak perlu dibuka lagi kalau sudah masuk
function PublicOnlyRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <AppLoader label="Memeriksa sesi..." />;
    return user ? <Navigate to="/" replace /> : children;
}

function AppLayout({ children }) {
    const { user } = useAuth();

    const resolvedTheme =
        user?.theme === "system"
            ? window.matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light"
            : user?.theme || "light";

    useEffect(() => {
        document.documentElement.dataset.theme = resolvedTheme;
    }, [resolvedTheme]);

    useEffect(() => {
        const mq = window.matchMedia("(prefers-color-scheme: dark)");

        const handler = () => {
            if (user?.theme === "system") {
                document.documentElement.dataset.theme = mq.matches ? "dark" : "light";
            }
        };

        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, [user]);

    return (
        <FinanceProvider>
            <div className="app-shell">
                <Sidebar />
                <LevelUpCelebration />
                <XpFeedback />
                <QuickAdd />
                <OnboardingTour />
                <ReminderCenter />
                <main className="app-main">
                    <Suspense fallback={<AppLoader label="Memuat halaman..." />}>{children}</Suspense>
                </main>
                <MobileNav />
            </div>
        </FinanceProvider>
    );
}

const Private = ({ children }) => (
    <PrivateRoute>
        <AppLayout>
            <ErrorBoundary>{children}</ErrorBoundary>
        </AppLayout>
    </PrivateRoute>
);

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <ScrollToTop />
                <TopProgress />
                <ConfirmHost />
                <Suspense fallback={<AppLoader />}>
                <Routes>
                    {/* Satu komponen untuk dua URL supaya panel bisa bergeser */}
                    <Route path="/login" element={<Auth />} />
                    <Route path="/register" element={<Auth />} />
                    <Route
                        path="/forgot-password"
                        element={
                            <PublicOnlyRoute>
                                <ForgotPassword />
                            </PublicOnlyRoute>
                        }
                    />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/verify-email" element={<VerifyEmail />} />

                    <Route
                        path="/setup-initial-balance"
                        element={
                            <PrivateRoute>
                                <InitialBalance />
                            </PrivateRoute>
                        }
                    />

                    <Route
                        path="/"
                        element={
                            <Private>
                                <Dashboard />
                            </Private>
                        }
                    />
                    <Route
                        path="/transactions"
                        element={
                            <Private>
                                <Transactions />
                            </Private>
                        }
                    />
                    <Route
                        path="/transactions/new"
                        element={
                            <Private>
                                <TransactionEditor />
                            </Private>
                        }
                    />
                    <Route
                        path="/transactions/:id/edit"
                        element={
                            <Private>
                                <TransactionEditor />
                            </Private>
                        }
                    />
                    <Route
                        path="/pencapaian"
                        element={
                            <Private>
                                <Achievements />
                            </Private>
                        }
                    />
                    <Route
                        path="/analytics"
                        element={
                            <Private>
                                <Analytics />
                            </Private>
                        }
                    />
                    <Route
                        path="/budgets"
                        element={
                            <Private>
                                <Budgets />
                            </Private>
                        }
                    />
                    <Route
                        path="/goals"
                        element={
                            <Private>
                                <Goals />
                            </Private>
                        }
                    />
                    <Route
                        path="/settings"
                        element={
                            <Private>
                                <Settings />
                            </Private>
                        }
                    />
                    <Route
                        path="/recurring"
                        element={
                            <Private>
                                <Recurring />
                            </Private>
                        }
                    />
                    <Route
                        path="/wallets"
                        element={
                            <Private>
                                <Wallets />
                            </Private>
                        }
                    />
                    <Route
                        path="/wallets/:id"
                        element={
                            <Private>
                                <WalletDetail />
                            </Private>
                        }
                    />

                    <Route
                        path="/utang"
                        element={
                            <Private>
                                <Debts />
                            </Private>
                        }
                    />
                    <Route
                        path="/wrapped"
                        element={
                            <Private>
                                <Wrapped />
                            </Private>
                        }
                    />
                    <Route
                        path="/kesehatan"
                        element={
                            <Private>
                                <FinancialHealth />
                            </Private>
                        }
                    />
                    <Route
                        path="/data"
                        element={
                            <Private>
                                <DataTools />
                            </Private>
                        }
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                </Suspense>
            </BrowserRouter>
        </AuthProvider>
    );
}