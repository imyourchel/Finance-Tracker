import { useEffect, useRef, useState } from "react";
import { loadingBus } from "../../utils/loadingBus";

// Bar tipis di atas layar yang muncul setiap ada request ke server.
export default function TopProgress() {
    const [width, setWidth] = useState(0);
    const [visible, setVisible] = useState(false);
    const timers = useRef([]);

    useEffect(() => {
        const clear = () => {
            timers.current.forEach(clearTimeout);
            timers.current = [];
        };

        return loadingBus.subscribe((pending) => {
            clear();
            if (pending > 0) {
                // tunda sedikit supaya request super cepat tidak berkedip
                timers.current.push(
                    setTimeout(() => {
                        setVisible(true);
                        setWidth((w) => (w < 15 ? 15 : w));
                        timers.current.push(setTimeout(() => setWidth(65), 120));
                        timers.current.push(setTimeout(() => setWidth(85), 1600));
                    }, 120),
                );
            } else {
                setWidth(100);
                timers.current.push(
                    setTimeout(() => {
                        setVisible(false);
                        setWidth(0);
                    }, 260),
                );
            }
        });
    }, []);

    return (
        <div
            className="top-progress"
            role="progressbar"
            aria-hidden={!visible}
            aria-label="Memproses"
            style={{ opacity: visible ? 1 : 0 }}
        >
            <div className="top-progress-bar" style={{ width: `${width}%` }} />
        </div>
    );
}
