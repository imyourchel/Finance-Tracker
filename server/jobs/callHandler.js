// Memanggil handler Express yang sudah ada (mis. getBudgets, getGamification)
// dari dalam server, tanpa HTTP. Mengembalikan body JSON-nya, atau melempar error.
function callHandler(handler, { user, query = {}, params = {}, body = {} }) {
    return new Promise((resolve, reject) => {
        let status = 200;
        const res = {
            status(code) {
                status = code;
                return res;
            },
            json(data) {
                if (status >= 400) reject(new Error(data?.message || `Handler gagal (${status})`));
                else resolve(data);
                return res;
            },
        };
        Promise.resolve(
            handler({ user: { _id: user._id || user, id: String(user._id || user) }, query, params, body }, res),
        ).catch(reject);
    });
}

module.exports = callHandler;
