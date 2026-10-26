// Dialog konfirmasi bertema, pengganti window.confirm().
// Pakai: if (!(await confirmDialog({ title, message }))) return;
let pushRequest = null;

export function registerConfirmHost(fn) {
    pushRequest = fn;
    return () => {
        if (pushRequest === fn) pushRequest = null;
    };
}

export function confirmDialog(options) {
    return new Promise((resolve) => {
        if (!pushRequest) {
            resolve(window.confirm(options.message || options.title));
            return;
        }
        pushRequest({ ...options, resolve });
    });
}
