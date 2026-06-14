import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
    const { pathname } = useLocation();

    useEffect(() => {
        // Prefer scrolling the main container if present (app uses a fixed main with overflow)
        const main = document.querySelector("main");
        if (main) {
            // smooth scroll for better UX
            try {
                main.scrollTo({ top: 0, left: 0, behavior: "smooth" });
            } catch (e) {
                main.scrollTop = 0;
            }
            // also ensure window fallback
            try {
                window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
            } catch (e) {
                // noop
            }
        } else {
            try {
                window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
            } catch (e) {
                // fallback
                window.scrollTo(0, 0);
            }
        }
    }, [pathname]);

    return null;
}
