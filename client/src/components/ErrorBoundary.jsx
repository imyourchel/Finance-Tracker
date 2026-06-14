import { Component } from "react";

export default class ErrorBoundary extends Component {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: "40px", textAlign: "center" }}>
                    <p>Terjadi kesalahan. Coba refresh halaman.</p>
                    <button onClick={() => window.location.reload()}>
                        Refresh
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}