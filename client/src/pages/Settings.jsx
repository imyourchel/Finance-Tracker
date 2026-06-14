import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { updateProfileAPI, changePasswordAPI } from "../services/api";
import Card from "../components/ui/Card";
import PageHeader from "../components/Layout/PageHeader";
import {
    formatDateInput,
    formatNumberInput,
    parseNumberInput,
} from "../utils/format";

export default function Settings() {
    const { user, updateUser } = useAuth();

    const [profile, setProfile] = useState({
        name: user?.name || "",
        username: user?.username || "",
        avatar: user?.avatar || "",
        dateOfBirth: user?.dateOfBirth ? formatDateInput(user.dateOfBirth) : "",
        // keep avatar (URL) but support file upload below

        theme: user?.theme || "system",
        monthlyIncome:
            user?.monthlyIncome !== undefined && user?.monthlyIncome !== null
                ? formatNumberInput(user.monthlyIncome)
                : "",
        monthlyBudget:
            user?.monthlyBudget !== undefined && user?.monthlyBudget !== null
                ? formatNumberInput(user.monthlyBudget)
                : "",
    });

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const [notifications, setNotifications] = useState({
        dailyReminder: user?.notifications?.dailyReminder ?? true,
        budgetAlert: user?.notifications?.budgetAlert ?? true,
        goalAlert: user?.notifications?.goalAlert ?? true,
        reminderTime: user?.notifications?.reminderTime || "20:00",
    });

    const [password, setPassword] = useState({
        currentPassword: "",
        newPassword: "",
        confirm: "",
    });
    const [showPasswords, setShowPasswords] = useState({
        currentPassword: false,
        newPassword: false,
        confirm: false,
    });
    const [msg, setMsg] = useState({ profile: "", password: "" });
    const [err, setErr] = useState({ profile: "", password: "" });
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        window.scrollTo(0, 0);
        try {
            let res;
            if (selectedFile) {
                const form = new FormData();
                form.append("avatar", selectedFile);
                form.append("name", profile.name);
                form.append("username", profile.username);
                form.append("dateOfBirth", profile.dateOfBirth || "");
                form.append(
                    "monthlyIncome",
                    profile.monthlyIncome
                        ? parseNumberInput(profile.monthlyIncome)
                        : 0,
                );
                form.append(
                    "monthlyBudget",
                    profile.monthlyBudget
                        ? parseNumberInput(profile.monthlyBudget)
                        : 0,
                );
                form.append("theme", profile.theme);
                form.append("notifications", JSON.stringify(notifications));

                res = await updateProfileAPI(form);
            } else {
                res = await updateProfileAPI({
                    ...profile,
                    username: profile.username,
                    avatar: profile.avatar,
                    dateOfBirth: profile.dateOfBirth || null,
                    notifications,
                    monthlyIncome: profile.monthlyIncome
                        ? parseNumberInput(profile.monthlyIncome)
                        : 0,
                    monthlyBudget: profile.monthlyBudget
                        ? parseNumberInput(profile.monthlyBudget)
                        : 0,
                });
            }
            updateUser(res.data);
            setMsg({ ...msg, profile: "✅ Profil berhasil disimpan" });
        } catch (ex) {
            setErr({
                ...err,
                profile: ex.response?.data?.message || "Gagal menyimpan",
            });
        }
    };

    const handleFileChange = (e) => {
        const f = e.target.files?.[0];
        if (!f) return setSelectedFile(null);
        setSelectedFile(f);
        setFilePreview(URL.createObjectURL(f));
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        window.scrollTo(0, 0);
        setErr({ ...err, password: "" });
        setMsg({ ...msg, password: "" });
        if (password.newPassword !== password.confirm)
            return setErr({
                ...err,
                password: "Password baru dan konfirmasi tidak cocok",
            });
        if (password.newPassword.length < 6)
            return setErr({ ...err, password: "Password minimal 6 karakter" });
        try {
            await changePasswordAPI({
                currentPassword: password.currentPassword,
                newPassword: password.newPassword,
            });
            setPassword({ currentPassword: "", newPassword: "", confirm: "" });
            setMsg({ ...msg, password: "✅ Password berhasil diganti" });
        } catch (ex) {
            setErr({
                ...err,
                password: ex.response?.data?.message || "Gagal ganti password",
            });
        }
    };

    return (
        <div style={{ padding: "32px", maxWidth: "700px", margin: "0 auto" }}>
            <PageHeader
                title="Pengaturan"
                subtitle="Kelola profil dan preferensi akun"
            />

            {/* Profil */}
            <Card style={{ marginBottom: "24px" }}>
                <h2
                    style={{
                        fontSize: "16px",
                        fontWeight: "700",
                        margin: "0 0 20px",
                        color: "var(--app-text-strong)",
                    }}
                >
                    Informasi Profil
                </h2>

                {err.profile && <AlertBox type="error" msg={err.profile} />}
                {msg.profile && <AlertBox type="success" msg={msg.profile} />}

                <form onSubmit={handleSaveProfile}>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                            gap: "14px",
                            marginBottom: "14px",
                        }}
                    >
                        <Field label="Nama Lengkap">
                            <input
                                value={profile.name}
                                onChange={(e) =>
                                    setProfile({
                                        ...profile,
                                        name: e.target.value,
                                    })
                                }
                                style={inp}
                                required
                            />
                        </Field>
                        <Field label="Username">
                            <input
                                value={profile.username}
                                onChange={(e) =>
                                    setProfile({
                                        ...profile,
                                        username: e.target.value,
                                    })
                                }
                                placeholder="username"
                                required
                                disabled
                                style={{
                                    ...inp,
                                    backgroundColor: "var(--app-surface-soft)",
                                    color: "var(--app-muted)",
                                    cursor: "not-allowed",
                                }}
                            />
                        </Field>
                        <Field label="Email">
                            <input
                                value={user?.email || ""}
                                readOnly
                                disabled
                                style={{
                                    ...inp,
                                    backgroundColor: "var(--app-surface-soft)",
                                    color: "var(--app-muted)",
                                    cursor: "not-allowed",
                                }}
                            />
                        </Field>
                        {/* <Field label="Pilih File Gambar (opsional)">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                style={inp}
                            />
                        </Field> */}
                        <Field label="Tanggal Lahir">
                            <input
                                type="date"
                                value={profile.dateOfBirth}
                                onChange={(e) =>
                                    setProfile({
                                        ...profile,
                                        dateOfBirth: e.target.value,
                                    })
                                }
                                style={inp}
                            />
                        </Field>
                        {/* Removed phone, currency, language, timezone per request */}
                        <Field label="Pendapatan Bulanan (Rp)">
                            <input
                                type="text"
                                value={profile.monthlyIncome}
                                onChange={(e) =>
                                    setProfile({
                                        ...profile,
                                        monthlyIncome: formatNumberInput(
                                            e.target.value,
                                        ),
                                    })
                                }
                                style={inp}
                                placeholder="5.000.000"
                                inputMode="numeric"
                            />
                        </Field>
                        <Field label="Budget Bulanan (Rp)">
                            <input
                                type="text"
                                value={profile.monthlyBudget}
                                onChange={(e) =>
                                    setProfile({
                                        ...profile,
                                        monthlyBudget: formatNumberInput(
                                            e.target.value,
                                        ),
                                    })
                                }
                                style={inp}
                                placeholder="3.000.000"
                                inputMode="numeric"
                            />
                        </Field>
                        <Field label="Tema">
                            <select
                                value={profile.theme}
                                onChange={(e) =>
                                    setProfile({
                                        ...profile,
                                        theme: e.target.value,
                                    })
                                }
                                style={inp}
                            >
                                <option value="light">☀️ Light</option>
                                <option value="dark">🌙 Dark</option>
                                <option value="system">💻 System</option>
                            </select>
                        </Field>
                    </div>
                    <div
                        style={{
                            padding: "16px",
                            border: "1px solid var(--app-border)",
                            borderRadius: "14px",
                            marginBottom: "18px",
                            backgroundColor: "var(--app-surface-soft)",
                        }}
                    >
                        <h3
                            style={{
                                fontSize: "14px",
                                fontWeight: "700",
                                margin: "0 0 12px",
                                color: "var(--app-text-strong)",
                            }}
                        >
                            Notifikasi
                        </h3>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns:
                                    "repeat(2, minmax(0, 1fr))",
                                gap: "10px",
                            }}
                        >
                            {[
                                ["dailyReminder", "Reminder harian"],
                                ["budgetAlert", "Alert budget"],
                                ["goalAlert", "Alert goal"],
                            ].map(([key, label]) => (
                                <label
                                    key={key}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        fontSize: "13px",
                                        color: "var(--app-text)",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={notifications[key]}
                                        onChange={(e) =>
                                            setNotifications({
                                                ...notifications,
                                                [key]: e.target.checked,
                                            })
                                        }
                                    />
                                    {label}
                                </label>
                            ))}
                            <Field label="Waktu Reminder">
                                <input
                                    type="time"
                                    value={notifications.reminderTime}
                                    onChange={(e) =>
                                        setNotifications({
                                            ...notifications,
                                            reminderTime: e.target.value,
                                        })
                                    }
                                    style={inp}
                                />
                            </Field>
                        </div>
                    </div>
                    {/* <div style={{ marginBottom: "18px" }}>
                        <div
                            style={{
                                fontSize: "13px",
                                fontWeight: "600",
                                color: "var(--app-muted)",
                                marginBottom: "6px",
                            }}
                        >
                            Preview Avatar
                        </div>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                            }}
                        >
                            <div
                                style={{
                                    width: "56px",
                                    height: "56px",
                                    borderRadius: "16px",
                                    overflow: "hidden",
                                    background:
                                        "linear-gradient(135deg, var(--app-button-primary-from), var(--app-button-primary-to))",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "white",
                                    fontWeight: "800",
                                    fontSize: "18px",
                                }}
                            >
                                {filePreview || profile.avatar ? (
                                    <img
                                        src={filePreview || profile.avatar}
                                        alt="Avatar preview"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                        }}
                                    />
                                ) : (
                                    (profile.name || "U")
                                        .split(" ")
                                        .filter(Boolean)
                                        .slice(0, 2)
                                        .map((part) => part[0]?.toUpperCase())
                                        .join("") || "U"
                                )}
                            </div>
                            <div
                                style={{
                                    color: "var(--app-muted)",
                                    fontSize: "13px",
                                }}
                            >
                                Gunakan URL gambar agar avatar tampil di
                                sidebar.
                            </div>
                        </div>
                    </div> */}
                    <button type="submit" style={btnPrimary}>
                        Simpan Perubahan
                    </button>
                </form>
            </Card>

            {/* Ganti password */}
            <Card>
                <h2
                    style={{
                        fontSize: "16px",
                        fontWeight: "700",
                        margin: "0 0 20px",
                        color: "var(--app-text-strong)",
                    }}
                >
                    Ganti Password
                </h2>

                {err.password && <AlertBox type="error" msg={err.password} />}
                {msg.password && <AlertBox type="success" msg={msg.password} />}

                <form onSubmit={handleChangePassword}>
                    {[
                        { field: "currentPassword", label: "Password Lama" },
                        { field: "newPassword", label: "Password Baru" },
                        { field: "confirm", label: "Konfirmasi Password Baru" },
                    ].map(({ field, label }) => (
                        <Field
                            key={field}
                            label={label}
                            style={{ marginBottom: "14px" }}
                        >
                            <div style={{ position: "relative" }}>
                                <input
                                    type={
                                        showPasswords[field]
                                            ? "text"
                                            : "password"
                                    }
                                    value={password[field]}
                                    onChange={(e) =>
                                        setPassword({
                                            ...password,
                                            [field]: e.target.value,
                                        })
                                    }
                                    style={{
                                        ...inp,
                                        paddingRight: "56px",
                                    }}
                                    required
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPasswords({
                                            ...showPasswords,
                                            [field]: !showPasswords[field],
                                        })
                                    }
                                    style={{
                                        position: "absolute",
                                        top: "50%",
                                        right: "10px",
                                        transform: "translateY(-50%)",
                                        border: "none",
                                        background: "transparent",
                                        color: showPasswords[field]
                                            ? "var(--app-button-primary-from)"
                                            : "var(--app-muted)",
                                        cursor: "pointer",
                                        padding: "0px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        boxShadow: "none",
                                        outline: "none",
                                    }}
                                    aria-label={
                                        showPasswords[field]
                                            ? "Sembunyikan password"
                                            : "Lihat password"
                                    }
                                >
                                    <svg
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                        style={{ flexShrink: 0 }}
                                    >
                                        <path
                                            style={{
                                                display: showPasswords[field]
                                                    ? "none"
                                                    : "block",
                                            }}
                                            d="M9.88 9.88a3 3 0 1 0 4.24 4.24"
                                        />
                                        <path
                                            style={{
                                                display: showPasswords[field]
                                                    ? "none"
                                                    : "block",
                                            }}
                                            d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"
                                        />
                                        <path
                                            style={{
                                                display: showPasswords[field]
                                                    ? "none"
                                                    : "block",
                                            }}
                                            d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"
                                        />
                                        <line
                                            style={{
                                                display: showPasswords[field]
                                                    ? "none"
                                                    : "block",
                                            }}
                                            x1="2"
                                            x2="22"
                                            y1="2"
                                            y2="22"
                                        />
                                        <path
                                            style={{
                                                display: showPasswords[field]
                                                    ? "block"
                                                    : "none",
                                            }}
                                            d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"
                                        />
                                        <circle
                                            style={{
                                                display: showPasswords[field]
                                                    ? "block"
                                                    : "none",
                                            }}
                                            cx="12"
                                            cy="12"
                                            r="3"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </Field>
                    ))}
                    <button
                        type="submit"
                        style={{
                            ...btnPrimary,
                            backgroundColor: "#ef4444",
                            backgroundImage: "none",
                        }}
                    >
                        Ganti Password
                    </button>
                </form>
            </Card>
        </div>
    );
}

// Helper components
function Field({ label, children, style = {} }) {
    return (
        <div style={style}>
            <label
                style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "var(--app-muted)",
                    marginBottom: "6px",
                }}
            >
                {label}
            </label>
            {children}
        </div>
    );
}

function AlertBox({ type, msg }) {
    const isErr = type === "error";
    return (
        <div
            style={{
                padding: "10px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                marginBottom: "14px",
                backgroundColor: isErr
                    ? "rgba(239, 68, 68, 0.1)"
                    : "rgba(16, 185, 129, 0.1)",
                color: isErr ? "#ef4444" : "#10b981",
                border: `1px solid ${isErr ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
            }}
        >
            {msg}
        </div>
    );
}

const inp = {
    width: "100%",
    padding: "10px 12px",
    border: "1.5px solid var(--app-border)",
    borderRadius: "10px",
    fontSize: "14px",
    boxSizing: "border-box",
    backgroundColor: "var(--app-surface)",
    color: "var(--app-text-strong)",
};
const btnPrimary = {
    padding: "11px 24px",
    background:
        "linear-gradient(135deg,var(--app-button-primary-from),var(--app-button-primary-to))",
    color: "var(--app-button-primary-text)",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "14px",
};