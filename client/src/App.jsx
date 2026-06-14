import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { FinanceProvider } from "./context/FinanceContext";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Analytics from "./pages/Analytics";
import Budgets from "./pages/Budgets";
import Goals from "./pages/Goals";
import Settings from "./pages/Settings";
import InitialBalance from "./pages/InitialBalance";
import Recurring from "./pages/Recurring";
import Wallets from "./pages/Wallets";

import Sidebar from "./components/Layout/Sidebar";
import ScrollToTop from "./components/Layout/ScrollToTop";
import ErrorBoundary from "./components/ErrorBoundary";

function PrivateRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div
                style={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: "12px",
                    color: "#64748b",
                }}
            >
                <div className="loading-spinner" />
                <div>Memuat...</div>
            </div>
        );
    }

    return user ? children : <Navigate to="/login" replace />;
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
            <div
                style={{
                    display: "flex",
                    height: "100vh",
                    backgroundColor: "var(--app-bg)",
                    color: "var(--app-text)",
                }}
            >
                <Sidebar />
                <main
                    style={{
                        flex: 1,
                        overflowY: "auto",
                        height: "100vh",
                        minHeight: 0,
                    }}
                >
                    {children}
                </main>
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
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />

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

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}