// Penghitung request yang sedang berjalan — dipakai progress bar global.
let pending = 0;
const listeners = new Set();

const emit = () => listeners.forEach((fn) => fn(pending));

export const loadingBus = {
    start() {
        pending += 1;
        emit();
    },
    done() {
        pending = Math.max(0, pending - 1);
        emit();
    },
    subscribe(fn) {
        listeners.add(fn);
        fn(pending);
        return () => listeners.delete(fn);
    },
};
