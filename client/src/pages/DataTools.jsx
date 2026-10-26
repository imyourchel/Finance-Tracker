import { useSearchParams } from "react-router-dom";
import { FiDownload, FiUploadCloud } from "react-icons/fi";
import PageHeader from "../components/Layout/PageHeader";
import ExportPanel from "../components/data/ExportPanel";
import ImportWizard from "../components/data/ImportWizard";
import "../styles/data.css";

const TABS = [
    { id: "ekspor", label: "Ekspor", icon: FiDownload },
    { id: "impor", label: "Impor mutasi", icon: FiUploadCloud },
];

/** Ekspor & impor data: CSV transaksi, laporan bulanan, cadangan JSON, impor mutasi rekening. */
export default function DataTools() {
    const [params, setParams] = useSearchParams();
    const tab = params.get("tab") === "impor" ? "impor" : "ekspor";

    return (
        <div className="dt-page">
            <PageHeader
                title="Ekspor & Impor"
                subtitle="Bawa datamu ke Excel, cetak laporan bulanan, simpan cadangan, atau impor mutasi rekening bank."
            />
            <nav className="dt-tabs" role="tablist" aria-label="Ekspor atau impor">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={tab === id}
                        className={`dt-tab ${tab === id ? "is-active" : ""}`}
                        onClick={() => setParams(id === "ekspor" ? {} : { tab: id }, { replace: true })}
                    >
                        <Icon aria-hidden /> {label}
                    </button>
                ))}
            </nav>
            {tab === "ekspor" ? <ExportPanel /> : <ImportWizard />}
        </div>
    );
}
