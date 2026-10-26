// Membuka "catat cepat" dari mana saja (tombol sidebar, dashboard, dll.)
export const QUICK_ADD_EVENT = "dt:quickadd";
export const openQuickAdd = () => window.dispatchEvent(new CustomEvent(QUICK_ADD_EVENT));
