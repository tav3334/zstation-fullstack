import { useState, useEffect } from "react";
import api from "../services/api";
import {
  Wallet,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle,
  History,
  Lock,
  Printer,
  X
} from "lucide-react";
import useConfirm from "../hooks/useConfirm";

const PAYMENT_LABELS = { cash: "Espèces", card: "Carte", mobile: "Mobile" };

function CashRegister({ isAdmin = false, canWithdraw = false, accentColor = "#f59e0b" }) {
  const [register, setRegister] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [closedReport, setClosedReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [closingAmount, setClosingAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const { confirm, ConfirmModal } = useConfirm();

  useEffect(() => {
    loadRegister();
    const interval = setInterval(() => loadRegister(false), 60000);
    return () => clearInterval(interval);
  }, []);

  const loadRegister = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await api.get("/cash-register/today");
      setRegister(res.data.register);
      setError(null);
    } catch {
      setError("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await api.get("/cash-register/history?limit=14");
      setHistory(res.data.registers || []);
      setShowHistoryModal(true);
    } catch {
      setError("Erreur de chargement historique");
    }
  };

  const handleSetOpeningBalance = async () => {
    if (!amount || parseFloat(amount) < 0) return;
    setProcessing(true);
    try {
      const res = await api.post("/cash-register/opening-balance", {
        amount: parseFloat(amount)
      });
      setRegister(res.data.register);
      setShowOpeningModal(false);
      setAmount("");
    } catch (e) {
      setError(e.response?.data?.message || "Erreur");
    } finally {
      setProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setProcessing(true);
    try {
      const res = await api.post("/cash-register/withdraw", {
        amount: parseFloat(amount),
        notes: notes
      });
      setRegister(res.data.register);
      setShowWithdrawModal(false);
      setAmount("");
      setNotes("");
    } catch (e) {
      setError(e.response?.data?.message || "Erreur");
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = async () => {
    if (closingAmount === "" || parseFloat(closingAmount) < 0) return;
    const ok = await confirm(
      "Clôturer la caisse du jour ? Cette action enregistre le rapport de clôture et ne peut pas être annulée depuis cet écran.",
      { confirmLabel: "Clôturer la caisse", cancelLabel: "Annuler" }
    );
    if (!ok) return;

    setProcessing(true);
    try {
      const res = await api.post("/cash-register/close", {
        closing_balance: parseFloat(closingAmount),
        notes: notes || undefined,
      });
      setRegister(res.data.register);
      setClosedReport(res.data.register);
      setShowCloseModal(false);
      setShowReport(true);
      setClosingAmount("");
      setNotes("");
    } catch (e) {
      setError(e.response?.data?.message || "Erreur lors de la clôture");
    } finally {
      setProcessing(false);
    }
  };

  const openReportFor = (item) => {
    setClosedReport(item);
    setShowReport(true);
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <RefreshCw size={24} color={accentColor} className="spin" />
        <span style={styles.loadingText}>Chargement caisse...</span>
      </div>
    );
  }

  if (!register) {
    return (
      <div style={styles.errorContainer}>
        <AlertCircle size={24} color="#ef4444" />
        <span style={styles.errorText}>{error || "Caisse non disponible"}</span>
        <button onClick={() => loadRegister()} style={{...styles.retryBtn, background: accentColor}}>
          Reessayer
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={{...styles.iconBox, background: `${accentColor}20`}}>
            <Wallet size={20} color={accentColor} />
          </div>
          <div>
            <h3 style={styles.title}>Fond de Caisse</h3>
            <span style={styles.date}>{register.date_formatted}</span>
          </div>
        </div>
        <div style={styles.headerRight}>
          <button onClick={loadHistory} style={styles.historyBtn}>
            <History size={16} />
          </button>
          <button onClick={() => loadRegister()} style={styles.refreshBtn}>
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={styles.statsGrid}>
        {/* Fond Initial */}
        <div style={styles.statCard} onClick={isAdmin ? () => setShowOpeningModal(true) : undefined}>
          <div style={{...styles.statIcon, background: 'rgba(59, 130, 246, 0.1)'}}>
            <DollarSign size={18} color="#3b82f6" />
          </div>
          <div style={styles.statInfo}>
            <span style={styles.statLabel}>Fond Initial</span>
            <span style={{...styles.statValue, color: '#3b82f6'}}>
              {register.opening_balance.toFixed(2)} DH
            </span>
          </div>
          {isAdmin && <span style={styles.editHint}>Modifier</span>}
        </div>

        {/* Cash Recu */}
        <div style={styles.statCard}>
          <div style={{...styles.statIcon, background: 'rgba(16, 185, 129, 0.1)'}}>
            <ArrowDownLeft size={18} color="#10b981" />
          </div>
          <div style={styles.statInfo}>
            <span style={styles.statLabel}>Cash Recu</span>
            <span style={{...styles.statValue, color: '#10b981'}}>
              +{register.total_cash_in.toFixed(2)} DH
            </span>
          </div>
        </div>

        {/* Monnaie Rendue */}
        <div style={styles.statCard}>
          <div style={{...styles.statIcon, background: 'rgba(239, 68, 68, 0.1)'}}>
            <ArrowUpRight size={18} color="#ef4444" />
          </div>
          <div style={styles.statInfo}>
            <span style={styles.statLabel}>Monnaie Rendue</span>
            <span style={{...styles.statValue, color: '#ef4444'}}>
              -{register.total_change_out.toFixed(2)} DH
            </span>
          </div>
        </div>

        {/* Retraits */}
        <div style={styles.statCard}>
          <div style={{...styles.statIcon, background: 'rgba(224, 184, 92, 0.1)'}}>
            <Wallet size={18} color="#e0b85c" />
          </div>
          <div style={styles.statInfo}>
            <span style={styles.statLabel}>Retraits</span>
            <span style={{...styles.statValue, color: '#e0b85c'}}>
              -{register.withdrawn_amount.toFixed(2)} DH
            </span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={styles.summaryGrid}>
        {/* Profit Net */}
        <div style={{...styles.summaryCard, borderColor: '#10b981'}}>
          <div style={styles.summaryHeader}>
            <TrendingUp size={20} color="#10b981" />
            <span style={{...styles.summaryLabel, color: '#10b981'}}>Profit Net du Jour</span>
          </div>
          <div style={{...styles.summaryValue, color: '#10b981'}}>
            {register.net_profit.toFixed(2)} DH
          </div>
        </div>

        {/* Solde Actuel */}
        <div style={{...styles.summaryCard, borderColor: accentColor}}>
          <div style={styles.summaryHeader}>
            <Wallet size={20} color={accentColor} />
            <span style={{...styles.summaryLabel, color: accentColor}}>Solde en Caisse</span>
          </div>
          <div style={{...styles.summaryValue, color: accentColor}}>
            {register.current_balance.toFixed(2)} DH
          </div>
        </div>
      </div>

      {/* Admin Actions */}
      {(isAdmin || canWithdraw) && (
        <div style={styles.actionsRow}>
          <button
            onClick={() => setShowWithdrawModal(true)}
            style={{...styles.actionBtn, background: accentColor}}
            disabled={register.current_balance <= 0 || !!register.closed_at}
          >
            <ArrowUpRight size={18} />
            Retirer Profit
          </button>
          {!isAdmin ? null : register.closed_at ? (
            <button onClick={() => openReportFor(register)} style={{...styles.actionBtn, background: '#3f3a30'}}>
              <Printer size={18} />
              Voir le rapport
            </button>
          ) : (
            <button
              onClick={() => { setClosingAmount(register.current_balance.toFixed(2)); setShowCloseModal(true); }}
              style={{...styles.actionBtn, background: '#dc2626'}}
            >
              <Lock size={18} />
              Clôturer la caisse
            </button>
          )}
        </div>
      )}

      {/* Status */}
      <div style={styles.statusRow}>
        <div style={styles.statusItem}>
          <Clock size={14} color="#6b6155" />
          <span>Ouvert a {register.opened_at || '--:--'}</span>
        </div>
        {register.closed_at && (
          <div style={styles.statusItem}>
            <CheckCircle size={14} color="#10b981" />
            <span>Ferme a {register.closed_at}</span>
          </div>
        )}
      </div>

      {/* Opening Balance Modal */}
      {showOpeningModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Modifier Fond de Caisse</h3>
              <button onClick={() => setShowOpeningModal(false)} style={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>
            <div style={styles.modalBody}>
              <label style={styles.inputLabel}>Montant initial (DH)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ex: 500"
                style={styles.input}
                autoFocus
              />
              <p style={styles.hint}>
                Ce montant represente l'argent laisse dans la caisse au debut de la journee.
              </p>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowOpeningModal(false)} style={styles.cancelBtn}>
                Annuler
              </button>
              <button
                onClick={handleSetOpeningBalance}
                disabled={processing || !amount}
                style={{...styles.confirmBtn, background: accentColor}}
              >
                {processing ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Retirer le Profit</h3>
              <button onClick={() => setShowWithdrawModal(false)} style={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.availableBox}>
                <span>Disponible en caisse:</span>
                <strong style={{color: accentColor}}>{register.current_balance.toFixed(2)} DH</strong>
              </div>
              <label style={styles.inputLabel}>Montant a retirer (DH)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ex: 1000"
                style={styles.input}
                max={register.current_balance}
                autoFocus
              />
              <label style={styles.inputLabel}>Note (optionnel)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Retrait fin de journee"
                style={styles.input}
              />
              {amount && parseFloat(amount) > register.current_balance && (
                <p style={styles.errorHint}>
                  Montant superieur au solde disponible!
                </p>
              )}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowWithdrawModal(false)} style={styles.cancelBtn}>
                Annuler
              </button>
              <button
                onClick={handleWithdraw}
                disabled={processing || !amount || parseFloat(amount) > register.current_balance}
                style={{...styles.confirmBtn, background: '#10b981'}}
              >
                {processing ? 'Retrait...' : `Retirer ${amount || 0} DH`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div style={styles.modalOverlay}>
          <div style={{...styles.modal, maxWidth: '500px'}}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Historique Caisse (14 derniers jours)</h3>
              <button onClick={() => setShowHistoryModal(false)} style={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>
            <div style={{...styles.modalBody, maxHeight: '400px', overflowY: 'auto'}}>
              {history.length === 0 ? (
                <p style={styles.emptyHistory}>Aucun historique disponible</p>
              ) : (
                <div style={styles.historyList}>
                  {history.map((item) => (
                    <div key={item.id} style={styles.historyItem}>
                      <div style={styles.historyDate}>
                        {item.date_formatted}
                        {item.closed_at && (
                          <button
                            onClick={() => { setShowHistoryModal(false); openReportFor(item); }}
                            style={styles.historyReportBtn}
                          >
                            <Printer size={12} /> Rapport
                          </button>
                        )}
                      </div>
                      <div style={styles.historyDetails}>
                        <div style={styles.historyRow}>
                          <span>Fond:</span>
                          <span>{item.opening_balance.toFixed(2)} DH</span>
                        </div>
                        <div style={styles.historyRow}>
                          <span>Cash recu:</span>
                          <span style={{color: '#10b981'}}>+{item.total_cash_in.toFixed(2)} DH</span>
                        </div>
                        <div style={styles.historyRow}>
                          <span>Monnaie:</span>
                          <span style={{color: '#ef4444'}}>-{item.total_change_out.toFixed(2)} DH</span>
                        </div>
                        <div style={styles.historyRow}>
                          <span>Retraits:</span>
                          <span style={{color: '#e0b85c'}}>-{item.withdrawn_amount.toFixed(2)} DH</span>
                        </div>
                        <div style={{...styles.historyRow, fontWeight: '700', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e8e2d8'}}>
                          <span>Profit net:</span>
                          <span style={{color: '#10b981'}}>{item.net_profit.toFixed(2)} DH</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowHistoryModal(false)} style={styles.cancelBtn}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Register Modal */}
      {showCloseModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Clôturer la caisse</h3>
              <button onClick={() => setShowCloseModal(false)} style={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.availableBox}>
                <span>Solde attendu (théorique):</span>
                <strong style={{color: accentColor}}>{register.current_balance.toFixed(2)} DH</strong>
              </div>
              <label style={styles.inputLabel}>Montant compté en caisse (DH)</label>
              <input
                type="number"
                value={closingAmount}
                onChange={(e) => setClosingAmount(e.target.value)}
                placeholder="Ex: 1250.00"
                style={styles.input}
                autoFocus
              />
              {closingAmount !== "" && (
                (() => {
                  const diff = parseFloat(closingAmount) - register.current_balance;
                  if (Math.abs(diff) < 0.01) return <p style={{...styles.hint, color: '#10b981'}}>✓ Le compte est exact.</p>;
                  return (
                    <p style={{...styles.errorHint, color: diff > 0 ? '#3b82f6' : '#dc2626'}}>
                      Écart: {diff > 0 ? '+' : ''}{diff.toFixed(2)} DH {diff > 0 ? '(excédent)' : '(manquant)'}
                    </p>
                  );
                })()
              )}
              <label style={styles.inputLabel}>Note (optionnel)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Écart justifié par..."
                style={styles.input}
              />
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowCloseModal(false)} style={styles.cancelBtn}>
                Annuler
              </button>
              <button
                onClick={handleClose}
                disabled={processing || closingAmount === ""}
                style={{...styles.confirmBtn, background: '#dc2626'}}
              >
                {processing ? 'Clôture...' : 'Clôturer la caisse'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Closing Report (Rapport Z) */}
      {showReport && closedReport && (
        <div style={styles.modalOverlay} className="no-print">
          <div style={{...styles.modal, maxWidth: '420px'}}>
            <div style={styles.modalHeader} className="no-print">
              <h3 style={styles.modalTitle}>Rapport de clôture</h3>
              <button onClick={() => setShowReport(false)} style={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>

            <div id="z-report-print-area" style={styles.reportBody}>
              <div style={styles.reportCenter}>
                <div style={styles.reportBrand}>RAPPORT DE CLÔTURE DE CAISSE</div>
                <div style={styles.reportSub}>{closedReport.date_formatted}</div>
              </div>

              <div style={styles.reportDivider} />

              <div style={styles.reportRow}>
                <span>Ouverture:</span>
                <span>{closedReport.opened_at || '--:--'} {closedReport.opened_by_name ? `(${closedReport.opened_by_name})` : ''}</span>
              </div>
              <div style={styles.reportRow}>
                <span>Clôture:</span>
                <span>{closedReport.closed_at || '--:--'} {closedReport.closed_by_name ? `(${closedReport.closed_by_name})` : ''}</span>
              </div>

              <div style={styles.reportDivider} />

              <div style={styles.reportSectionTitle}>Ventes par moyen de paiement</div>
              {closedReport.payment_breakdown && Object.entries(PAYMENT_LABELS).map(([key, label]) => (
                <div key={key} style={styles.reportRow}>
                  <span>{label}:</span>
                  <span>{(closedReport.payment_breakdown[key] || 0).toFixed(2)} DH</span>
                </div>
              ))}
              <div style={{...styles.reportRow, fontWeight: 700}}>
                <span>Total ventes:</span>
                <span>{(closedReport.payment_breakdown?.total || 0).toFixed(2)} DH</span>
              </div>

              <div style={styles.reportDivider} />

              <div style={styles.reportSectionTitle}>Caisse (espèces)</div>
              <div style={styles.reportRow}>
                <span>Fond initial:</span>
                <span>{closedReport.opening_balance.toFixed(2)} DH</span>
              </div>
              <div style={styles.reportRow}>
                <span>Cash reçu:</span>
                <span>+{closedReport.total_cash_in.toFixed(2)} DH</span>
              </div>
              <div style={styles.reportRow}>
                <span>Monnaie rendue:</span>
                <span>-{closedReport.total_change_out.toFixed(2)} DH</span>
              </div>
              <div style={styles.reportRow}>
                <span>Retraits:</span>
                <span>-{closedReport.withdrawn_amount.toFixed(2)} DH</span>
              </div>
              <div style={{...styles.reportRow, fontWeight: 700}}>
                <span>Solde théorique:</span>
                <span>{closedReport.current_balance.toFixed(2)} DH</span>
              </div>
              <div style={{...styles.reportRow, fontWeight: 700}}>
                <span>Solde compté:</span>
                <span>{closedReport.closing_balance != null ? closedReport.closing_balance.toFixed(2) : '-'} DH</span>
              </div>

              <div style={styles.reportDivider} />

              <div style={{
                ...styles.reportTotalRow,
                color: closedReport.difference == null || Math.abs(closedReport.difference) < 0.01
                  ? '#10b981' : (closedReport.difference > 0 ? '#3b82f6' : '#dc2626'),
              }}>
                <span>ÉCART:</span>
                <span>
                  {closedReport.difference == null ? '-' :
                    `${closedReport.difference > 0 ? '+' : ''}${closedReport.difference.toFixed(2)} DH`}
                </span>
              </div>

              {closedReport.notes && (
                <>
                  <div style={styles.reportDivider} />
                  <div style={styles.reportNotes}>{closedReport.notes}</div>
                </>
              )}

              <div style={styles.reportDivider} />
              <div style={styles.reportSignatureRow}>
                <div style={styles.reportSignatureBox}>Signature responsable</div>
              </div>
            </div>

            <div style={styles.modalFooter} className="no-print">
              <button onClick={() => setShowReport(false)} style={styles.cancelBtn}>
                Fermer
              </button>
              <button onClick={() => window.print()} style={{...styles.confirmBtn, background: accentColor}}>
                <Printer size={16} style={{ marginRight: 6 }} />
                Imprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {ConfirmModal}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #z-report-print-area, #z-report-print-area * { visibility: visible; }
          #z-report-print-area {
            position: absolute;
            top: 0;
            left: 0;
            width: 80mm;
            margin: 0;
            padding: 4mm;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid #e8e2d8',
  },
  reportBody: {
    background: '#ffffff',
    color: '#000000',
    padding: '20px',
    fontFamily: "'Courier New', monospace",
    fontSize: '12px',
    lineHeight: 1.6,
  },
  reportCenter: { textAlign: 'center' },
  reportBrand: { fontWeight: '700', fontSize: '13px', letterSpacing: '0.5px' },
  reportSub: { fontSize: '12px', marginTop: '2px' },
  reportDivider: { borderTop: '1px dashed #000', margin: '10px 0' },
  reportSectionTitle: { fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' },
  reportRow: { display: 'flex', justifyContent: 'space-between' },
  reportTotalRow: { display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '15px' },
  reportNotes: { fontSize: '11px', whiteSpace: 'pre-wrap' },
  reportSignatureRow: { marginTop: '30px', textAlign: 'center' },
  reportSignatureBox: { borderTop: '1px solid #000', paddingTop: '4px', fontSize: '10px', display: 'inline-block', minWidth: '160px' },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '40px',
    color: '#6b6155',
  },
  loadingText: {
    fontSize: '14px',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '40px',
  },
  errorText: {
    color: '#dc2626',
    fontSize: '14px',
  },
  retryBtn: {
    padding: '8px 16px',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  iconBox: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '700',
    color: '#1a1410',
  },
  date: {
    fontSize: '12px',
    color: '#6b6155',
  },
  headerRight: {
    display: 'flex',
    gap: '8px',
  },
  historyBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    background: '#f3f0ea',
    border: 'none',
    color: '#6b6155',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    background: '#f3f0ea',
    border: 'none',
    color: '#6b6155',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginBottom: '16px',
  },
  statCard: {
    background: '#f3f0ea',
    borderRadius: '12px',
    padding: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    position: 'relative',
    cursor: 'default',
  },
  statIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  statLabel: {
    fontSize: '11px',
    color: '#6b6155',
    fontWeight: '500',
  },
  statValue: {
    fontSize: '15px',
    fontWeight: '700',
  },
  editHint: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    fontSize: '9px',
    color: '#6b6155',
    background: '#e8e2d8',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginBottom: '16px',
  },
  summaryCard: {
    background: '#f3f0ea',
    borderRadius: '12px',
    padding: '16px',
    borderLeft: '4px solid',
    textAlign: 'center',
  },
  summaryHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  summaryLabel: {
    fontSize: '12px',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: '24px',
    fontWeight: '800',
  },
  actionsRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
  },
  actionBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '20px',
    fontSize: '12px',
    color: '#6b6155',
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modal: {
    background: '#ffffff',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '400px',
    border: '1px solid #e8e2d8',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #e8e2d8',
  },
  modalTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '700',
    color: '#1a1410',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#6b6155',
    cursor: 'pointer',
    padding: '4px',
  },
  modalBody: {
    padding: '20px',
  },
  modalFooter: {
    display: 'flex',
    gap: '12px',
    padding: '16px 20px',
    borderTop: '1px solid #e8e2d8',
  },
  inputLabel: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: '#6b6155',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '12px',
    background: '#f7f5f2',
    border: '1px solid #e8e2d8',
    borderRadius: '8px',
    color: '#1a1410',
    fontSize: '16px',
    marginBottom: '16px',
    boxSizing: 'border-box',
  },
  hint: {
    fontSize: '12px',
    color: '#6b6155',
    margin: 0,
  },
  errorHint: {
    fontSize: '12px',
    color: '#dc2626',
    margin: 0,
  },
  availableBox: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: '#f7f5f2',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '14px',
    color: '#6b6155',
  },
  cancelBtn: {
    flex: 1,
    padding: '12px',
    background: '#e8e2d8',
    color: '#3f3a30',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    padding: '12px',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
  emptyHistory: {
    textAlign: 'center',
    color: '#6b6155',
    padding: '20px',
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  historyItem: {
    background: '#f7f5f2',
    borderRadius: '10px',
    padding: '14px',
  },
  historyDate: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#1a1410',
    marginBottom: '10px',
    paddingBottom: '8px',
    borderBottom: '1px solid #e8e2d8',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyReportBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#6b6155',
    background: '#f3f0ea',
    border: 'none',
    borderRadius: '6px',
    padding: '4px 8px',
    cursor: 'pointer',
  },
  historyDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  historyRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    color: '#6b6155',
  },
};

export default CashRegister;
