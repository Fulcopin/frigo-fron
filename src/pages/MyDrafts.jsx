import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import authService from "../services/authService"

const API_URL = import.meta.env.VITE_API_BASE_URL || "https://backend-frigo.onrender.com/api"

function MyDrafts() {
  const navigate = useNavigate()
  const currentUser = authService.getCurrentUser()
  
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")

  const fetchDrafts = useCallback(async () => {
    if (!currentUser?.username) {
      setError("No se pudo identificar el usuario")
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`${API_URL}/FormDrafts/my/${encodeURIComponent(currentUser.username)}`)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data = await res.json()
      // Manejar formato $values de .NET ReferenceHandler.Preserve
      const draftsArray = Array.isArray(data) ? data : (data.$values || [])
      setDrafts(draftsArray)
    } catch (err) {
      console.error("Error cargando borradores:", err)
      setError("No se pudieron cargar los borradores")
    } finally {
      setLoading(false)
    }
  }, [currentUser?.username])

  useEffect(() => {
    fetchDrafts()
  }, [fetchDrafts])

  const handleDelete = async (draftId) => {
    if (!window.confirm("¿Estás seguro de eliminar este borrador?")) return
    try {
      setDeletingId(draftId)
      const res = await fetch(`${API_URL}/FormDrafts/${draftId}`, { method: "DELETE" })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      setDrafts(prev => prev.filter(d => d.draftID !== draftId))
    } catch (err) {
      console.error("Error eliminando borrador:", err)
      alert("Error al eliminar el borrador")
    } finally {
      setDeletingId(null)
    }
  }

  const handleResume = async (draft) => {
    try {
      // Fetch full draft data (the list endpoint might not include all JSON fields)
      const res = await fetch(`${API_URL}/FormDrafts/${draft.draftID}`)
      if (!res.ok) {
        const errText = await res.text()
        console.error("Error respuesta del servidor:", res.status, errText)
        throw new Error(`Error del servidor: ${res.status} - ${errText}`)
      }
      const fullDraft = await res.json()
      
      console.log("📋 Borrador completo recibido:", {
        draftID: fullDraft.draftID,
        templateID: fullDraft.templateID,
        hasHeader: !!fullDraft.headerData,
        hasBody: !!fullDraft.bodyData,
        hasFirmas: !!fullDraft.firmasData,
        hasSnapshot: !!fullDraft.templateSnapshot,
        headerType: typeof fullDraft.headerData,
        bodyType: typeof fullDraft.bodyData,
      })

      // Función auxiliar para parsear JSON de forma segura
      const safeParse = (data, fieldName, fallback) => {
        if (!data) return fallback
        if (typeof data === 'object') return data // ya es objeto
        try {
          return JSON.parse(data)
        } catch (e) {
          console.error(`⚠️ Error parseando ${fieldName}:`, e.message)
          console.error(`   Valor (primeros 200 chars): ${String(data).substring(0, 200)}`)
          return fallback
        }
      }

      const parsedHeader = safeParse(fullDraft.headerData, "headerData", {})
      const parsedBody = safeParse(fullDraft.bodyData, "bodyData", [])
      const parsedFirmas = safeParse(fullDraft.firmasData, "firmasData", {})
      const parsedSnapshot = safeParse(fullDraft.templateSnapshot, "templateSnapshot", null)

      console.log("✅ Datos parseados:", {
        headerKeys: Object.keys(parsedHeader).length,
        bodyLength: Array.isArray(parsedBody) ? parsedBody.length : 'not-array',
        firmasKeys: Object.keys(parsedFirmas).length,
        hasSnapshot: !!parsedSnapshot
      })
      
      // Navigate to FillForm with draft data in location state
      navigate("/fill-form", {
        state: {
          resumeDraft: {
            draftId: fullDraft.draftID,
            templateId: fullDraft.templateID,
            headerData: parsedHeader,
            bodyData: Array.isArray(parsedBody) ? parsedBody : [],
            firmasData: parsedFirmas,
            templateSnapshot: parsedSnapshot,
            nota: fullDraft.nota || ""
          }
        }
      })
    } catch (err) {
      console.error("Error cargando borrador completo:", err)
      alert("Error al cargar el borrador: " + err.message + "\n\nRevisa la consola del navegador (F12) para más detalles.")
    }
  }

  const getProgressColor = (progress) => {
    if (progress >= 75) return "#22c55e"
    if (progress >= 50) return "#eab308"
    if (progress >= 25) return "#f97316"
    return "#ef4444"
  }

  const getDaysColor = (days) => {
    if (days >= 5) return "#22c55e"
    if (days >= 3) return "#eab308"
    if (days >= 1) return "#f97316"
    return "#ef4444"
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return "—"
    const d = new Date(dateStr)
    return d.toLocaleDateString("es-EC", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    })
  }

  const filteredDrafts = drafts.filter(d => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      (d.templateName || "").toLowerCase().includes(term) ||
      (d.templateCodigo || "").toLowerCase().includes(term) ||
      (d.nota || "").toLowerCase().includes(term)
    )
  })

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>📋 Mis Borradores</h1>
          <p style={styles.subtitle}>
            Formularios guardados que puedes continuar llenando
          </p>
        </div>
        <div style={styles.headerRight}>
          <button onClick={fetchDrafts} style={styles.refreshBtn} disabled={loading}>
            🔄 Actualizar
          </button>
          <button onClick={() => navigate("/fill-form")} style={styles.newFormBtn}>
            ➕ Nuevo Formulario
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={styles.searchBar}>
        <input
          type="text"
          placeholder="🔍 Buscar por nombre de plantilla, código o nota..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm("")} style={styles.clearSearchBtn}>✕</button>
        )}
      </div>

      {/* Stats */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <span style={styles.statNumber}>{drafts.length}</span>
          <span style={styles.statLabel}>Total Borradores</span>
        </div>
        <div style={{ ...styles.statCard, borderLeft: "4px solid #f97316" }}>
          <span style={styles.statNumber}>
            {drafts.filter(d => (d.daysLeft || 0) <= 2).length}
          </span>
          <span style={styles.statLabel}>Por Vencer (≤2 días)</span>
        </div>
        <div style={{ ...styles.statCard, borderLeft: "4px solid #22c55e" }}>
          <span style={styles.statNumber}>
            {drafts.filter(d => (d.progress || 0) >= 50).length}
          </span>
          <span style={styles.statLabel}>+50% Progreso</span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p>Cargando borradores...</p>
        </div>
      ) : error ? (
        <div style={styles.errorContainer}>
          <p style={styles.errorText}>❌ {error}</p>
          <button onClick={fetchDrafts} style={styles.retryBtn}>Reintentar</button>
        </div>
      ) : filteredDrafts.length === 0 ? (
        <div style={styles.emptyContainer}>
          <div style={styles.emptyIcon}>📭</div>
          <h3 style={styles.emptyTitle}>
            {searchTerm ? "No se encontraron borradores" : "No tienes borradores guardados"}
          </h3>
          <p style={styles.emptyText}>
            {searchTerm
              ? "Intenta con otro término de búsqueda"
              : "Cuando guardes un borrador desde 'Llenar Formulario', aparecerá aquí"}
          </p>
          {!searchTerm && (
            <button onClick={() => navigate("/fill-form")} style={styles.newFormBtn}>
              📝 Ir a Llenar Formulario
            </button>
          )}
        </div>
      ) : (
        <div style={styles.draftsGrid}>
          {filteredDrafts.map(draft => (
            <div key={draft.draftID} style={styles.draftCard}>
              {/* Card Header */}
              <div style={styles.cardHeader}>
                <div style={styles.cardHeaderLeft}>
                  <h3 style={styles.draftName}>{draft.templateName || "Sin nombre"}</h3>
                  {draft.templateCodigo && (
                    <span style={styles.codeBadge}>{draft.templateCodigo}</span>
                  )}
                </div>
                <div style={{
                  ...styles.daysBadge,
                  backgroundColor: getDaysColor(draft.daysLeft || 0) + "20",
                  color: getDaysColor(draft.daysLeft || 0),
                  borderColor: getDaysColor(draft.daysLeft || 0)
                }}>
                  {(draft.daysLeft || 0) <= 0
                    ? "⚠️ Vencido"
                    : `⏰ ${draft.daysLeft} día${draft.daysLeft !== 1 ? "s" : ""}`}
                </div>
              </div>

              {/* Progress */}
              <div style={styles.progressSection}>
                <div style={styles.progressHeader}>
                  <span style={styles.progressLabel}>Progreso</span>
                  <span style={{
                    ...styles.progressValue,
                    color: getProgressColor(draft.progress || 0)
                  }}>
                    {draft.progress || 0}%
                  </span>
                </div>
                <div style={styles.progressBarBg}>
                  <div style={{
                    ...styles.progressBarFill,
                    width: `${draft.progress || 0}%`,
                    backgroundColor: getProgressColor(draft.progress || 0)
                  }} />
                </div>
              </div>

              {/* Nota */}
              {draft.nota && (
                <div style={styles.notaSection}>
                  <span style={styles.notaIcon}>📝</span>
                  <span style={styles.notaText}>{draft.nota}</span>
                </div>
              )}

              {/* Dates */}
              <div style={styles.datesSection}>
                <div style={styles.dateItem}>
                  <span style={styles.dateLabel}>Creado:</span>
                  <span style={styles.dateValue}>{formatDate(draft.createdAt)}</span>
                </div>
                <div style={styles.dateItem}>
                  <span style={styles.dateLabel}>Modificado:</span>
                  <span style={styles.dateValue}>{formatDate(draft.updatedAt)}</span>
                </div>
                <div style={styles.dateItem}>
                  <span style={styles.dateLabel}>Vence:</span>
                  <span style={{
                    ...styles.dateValue,
                    color: getDaysColor(draft.daysLeft || 0),
                    fontWeight: "bold"
                  }}>
                    {formatDate(draft.expiresAt)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div style={styles.cardActions}>
                <button
                  onClick={() => handleResume(draft)}
                  style={styles.resumeBtn}
                >
                  ▶️ Continuar Llenando
                </button>
                <button
                  onClick={() => handleDelete(draft.draftID)}
                  disabled={deletingId === draft.draftID}
                  style={{
                    ...styles.deleteBtn,
                    opacity: deletingId === draft.draftID ? 0.5 : 1
                  }}
                >
                  {deletingId === draft.draftID ? "⏳" : "🗑️"} Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div style={styles.infoBox}>
        <h4 style={styles.infoTitle}>ℹ️ Información sobre borradores</h4>
        <ul style={styles.infoList}>
          <li>Los borradores se guardan en el servidor y están disponibles por <strong>7 días</strong></li>
          <li>Cada vez que actualizas un borrador, la fecha de vencimiento se renueva</li>
          <li>Al guardar un formulario completo, el borrador se elimina automáticamente</li>
          <li>Puedes tener múltiples borradores de diferentes plantillas</li>
        </ul>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .draft-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.15) !important;
        }
      `}</style>
    </div>
  )
}

const styles = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "24px",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "24px",
    flexWrap: "wrap",
    gap: "16px"
  },
  headerLeft: {},
  headerRight: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap"
  },
  title: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#1e293b",
    margin: "0 0 4px 0"
  },
  subtitle: {
    fontSize: "14px",
    color: "#64748b",
    margin: 0
  },
  refreshBtn: {
    padding: "10px 20px",
    backgroundColor: "#f1f5f9",
    color: "#475569",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    transition: "all 0.2s"
  },
  newFormBtn: {
    padding: "10px 20px",
    backgroundColor: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    transition: "all 0.2s"
  },
  searchBar: {
    position: "relative",
    marginBottom: "20px"
  },
  searchInput: {
    width: "100%",
    padding: "12px 16px",
    paddingRight: "40px",
    fontSize: "15px",
    border: "2px solid #e2e8f0",
    borderRadius: "10px",
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box"
  },
  clearSearchBtn: {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    fontSize: "18px",
    color: "#94a3b8",
    cursor: "pointer"
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    marginBottom: "24px"
  },
  statCard: {
    background: "white",
    borderRadius: "12px",
    padding: "16px 20px",
    borderLeft: "4px solid #2563eb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column"
  },
  statNumber: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#1e293b"
  },
  statLabel: {
    fontSize: "13px",
    color: "#64748b",
    marginTop: "2px"
  },
  loadingContainer: {
    textAlign: "center",
    padding: "60px 20px",
    color: "#64748b"
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "4px solid #e2e8f0",
    borderTopColor: "#2563eb",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    margin: "0 auto 16px"
  },
  errorContainer: {
    textAlign: "center",
    padding: "40px",
    background: "#fef2f2",
    borderRadius: "12px",
    border: "1px solid #fecaca"
  },
  errorText: {
    color: "#dc2626",
    fontSize: "16px",
    marginBottom: "12px"
  },
  retryBtn: {
    padding: "8px 24px",
    backgroundColor: "#dc2626",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px"
  },
  emptyContainer: {
    textAlign: "center",
    padding: "60px 20px",
    background: "#f8fafc",
    borderRadius: "16px",
    border: "2px dashed #cbd5e1"
  },
  emptyIcon: {
    fontSize: "48px",
    marginBottom: "12px"
  },
  emptyTitle: {
    fontSize: "20px",
    color: "#334155",
    marginBottom: "8px"
  },
  emptyText: {
    fontSize: "14px",
    color: "#64748b",
    marginBottom: "20px"
  },
  draftsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
    gap: "20px",
    marginBottom: "32px"
  },
  draftCard: {
    background: "white",
    borderRadius: "14px",
    padding: "20px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    border: "1px solid #e2e8f0",
    transition: "all 0.2s",
    display: "flex",
    flexDirection: "column",
    gap: "14px"
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px"
  },
  cardHeaderLeft: {
    flex: 1,
    minWidth: 0
  },
  draftName: {
    fontSize: "17px",
    fontWeight: "600",
    color: "#1e293b",
    margin: 0,
    lineHeight: "1.3",
    wordBreak: "break-word"
  },
  codeBadge: {
    display: "inline-block",
    marginTop: "6px",
    padding: "2px 10px",
    background: "#eff6ff",
    color: "#2563eb",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "600",
    letterSpacing: "0.5px"
  },
  daysBadge: {
    padding: "4px 12px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "600",
    border: "1px solid",
    whiteSpace: "nowrap",
    flexShrink: 0
  },
  progressSection: {
    display: "flex",
    flexDirection: "column",
    gap: "6px"
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  progressLabel: {
    fontSize: "13px",
    color: "#64748b",
    fontWeight: "500"
  },
  progressValue: {
    fontSize: "14px",
    fontWeight: "700"
  },
  progressBarBg: {
    height: "8px",
    backgroundColor: "#e2e8f0",
    borderRadius: "4px",
    overflow: "hidden"
  },
  progressBarFill: {
    height: "100%",
    borderRadius: "4px",
    transition: "width 0.5s ease"
  },
  notaSection: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    padding: "10px 12px",
    background: "#fffbeb",
    borderRadius: "8px",
    border: "1px solid #fef3c7"
  },
  notaIcon: {
    flexShrink: 0
  },
  notaText: {
    fontSize: "13px",
    color: "#92400e",
    lineHeight: "1.4",
    wordBreak: "break-word"
  },
  datesSection: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "10px 12px",
    background: "#f8fafc",
    borderRadius: "8px"
  },
  dateItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  dateLabel: {
    fontSize: "12px",
    color: "#94a3b8",
    fontWeight: "500"
  },
  dateValue: {
    fontSize: "12px",
    color: "#475569"
  },
  cardActions: {
    display: "flex",
    gap: "10px",
    marginTop: "auto",
    paddingTop: "4px"
  },
  resumeBtn: {
    flex: 1,
    padding: "10px 16px",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    transition: "all 0.2s"
  },
  deleteBtn: {
    padding: "10px 16px",
    backgroundColor: "#fef2f2",
    color: "#dc2626",
    border: "1px solid #fecaca",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    transition: "all 0.2s"
  },
  infoBox: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: "12px",
    padding: "20px 24px"
  },
  infoTitle: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#1e40af",
    margin: "0 0 10px 0"
  },
  infoList: {
    margin: 0,
    paddingLeft: "20px",
    fontSize: "13px",
    color: "#1e40af",
    lineHeight: "1.8"
  }
}

export default MyDrafts
