import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import Toast from "../components/Toast";

function OrganizationSettings({ onBack }) {
  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    ice: "",
    rc: "",
    if_number: "",
    patente: "",
    tva_enabled: false,
    tva_rate: "20",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "info", duration = 3000) => {
    setToast({ message, type, duration });
  }, []);

  useEffect(() => {
    api.get("/organization/settings")
      .then((res) => {
        const org = res.data.organization;
        setForm({
          name: org.name || "",
          address: org.address || "",
          phone: org.phone || "",
          email: org.email || "",
          ice: org.ice || "",
          rc: org.rc || "",
          if_number: org.if_number || "",
          patente: org.patente || "",
          tva_enabled: !!org.tva_enabled,
          tva_rate: org.tva_rate != null ? String(org.tva_rate) : "20",
        });
      })
      .catch((e) => showToast("Erreur de chargement: " + (e.response?.data?.message || e.message), "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  const handleChange = (field) => (e) => {
    const value = field === "tva_enabled" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/organization/settings", {
        ...form,
        tva_rate: form.tva_rate === "" ? 0 : parseFloat(form.tva_rate),
      });
      showToast("Informations mises à jour avec succès", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Erreur lors de l'enregistrement", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div style={styles.header}>
        <div>
          <button onClick={onBack} style={styles.backBtn}>← Retour</button>
          <h1 style={styles.title}>Informations légales</h1>
          <p style={styles.subtitle}>
            Ces informations apparaissent sur les tickets/factures émis à vos clients.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={styles.formCard}>
        <div style={styles.sectionTitle}>Identité de l'entreprise</div>
        <div style={styles.grid}>
          <Field label="Nom commercial" value={form.name} onChange={handleChange("name")} required />
          <Field label="Email" type="email" value={form.email} onChange={handleChange("email")} />
          <Field label="Adresse" value={form.address} onChange={handleChange("address")} full />
          <Field label="Téléphone" value={form.phone} onChange={handleChange("phone")} />
        </div>

        <div style={styles.sectionTitle}>Identifiants légaux</div>
        <div style={styles.grid}>
          <Field label="ICE" value={form.ice} onChange={handleChange("ice")} placeholder="000000000000000" />
          <Field label="Registre de Commerce (RC)" value={form.rc} onChange={handleChange("rc")} />
          <Field label="Identifiant Fiscal (IF)" value={form.if_number} onChange={handleChange("if_number")} />
          <Field label="Patente" value={form.patente} onChange={handleChange("patente")} />
        </div>

        <div style={styles.sectionTitle}>TVA</div>
        <div style={styles.tvaRow}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={form.tva_enabled}
              onChange={handleChange("tva_enabled")}
              style={styles.checkbox}
            />
            Appliquer la TVA sur les ventes
          </label>
          {form.tva_enabled && (
            <div style={styles.tvaRateField}>
              <Field
                label="Taux TVA (%)"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.tva_rate}
                onChange={handleChange("tva_rate")}
              />
            </div>
          )}
        </div>
        <p style={styles.hint}>
          Si désactivée, aucune TVA n'est ajoutée aux tickets (cas des auto-entrepreneurs et petites structures non assujetties).
        </p>

        <button type="submit" disabled={saving} style={styles.saveBtn}>
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, full, ...inputProps }) {
  return (
    <div style={{ ...styles.field, ...(full ? { gridColumn: "1 / -1" } : {}) }}>
      <label style={styles.label}>{label}</label>
      <input {...inputProps} style={styles.input} />
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", backgroundColor: "#f7f5f2", padding: "40px" },
  loadingContainer: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", backgroundColor: "#f7f5f2", color: "#1a1410" },
  spinner: { width: "50px", height: "50px", border: "4px solid rgba(0, 0, 0, 0.06)", borderTop: "4px solid #c9a24b", borderRadius: "50%", animation: "spin 1s linear infinite" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "30px" },
  backBtn: { background: "rgba(0, 0, 0, 0.04)", border: "1px solid #e8e2d8", color: "#6b6155", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", marginBottom: "16px" },
  title: { margin: 0, fontSize: "32px", fontWeight: "700", color: "#1a1410" },
  subtitle: { margin: "8px 0 0", fontSize: "14px", color: "#6b6155", maxWidth: "520px" },
  formCard: { background: "#ffffff", borderRadius: "16px", border: "1px solid #e8e2d8", padding: "32px", maxWidth: "760px" },
  sectionTitle: { fontSize: "14px", fontWeight: "700", color: "#3f3a30", textTransform: "uppercase", letterSpacing: "0.4px", margin: "0 0 16px", paddingBottom: "8px", borderBottom: "1px solid #e8e2d8" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "32px" },
  field: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: "13px", fontWeight: "600", color: "#6b6155" },
  input: { padding: "10px 14px", borderRadius: "10px", border: "1px solid #e8e2d8", fontSize: "14px", color: "#1a1410", background: "#f7f5f2" },
  tvaRow: { display: "flex", alignItems: "center", gap: "24px", marginBottom: "8px" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: "600", color: "#1a1410", cursor: "pointer" },
  checkbox: { width: "18px", height: "18px", cursor: "pointer" },
  tvaRateField: { width: "160px" },
  hint: { fontSize: "13px", color: "#9a9184", margin: "0 0 28px" },
  saveBtn: { background: "linear-gradient(135deg, #e0b85c 0%, #c9a24b 100%)", border: "none", color: "#1a1408", padding: "12px 28px", borderRadius: "12px", cursor: "pointer", fontSize: "15px", fontWeight: "700", boxShadow: "0 4px 12px rgba(201, 162, 75, 0.35)" },
};

export default OrganizationSettings;
