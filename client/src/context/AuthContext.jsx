/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from "react";
import { loginAPI, registerAPI, getProfileAPI } from "../services/api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    

    // Saat pertama buka app — cek token yang sudah tersimpan
    useEffect(() => {
        let cancelled = false;

        const initAuth = async () => {
            const token = localStorage.getItem("token");

            if (!token) {
                Promise.resolve().then(() => {
                    if (!cancelled) setLoading(false);
                });
                return;
            }

            try {
                const res = await getProfileAPI();
                if (!cancelled) setUser(res.data);
            } catch {
                localStorage.removeItem("token");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void initAuth();

        return () => {
            cancelled = true;
        };
    }, []);

    const login = async (username, password) => {
        const res = await loginAPI({ username, password });
        localStorage.setItem("token", res.data.token);
        setUser(res.data);
        setLoading(false);
    };

    const register = async (name, email, username, password) => {
        const res = await registerAPI({ name, email, username, password });
        localStorage.setItem("token", res.data.token);
        setUser(res.data);
        setLoading(false);
    };

    const logout = () => {
        localStorage.removeItem("token");
        setUser(null);
    };

    const updateUser = (data) => setUser((prev) => ({ ...prev, ...data }));

    return (
        <AuthContext.Provider
            value={{ user, loading, login, register, logout, updateUser }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
