/* eslint-disable react-refresh/only-export-components */
import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    getTransactionsAPI, 
} from "react";
import {
    getSummaryAPI,
    getWalletsAPI,
    getCategoriesAPI,
} from "../services/api";
import { useAuth } from "./AuthContext";

const FinanceContext = createContext();

export function FinanceProvider({ children }) {
    const { user } = useAuth();
    const now = new Date();

    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [availableYears, setAvailableYears] = useState([now.getFullYear()]);
    const [summary, setSummary] = useState({
        income: 0,
        expense: 0,
        balance: 0,
        byCategory: [],
        dailyTrend: [],
    });
    const [wallets, setWallets] = useState([]);
    const [categories, setCategories] = useState([]);
    const [totalBalance, setTotalBalance] = useState(0);
    const [loadingData, setLoadingData] = useState(true);

      // Fetch year range — sekali saja saat user login
    useEffect(() => {
        if (!user) return;

        const fetchYearRange = async () => {
            try {
                const res = await getTransactionsAPI({ limit: 1, sort: "date_asc" });
                const oldest = res.data.transactions?.[0];

                const startYear = oldest
                    ? new Date(oldest.date).getFullYear()
                    : now.getFullYear();

                const endYear = now.getFullYear();
                const years = [];
                for (let y = startYear; y <= endYear; y++) years.push(y);
                setAvailableYears(years);
            } catch {
                setAvailableYears([now.getFullYear()]);
            }
        };

        fetchYearRange();
    }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
    
    const refresh = useCallback(async () => {
        if (!user) return;
        setLoadingData(true);
        try {
            const [sumRes, walRes, catRes] = await Promise.all([
                getSummaryAPI({ month, year }),
                getWalletsAPI(),
                getCategoriesAPI(),
            ]);
            setSummary(sumRes.data);
            setWallets(walRes.data.wallets);
            setTotalBalance(walRes.data.totalBalance);
            setCategories(catRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingData(false);
        }
    }, [user, month, year]);

    useEffect(() => {
        if (user) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            refresh();
        }
    }, [refresh, user]);

    return (
        <FinanceContext.Provider
            value={{
                month,
                year,
                setMonth,
                setYear,
                availableYears, 
                summary,
                wallets,
                categories,
                totalBalance,
                loadingData,
                refresh,
            }}
        >
            {children}
        </FinanceContext.Provider>
    );
}

export const useFinance = () => useContext(FinanceContext);
