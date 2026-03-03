import { useState, useCallback, useRef, useEffect } from "react";

const TODAY = new Date().toISOString().split("T")[0];
const REF_NUM = () => "LTV-" + Date.now().toString(36).toUpperCase();

const TOOL_TYPES = [
  { id: "A", label: "AI Research & Analysis", defaultTier: 2 },
  { id: "B", label: "Document Review & Contract Analysis", defaultTier: 2 },
  { id: "C", label: "Drafting & Document Generation", defaultTier: 2 },
  { id: "D", label: "Workflow Automation & Process Tools", defaultTier: 2 },
  { id: "E", label: "Communication & Collaboration", defaultTier: 2 },
  { id: "F", label: "Analytics & Business Intelligence", defaultTier: 3 },
  { id: "G", label: "Agentic & Autonomous Tools", defaultTier: 1, locked: true },
];

const ESCALATION_FACTORS = [
  "Will process client confidential information",
  "Will generate work product for clients or courts",
  "Will integrate with core firm systems",
  "Will be deployed firm-wide",
  "Involves cross-border data transfer outside the US",
  "Is a self-learning model that cannot be prevented from training on firm data",
];

const TIER_CONFIG = {
  1: { label: "Tier 1 — High Risk", color: "#C0392B", bg: "#FDEDEC", border: "#E74C3C", desc: "Requires full security review, DPO sign-off, Managing Partner approval, and external counsel data privacy assessment." },
  2: { label: "Tier 2 — Medium Risk", color: "#B7770D", bg: "#FEF9EC", border: "#F0A500", desc: "Requires IT Security review, Knowledge Management approval, and Data Protection impact screening." },
  3: { label: "Tier 3 — Standard Risk", color: "#1E7E34", bg: "#EBF7EE", border: "#28A745", desc: "Requires Knowledge Management review and standard vendor onboarding checklist." },
};

const TRACKS = [
  { id: 1, label: "Track 1 — Legal & Ethical Review", desc: "Assess legal risk, ethical implications, and compliance with firm policy and professional responsibility obligations.", tasks: ["Review terms of service and acceptable use policy", "Assess liability allocation and indemnification clauses", "Evaluate ethical implications for attorney-client privilege", "Confirm compliance with applicable bar rules on technology use"], autoSelect: () => true },
  { id: 2, label: "Track 2 — Data Privacy & Security", desc: "Evaluate data handling practices, privacy compliance, and information security controls.", tasks: ["Review data processing agreement (DPA)", "Confirm data residency and cross-border transfer safeguards", "Assess encryption standards and access controls", "Verify sub-processor disclosures", "Check for model training on firm/client data"], autoSelect: (tier) => tier <= 2 },
  { id: 3, label: "Track 3 — IT & Infrastructure", desc: "Technical assessment of integration requirements, access provisioning, and system compatibility.", tasks: ["Evaluate API and integration architecture", "Assess SSO/MFA and identity management requirements", "Review disaster recovery and uptime SLAs", "Confirm compatibility with firm IT standards"], autoSelect: (tier) => tier === 1 },
  { id: 4, label: "Track 4 — Vendor Due Diligence", desc: "Financial and operational assessment of the vendor organization.", tasks: ["Review vendor financial stability and funding status", "Assess business continuity and exit planning", "Confirm insurance coverage (cyber, E&O)", "Check for regulatory actions or litigation history"], autoSelect: (_, isNew) => isNew },
];

const APPROVER_ROLES = {
  1: ["Chief Information Security Officer", "Data Protection Officer", "Managing Partner", "Outside Privacy Counsel", "Knowledge Management Director", "General Counsel"],
  2: ["IT Security Lead", "Knowledge Management Director", "Data Protection Officer", "Practice Group Leader"],
  3: ["Knowledge Management Director", "IT Lead"],
};

const NEXT_STEPS = {
  1: ["Initiate full security review with CISO", "Schedule DPO briefing and formal sign-off", "Engage outside privacy counsel for data transfer assessment", "Circulate DPA to vendor for execution", "Schedule Managing Partner approval meeting", "Create matter/file for all documentation"],
  2: ["Send questionnaire to IT Security Lead for review", "Route DPA to Data Protection Officer for screening", "Request sandbox/demo access for technical evaluation", "Notify Practice Group Leader of pending approval", "Set 30-day review deadline"],
  3: ["Complete standard vendor onboarding checklist", "Notify Knowledge Management Director for sign-off", "Coordinate IT provisioning after approval", "Update firm legal technology registry"],
};

const defaultForm = { toolName: "", vendorName: "", vendorWebsite: "", description: "", requestedBy: "", dateInitiated: TODAY, reasonForRequest: "", vendorRelationship: "new", toolType: null, escalationFactors: [], overrideTier: null, overrideJustification: "" };
const defaultS3 = { tracks: [], approvers: [], dueDate: "", notes: "", uploadedFile: null, extractedFindings: null, findingsConfirmed: false, submitted: false, refNum: "" };

// ── Shared UI ──
const inputStyle = { width: "100%", padding: "9px 12px", border: "1px solid #C8D0DB", borderRadius: 5, fontSize: 14, color: "#2C3E50", background: "#fff", boxSizing: "border-box", outline: "none", fontFamily: "inherit" };

function Input({ value, onChange, placeholder, type = "text", disabled }) {
  const [f, setF] = useState(false);
  return <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} style={{ ...inputStyle, borderColor: f ? "#1B3A5C" : "#C8D0DB", opacity: disabled ? 0.7 : 1 }} onFocus={() => setF(true)} onBlur={() => setF(false)} />;
}
function Textarea({ value, onChange, placeholder, rows = 4 }) {
  const [f, setF] = useState(false);
  return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...inputStyle, resize: "vertical", borderColor: f ? "#1B3A5C" : "#C8D0DB" }} onFocus={() => setF(true)} onBlur={() => setF(false)} />;
}
function Field({ label, required, children, hint }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontWeight: 600, fontSize: 14, color: "#2C3E50", marginBottom: 6 }}>
        {label}{required && <span style={{ color: "#C0392B", marginLeft: 3 }}>*</span>}
      </label>
      {hint && <p style={{ fontSize: 12, color: "#7A8A9E", margin: "0 0 6px" }}>{hint}</p>}
      {children}
    </div>
  );
}

function TierBadge({ tier, small }) {
  const tc = TIER_CONFIG[tier];
  if (!tc) return null;
  return <span style={{ display: "inline-block", padding: small ? "2px 8px" : "4px 12px", borderRadius: 4, background: tc.bg, border: `1px solid ${tc.border}`, color: tc.color, fontWeight: 700, fontSize: small ? 11 : 13, whiteSpace: "nowrap" }}>{small ? `Tier ${tier}` : tc.label}</span>;
}

function StepIndicator({ step }) {
  const steps = ["Tool Information", "Classification", "Scope & Approval"];
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 32 }}>
      {steps.map((s, i) => {
        const idx = i + 1; const active = idx === step; const done = idx < step;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, background: done || active ? "#1B3A5C" : "#D5DBE5", color: done || active ? "#fff" : "#7A8A9E" }}>{done ? "✓" : idx}</div>
              <span style={{ marginTop: 6, fontSize: 12, fontWeight: active ? 600 : 400, color: active || done ? "#1B3A5C" : "#7A8A9E", whiteSpace: "nowrap" }}>{s}</span>
            </div>
            {i < 2 && <div style={{ flex: 1, height: 2, background: done ? "#1B3A5C" : "#D5DBE5", margin: "0 8px", marginBottom: 20 }} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Dashboard ──
function StatusDot({ status }) {
  const colors = { Pending: "#F0A500", "In Review": "#2980B9", Approved: "#28A745", Escalated: "#C0392B" };
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: colors[status] || "#ccc", marginRight: 5 }} />;
}

function Dashboard({ records, onView }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const filtered = records.filter(r => {
    const matchTier = filter === "all" || String(r.derivedTier) === filter;
    const matchSearch = !search || r.form.toolName.toLowerCase().includes(search.toLowerCase()) || r.form.vendorName.toLowerCase().includes(search.toLowerCase());
    return matchTier && matchSearch;
  });
  const counts = { all: records.length, 1: records.filter(r => r.derivedTier === 1).length, 2: records.filter(r => r.derivedTier === 2).length, 3: records.filter(r => r.derivedTier === 3).length };
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
        {[{ label: "Total Evaluations", value: records.length, color: "#1B3A5C", bg: "#EDF1F7" }, { label: "Tier 1 — High Risk", value: counts[1], color: "#C0392B", bg: "#FDEDEC" }, { label: "Tier 2 — Medium Risk", value: counts[2], color: "#B7770D", bg: "#FEF9EC" }, { label: "Tier 3 — Standard Risk", value: counts[3], color: "#1E7E34", bg: "#EBF7EE" }].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}33`, borderRadius: 8, padding: "16px 18px" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, fontFamily: "Georgia,serif" }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#4A5568", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by tool or vendor…" style={{ ...inputStyle, maxWidth: 260, padding: "8px 12px", fontSize: 13 }} />
        <div style={{ display: "flex", gap: 6 }}>
          {[["all", "All"], ["1", "Tier 1"], ["2", "Tier 2"], ["3", "Tier 3"]].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} style={{ padding: "7px 14px", border: `1px solid ${filter === v ? "#1B3A5C" : "#C8D0DB"}`, borderRadius: 5, background: filter === v ? "#1B3A5C" : "#fff", color: filter === v ? "#fff" : "#4A5568", fontSize: 13, fontWeight: filter === v ? 600 : 400, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#7A8A9E" }}>{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#7A8A9E" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#4A5568", marginBottom: 6 }}>{records.length === 0 ? "No evaluations yet" : "No records match your filter"}</div>
          <div style={{ fontSize: 13 }}>{records.length === 0 ? "Complete a vetting evaluation and it will appear here." : "Try adjusting your search or tier filter."}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(r => {
            const selType = TOOL_TYPES.find(t => t.id === r.form.toolType);
            const approverStats = { Approved: 0, "In Review": 0, Pending: 0, Escalated: 0 };
            r.s3.approvers.forEach(a => { if (approverStats[a.status] !== undefined) approverStats[a.status]++; });
            return (
              <div key={r.refNum} style={{ background: "#fff", border: "1px solid #DDE3EC", borderRadius: 8, padding: "18px 22px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", transition: "box-shadow 0.15s" }} onMouseOver={e => e.currentTarget.style.boxShadow = "0 3px 12px rgba(0,0,0,0.1)"} onMouseOut={e => e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)"}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: "#1B3A5C" }}>{r.form.toolName}</span>
                      <TierBadge tier={r.derivedTier} small />
                    </div>
                    <div style={{ fontSize: 13, color: "#4A5568", marginBottom: 2 }}>{r.form.vendorName}{r.form.vendorWebsite ? <> · <a href={r.form.vendorWebsite} target="_blank" rel="noreferrer" style={{ color: "#2980B9", textDecoration: "none" }}>{r.form.vendorWebsite}</a></> : ""}</div>
                    <div style={{ fontSize: 12, color: "#7A8A9E" }}>({selType?.id}) {selType?.label} · {r.form.vendorRelationship === "new" ? "New Vendor" : "Existing Vendor"} · Submitted {r.form.dateInitiated}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <span style={{ fontFamily: "monospace", fontSize: 12, color: "#7A8A9E", background: "#F4F6F9", padding: "2px 8px", borderRadius: 3, border: "1px solid #DDE3EC" }}>{r.refNum}</span>
                    <button onClick={() => onView(r)} style={{ background: "#1B3A5C", color: "#fff", border: "none", borderRadius: 5, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>View Summary</button>
                  </div>
                </div>
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #EEF0F4", display: "flex", gap: 24, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 11, color: "#7A8A9E", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Assessment Tracks</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {[1, 2, 3, 4].map(id => { const on = r.s3.tracks.includes(id); return <span key={id} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 3, background: on ? "#EDF1F7" : "#F4F6F9", color: on ? "#1B3A5C" : "#B0BAC8", border: `1px solid ${on ? "#BCC8D8" : "#E0E4EA"}`, fontWeight: on ? 600 : 400 }}>Track {id}</span>; })}
                    </div>
                  </div>
                  {r.s3.approvers.length > 0 && (
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 11, color: "#7A8A9E", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Approvers ({r.s3.approvers.length})</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {Object.entries(approverStats).filter(([, v]) => v > 0).map(([status, count]) => <span key={status} style={{ fontSize: 12, color: "#4A5568" }}><StatusDot status={status} />{count} {status}</span>)}
                      </div>
                    </div>
                  )}
                  {r.s3.uploadedFile && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 13 }}>📄</span><span style={{ fontSize: 12, color: "#4A5568" }}>{r.s3.uploadedFile}</span>{r.s3.findingsConfirmed && <span style={{ fontSize: 11, color: "#1E7E34", fontWeight: 600 }}>✓ Reviewed</span>}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Read-Only Summary Modal ──
function SummaryModal({ record, onClose }) {
  const { form, s3, derivedTier, refNum } = record;
  const selType = TOOL_TYPES.find(t => t.id === form.toolType);
  const tc = TIER_CONFIG[derivedTier];
  const f = s3.extractedFindings;

  const printSummary = () => {
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head><title>Evaluation Summary — ${form.toolName}</title><style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;color:#1a1a1a;font-size:14px;line-height:1.7}h1{font-size:20px;border-bottom:2px solid #1B3A5C;padding-bottom:8px;color:#1B3A5C}h2{font-size:15px;color:#1B3A5C;margin-top:28px;margin-bottom:6px;border-bottom:1px solid #ddd;padding-bottom:4px}.row{display:flex;gap:12px;margin-bottom:4px}.label{font-weight:bold;min-width:160px;color:#555;font-size:13px}.badge{display:inline-block;padding:3px 10px;border-radius:3px;font-weight:bold;font-size:13px}.tier1{background:#FDEDEC;color:#C0392B;border:1px solid #E74C3C}.tier2{background:#FEF9EC;color:#B7770D;border:1px solid #F0A500}.tier3{background:#EBF7EE;color:#1E7E34;border:1px solid #28A745}ul{margin:4px 0;padding-left:20px}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#1B3A5C;color:#fff;padding:7px 10px;text-align:left}td{padding:7px 10px;border-bottom:1px solid #ddd}.rf{color:#C0392B}@media print{body{margin:20px}}</style></head><body><h1>Legal Tool Vetting — Evaluation Summary</h1><div class="row"><span class="label">Reference:</span><span>${refNum}</span></div><div class="row"><span class="label">Date:</span><span>${form.dateInitiated}</span></div><h2>Tool Information</h2><div class="row"><span class="label">Tool Name:</span><span>${form.toolName}</span></div><div class="row"><span class="label">Vendor:</span><span>${form.vendorName}${form.vendorWebsite ? ` — <a href="${form.vendorWebsite}">${form.vendorWebsite}</a>` : ""}</span></div><div class="row"><span class="label">Requested By:</span><span>${form.requestedBy}</span></div><div class="row"><span class="label">Description:</span><span>${form.description}</span></div>${form.reasonForRequest ? `<div class="row"><span class="label">Reason:</span><span>${form.reasonForRequest}</span></div>` : ""}<h2>Classification</h2><div class="row"><span class="label">Tool Type:</span><span>(${selType?.id}) ${selType?.label}</span></div><div class="row"><span class="label">Vendor Relationship:</span><span>${form.vendorRelationship === "new" ? "New Vendor" : "Existing Vendor"}</span></div><div class="row"><span class="label">Risk Tier:</span><span class="badge tier${derivedTier}">${tc?.label}</span></div>${form.escalationFactors.length ? `<div class="row"><span class="label">Escalation Factors:</span><ul>${form.escalationFactors.map(e => `<li>${e}</li>`).join("")}</ul></div>` : ""}${form.overrideTier ? `<div class="row"><span class="label">Override:</span><span>Tier ${form.overrideTier} — ${form.overrideJustification}</span></div>` : ""}<h2>Assessment Tracks</h2><ul>${TRACKS.filter(t => s3.tracks.includes(t.id)).map(t => `<li><strong>${t.label}</strong><ul>${t.tasks.map(tk => `<li>${tk}</li>`).join("")}</ul></li>`).join("")}</ul><h2>Approvers</h2><table><thead><tr><th>Role</th><th>Assigned To</th><th>Due Date</th><th>Status</th></tr></thead><tbody>${s3.approvers.map(a => `<tr><td>${a.role}</td><td>${a.assignedTo || "—"}</td><td>${a.dueDate || "TBD"}</td><td>${a.status}</td></tr>`).join("")}</tbody></table>${f ? `<h2>Vendor Document Findings — ${s3.uploadedFile}</h2><div class="row"><span class="label">Data Residency:</span><span>${f.dataResidency}</span></div><div class="row"><span class="label">Encryption at Rest:</span><span>${f.encryptionAtRest}</span></div><div class="row"><span class="label">Encryption in Transit:</span><span>${f.encryptionInTransit}</span></div><div class="row"><span class="label">Trains on Data:</span><span>${f.trainsOnData}</span></div><div class="row"><span class="label">Certifications:</span><span>${(f.certifications || []).join(", ") || "None"}</span></div><div class="row"><span class="label">Sub-processors:</span><span>${(f.subProcessors || []).join(", ") || "None"}</span></div>${(f.redFlags || []).length ? `<div class="row"><span class="label">Red Flags:</span><ul>${f.redFlags.map(r => `<li class="rf">${r}</li>`).join("")}</ul></div>` : ""}<div class="row"><span class="label">Summary:</span><span>${f.summary}</span></div>` : ""}${s3.notes ? `<h2>Additional Notes</h2><p>${s3.notes}</p>` : ""}<p style="margin-top:40px;font-size:12px;color:#888">Generated by Legal Tool Vetting Assistant · ${new Date().toLocaleString()}</p></body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 400);
  };

  const Row = ({ label, value }) => value ? (
    <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 14 }}>
      <span style={{ minWidth: 170, color: "#7A8A9E", fontWeight: 600, fontSize: 13 }}>{label}</span>
      <span style={{ color: "#2C3E50", flex: 1 }}>{value}</span>
    </div>
  ) : null;

  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontFamily: "Georgia,serif", color: "#1B3A5C", fontSize: 15, margin: "0 0 12px", paddingBottom: 6, borderBottom: "1px solid #EEF0F4" }}>{title}</h3>
      {children}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, padding: "40px 16px", overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: 10, width: "100%", maxWidth: 680, boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ background: "#1B3A5C", padding: "18px 24px", borderRadius: "10px 10px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "#fff", fontFamily: "Georgia,serif", fontSize: 18, fontWeight: 700 }}>{form.toolName}</div>
            <div style={{ color: "#9AB2CC", fontSize: 12, marginTop: 2 }}>{refNum} · {form.dateInitiated}</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <TierBadge tier={derivedTier} />
            <button onClick={printSummary} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 5, color: "#fff", padding: "6px 14px", fontSize: 13, cursor: "pointer" }}>🖨️ Print</button>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#9AB2CC", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>×</button>
          </div>
        </div>
        <div style={{ padding: "24px 28px", maxHeight: "70vh", overflowY: "auto" }}>
          <Section title="Tool Information">
            <Row label="Tool Name" value={form.toolName} />
            <Row label="Vendor" value={form.vendorName} />
            {form.vendorWebsite && <Row label="Website" value={<a href={form.vendorWebsite} target="_blank" rel="noreferrer" style={{ color: "#2980B9" }}>{form.vendorWebsite}</a>} />}
            <Row label="Requested By" value={form.requestedBy} />
            <Row label="Description" value={form.description} />
            {form.reasonForRequest && <Row label="Reason for Request" value={form.reasonForRequest} />}
          </Section>
          <Section title="Classification">
            <Row label="Tool Type" value={`(${selType?.id}) ${selType?.label}`} />
            <Row label="Vendor Relationship" value={form.vendorRelationship === "new" ? "New Vendor" : "Existing Vendor"} />
            <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
              <span style={{ minWidth: 170, color: "#7A8A9E", fontWeight: 600, fontSize: 13 }}>Risk Tier</span>
              <TierBadge tier={derivedTier} small />
            </div>
            {form.escalationFactors.length > 0 && (
              <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
                <span style={{ minWidth: 170, color: "#7A8A9E", fontWeight: 600, fontSize: 13 }}>Escalation Factors</span>
                <ul style={{ margin: 0, paddingLeft: 18, flex: 1 }}>{form.escalationFactors.map(e => <li key={e} style={{ fontSize: 13, color: "#2C3E50", marginBottom: 3 }}>{e}</li>)}</ul>
              </div>
            )}
            {form.overrideTier && <Row label="Tier Override" value={`Tier ${form.overrideTier} — ${form.overrideJustification}`} />}
          </Section>
          <Section title="Assessment Tracks">
            {TRACKS.filter(t => s3.tracks.includes(t.id)).map(t => (
              <div key={t.id} style={{ marginBottom: 10, padding: "10px 14px", background: "#F8F9FB", borderRadius: 6, border: "1px solid #EEF0F4" }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#1B3A5C", marginBottom: 4 }}>{t.label}</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>{t.tasks.map(tk => <li key={tk} style={{ fontSize: 12, color: "#4A5568", marginBottom: 2 }}>{tk}</li>)}</ul>
              </div>
            ))}
          </Section>
          {s3.approvers.length > 0 && (
            <Section title="Approvers">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr>{["Role", "Assigned To", "Due Date", "Status"].map(h => <th key={h} style={{ background: "#F4F6F9", color: "#555", padding: "7px 10px", textAlign: "left", fontWeight: 600, fontSize: 12, borderBottom: "1px solid #DDE3EC" }}>{h}</th>)}</tr></thead>
                <tbody>{s3.approvers.map((a, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #EEF0F4" }}>{a.role || "—"}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #EEF0F4" }}>{a.assignedTo || "—"}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #EEF0F4" }}>{a.dueDate || "TBD"}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #EEF0F4" }}><StatusDot status={a.status} />{a.status}</td>
                  </tr>
                ))}</tbody>
              </table>
            </Section>
          )}
          {f && (
            <Section title={`Vendor Document Findings — ${s3.uploadedFile}`}>
              {[["Data Residency", f.dataResidency], ["Encryption at Rest", f.encryptionAtRest], ["Encryption in Transit", f.encryptionInTransit], ["Trains on Firm Data", f.trainsOnData]].map(([k, v]) => <Row key={k} label={k} value={v} />)}
              {(f.certifications || []).length > 0 && <Row label="Certifications" value={f.certifications.join(", ")} />}
              {(f.subProcessors || []).length > 0 && <Row label="Sub-processors" value={f.subProcessors.join(", ")} />}
              {(f.redFlags || []).length > 0 && (
                <div style={{ marginTop: 8, padding: "10px 14px", background: "#FDEDEC", border: "1px solid #E74C3C", borderRadius: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#C0392B", marginBottom: 6 }}>⚠️ Red Flags</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>{f.redFlags.map((r, i) => <li key={i} style={{ fontSize: 13, color: "#C0392B", marginBottom: 3 }}>{r}</li>)}</ul>
                </div>
              )}
              {f.summary && <div style={{ marginTop: 10, fontSize: 13, color: "#4A5568", fontStyle: "italic", lineHeight: 1.6 }}>{f.summary}</div>}
              {s3.findingsConfirmed && <div style={{ marginTop: 8, fontSize: 12, color: "#1E7E34", fontWeight: 600 }}>✓ Findings confirmed by reviewer</div>}
            </Section>
          )}
          {s3.notes && <Section title="Additional Notes"><p style={{ fontSize: 14, color: "#4A5568", lineHeight: 1.7, margin: 0 }}>{s3.notes}</p></Section>}
        </div>
        <div style={{ padding: "16px 28px", borderTop: "1px solid #EEF0F4", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "#1B3A5C", color: "#fff", border: "none", borderRadius: 5, padding: "9px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Screen 1 ──
function Screen1({ form, setForm, onNext }) {
  const u = k => v => setForm(f => ({ ...f, [k]: v }));
  const ok = form.toolName.trim() && form.vendorName.trim() && form.description.trim() && form.requestedBy.trim();
  return (
    <div>
      <h2 style={{ fontFamily: "Georgia,serif", color: "#1B3A5C", marginTop: 0, marginBottom: 24, fontSize: 22 }}>Tool Information</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
        <Field label="Tool Name" required><Input value={form.toolName} onChange={u("toolName")} placeholder="e.g. Harvey AI" /></Field>
        <Field label="Vendor Name" required><Input value={form.vendorName} onChange={u("vendorName")} placeholder="e.g. Harvey Inc." /></Field>
      </div>
      <Field label="Vendor Website"><Input value={form.vendorWebsite} onChange={u("vendorWebsite")} placeholder="https://..." type="url" /></Field>
      <Field label="Description" required hint="Briefly describe what the tool does and how attorneys would use it.">
        <Textarea value={form.description} onChange={u("description")} placeholder="Describe the tool's core functionality..." />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
        <Field label="Requested By" required><Input value={form.requestedBy} onChange={u("requestedBy")} placeholder="Attorney or department name" /></Field>
        <Field label="Date Initiated"><Input value={form.dateInitiated} onChange={u("dateInitiated")} type="date" disabled /></Field>
      </div>
      <Field label="Reason for Request">
        <Textarea value={form.reasonForRequest} onChange={u("reasonForRequest")} placeholder="What business need does this tool address?" rows={3} />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button onClick={onNext} disabled={!ok} style={{ background: ok ? "#1B3A5C" : "#A0AABA", color: "#fff", border: "none", borderRadius: 5, padding: "11px 32px", fontSize: 15, fontWeight: 600, cursor: ok ? "pointer" : "not-allowed" }}>Continue →</button>
      </div>
    </div>
  );
}

// ── Screen 2 ──
function Screen2({ form, setForm, onNext, onBack }) {
  const u = k => v => setForm(f => ({ ...f, [k]: v }));
  const [showOvr, setShowOvr] = useState(false);
  const selType = TOOL_TYPES.find(t => t.id === form.toolType);
  const isLocked = selType?.locked;
  const escalated = !isLocked && form.escalationFactors.length > 0;
  const derivedTier = isLocked ? 1 : (form.overrideTier || (escalated ? 1 : selType?.defaultTier));
  const toggleEsc = fac => { setForm(f => { const has = f.escalationFactors.includes(fac); return { ...f, escalationFactors: has ? f.escalationFactors.filter(x => x !== fac) : [...f.escalationFactors, fac], overrideTier: null, overrideJustification: "" }; }); setShowOvr(false); };
  const handleType = id => { setForm(f => ({ ...f, toolType: id, escalationFactors: [], overrideTier: null, overrideJustification: "" })); setShowOvr(false); };
  const canCont = form.toolType !== null && (!showOvr || !form.overrideTier || form.overrideJustification.trim().length >= 10);
  return (
    <div>
      <h2 style={{ fontFamily: "Georgia,serif", color: "#1B3A5C", marginTop: 0, marginBottom: 24, fontSize: 22 }}>Classification</h2>
      <Field label="Vendor Relationship">
        <div style={{ display: "flex", gap: 12 }}>
          {["new", "existing"].map(v => (
            <label key={v} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "9px 18px", border: `2px solid ${form.vendorRelationship === v ? "#1B3A5C" : "#C8D0DB"}`, borderRadius: 5, background: form.vendorRelationship === v ? "#EDF1F7" : "#fff", fontWeight: form.vendorRelationship === v ? 600 : 400, fontSize: 14, color: "#2C3E50" }}>
              <input type="radio" name="vr" value={v} checked={form.vendorRelationship === v} onChange={() => u("vendorRelationship")(v)} style={{ accentColor: "#1B3A5C" }} />
              {v === "new" ? "New Vendor" : "Existing Vendor"}
            </label>
          ))}
        </div>
        {form.vendorRelationship === "existing" && (
          <div style={{ marginTop: 10, padding: "10px 14px", background: "#EDF2F7", border: "1px solid #BCC8D8", borderRadius: 5, fontSize: 13, color: "#2C3E50" }}>
            <strong>Note:</strong> Full due diligence is not required. This assessment will focus on <strong>Tracks 1 and 4</strong> plus any required <strong>DPA updates</strong>.
          </div>
        )}
      </Field>
      <Field label="Tool Type" required>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {TOOL_TYPES.map(t => {
            const sel = form.toolType === t.id;
            return (
              <label key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "12px 14px", border: `2px solid ${sel ? "#1B3A5C" : "#C8D0DB"}`, borderRadius: 6, background: sel ? "#EDF1F7" : "#fff" }}>
                <input type="radio" name="tt" value={t.id} checked={sel} onChange={() => handleType(t.id)} style={{ accentColor: "#1B3A5C", marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "#1B3A5C" }}>{t.id}.</span>
                    <span style={{ fontSize: 13, color: "#2C3E50", fontWeight: sel ? 600 : 400 }}>{t.label}</span>
                    {t.locked && <span style={{ fontSize: 10, fontWeight: 700, background: "#C0392B", color: "#fff", padding: "2px 6px", borderRadius: 3 }}>ALWAYS TIER 1</span>}
                  </div>
                  {!t.locked && <div style={{ fontSize: 11, color: "#7A8A9E", marginTop: 3 }}>Default: Tier {t.defaultTier}</div>}
                </div>
              </label>
            );
          })}
        </div>
      </Field>
      {form.toolType && !isLocked && (
        <Field label="Escalation Factors" hint="Checking any factor automatically escalates this tool to Tier 1.">
          <div style={{ border: "1px solid #C8D0DB", borderRadius: 6, overflow: "hidden" }}>
            {ESCALATION_FACTORS.map((fac, i) => {
              const checked = form.escalationFactors.includes(fac);
              return (
                <label key={fac} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 14px", cursor: "pointer", background: checked ? "#FEF9EC" : i % 2 === 0 ? "#FAFBFC" : "#fff", borderBottom: i < ESCALATION_FACTORS.length - 1 ? "1px solid #E8ECF0" : "none" }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleEsc(fac)} style={{ accentColor: "#1B3A5C", marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#2C3E50", lineHeight: 1.5 }}>{fac}</span>
                </label>
              );
            })}
          </div>
        </Field>
      )}
      {form.toolType && derivedTier && (() => {
        const tc = TIER_CONFIG[derivedTier];
        return (
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#2C3E50", marginBottom: 10 }}>Derived Risk Tier</div>
            <div style={{ padding: "16px 18px", border: `2px solid ${tc.border}`, borderRadius: 6, background: tc.bg, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: tc.color, fontFamily: "Georgia,serif" }}>{tc.label}</span>
                {escalated && <span style={{ fontSize: 11, background: "#C0392B", color: "#fff", padding: "2px 8px", borderRadius: 3, fontWeight: 700 }}>ESCALATED</span>}
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "#4A5568", lineHeight: 1.6 }}>{tc.desc}</p>
              {!isLocked && (
                <div style={{ marginTop: 10 }}>
                  {!showOvr ? (
                    <button onClick={() => setShowOvr(true)} style={{ background: "none", border: "none", color: tc.color, fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Override tier</button>
                  ) : (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#2C3E50", marginBottom: 8 }}>Select override tier:</div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        {[1, 2, 3].map(t => { const tc2 = TIER_CONFIG[t]; const sel = form.overrideTier === t; return <button key={t} onClick={() => setForm(f => ({ ...f, overrideTier: t }))} style={{ padding: "6px 14px", border: `2px solid ${tc2.border}`, borderRadius: 4, background: sel ? tc2.bg : "#fff", color: tc2.color, fontWeight: sel ? 700 : 400, fontSize: 12, cursor: "pointer" }}>Tier {t}</button>; })}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#2C3E50", marginBottom: 4 }}>Justification <span style={{ color: "#C0392B" }}>*</span> <span style={{ fontWeight: 400, color: "#7A8A9E" }}>(min. 10 characters)</span></div>
                      <Textarea value={form.overrideJustification} onChange={v => setForm(f => ({ ...f, overrideJustification: v }))} placeholder="Explain why this tier override is appropriate..." rows={3} />
                      <button onClick={() => { setShowOvr(false); setForm(f => ({ ...f, overrideTier: null, overrideJustification: "" })); }} style={{ background: "none", border: "none", color: "#7A8A9E", fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0, marginTop: 4 }}>Cancel override</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        <button onClick={onBack} style={{ background: "none", border: "1px solid #C8D0DB", borderRadius: 5, padding: "11px 24px", fontSize: 15, cursor: "pointer", color: "#4A5568" }}>← Back</button>
        <button onClick={onNext} disabled={!canCont} style={{ background: canCont ? "#1B3A5C" : "#A0AABA", color: "#fff", border: "none", borderRadius: 5, padding: "11px 32px", fontSize: 15, fontWeight: 600, cursor: canCont ? "pointer" : "not-allowed" }}>Continue →</button>
      </div>
    </div>
  );
}

// ── Screen 3 ──
function Screen3({ form, s3, setS3, onBack, derivedTier, onSubmit }) {
  const isNew = form.vendorRelationship === "new";
  const fileRef = useRef();
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nextStepsOpen, setNextStepsOpen] = useState(false);
  const tc = TIER_CONFIG[derivedTier];
  const selType = TOOL_TYPES.find(t => t.id === form.toolType);
  const roleOptions = APPROVER_ROLES[derivedTier] || [];

  useEffect(() => {
    if (s3.tracks.length === 0) {
      const auto = TRACKS.filter(t => t.autoSelect(derivedTier, isNew)).map(t => t.id);
      setS3(s => ({ ...s, tracks: auto }));
    }
  }, []);

  const toggleTrack = id => setS3(s => ({ ...s, tracks: s.tracks.includes(id) ? s.tracks.filter(x => x !== id) : [...s.tracks, id] }));
  const addApprover = () => setS3(s => ({ ...s, approvers: [...s.approvers, { role: "", assignedTo: "", dueDate: "", status: "Pending" }] }));
  const updateApprover = (i, k, v) => setS3(s => { const a = [...s.approvers]; a[i] = { ...a[i], [k]: v }; return { ...s, approvers: a }; });
  const removeApprover = i => setS3(s => ({ ...s, approvers: s.approvers.filter((_, idx) => idx !== i) }));

  const handleFile = async e => {
    const file = e.target.files[0]; if (!file) return;
    setS3(s => ({ ...s, uploadedFile: file.name, extractedFindings: null, findingsConfirmed: false }));
    setExtractError(""); setExtracting(true);
    try {
      const base64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = () => rej(); r.readAsDataURL(file); });
      const isPdf = file.type === "application/pdf";
      const msgContent = isPdf
        ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }, { type: "text", text: `You are a legal technology due diligence analyst. Extract key security and compliance information from this vendor questionnaire. Return ONLY a JSON object (no markdown, no backticks) with these fields: dataResidency (string), subProcessors (array of strings), encryptionAtRest (string), encryptionInTransit (string), certifications (array of strings), trainsOnData (string: "Yes", "No", or "Unclear"), redFlags (array of strings), summary (string, 2-3 sentences). If a field is not found, use "Not disclosed" or an empty array.` }]
        : [{ type: "text", text: `Return a JSON object with placeholder values for a file named "${file.name}" that could not be parsed as PDF. Fields: dataResidency, subProcessors (array), encryptionAtRest, encryptionInTransit, certifications (array), trainsOnData, redFlags (array), summary. Use "File uploaded — manual review required" for strings and empty arrays for arrays.` }];
      const resp = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: msgContent }] }) });
      const data = await resp.json();
      const raw = data.content.map(c => c.text || "").join("");
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setS3(s => ({ ...s, extractedFindings: parsed }));
    } catch { setExtractError("Extraction failed. Please review the document manually."); }
    setExtracting(false);
  };

  const updateFinding = (k, v) => setS3(s => ({ ...s, extractedFindings: { ...s.extractedFindings, [k]: v } }));
  const updateFindingArr = (k, i, v) => setS3(s => { const a = [...(s.extractedFindings[k] || [])]; a[i] = v; return { ...s, extractedFindings: { ...s.extractedFindings, [k]: a } }; });
  const addFindingItem = k => setS3(s => ({ ...s, extractedFindings: { ...s.extractedFindings, [k]: [...(s.extractedFindings[k] || []), ""] } }));
  const removeFindingItem = (k, i) => setS3(s => ({ ...s, extractedFindings: { ...s.extractedFindings, [k]: s.extractedFindings[k].filter((_, idx) => idx !== i) } }));

  const handleSubmit = () => { const ref = REF_NUM(); setS3(s => ({ ...s, submitted: true, refNum: ref })); setShowConfirmModal(true); onSubmit(ref); };

  const plainSummary = () => {
    const f = s3.extractedFindings;
    return ["LEGAL TOOL VETTING ASSISTANT — EVALUATION SUMMARY", "=".repeat(52), `Reference: ${s3.refNum || "Draft"}`, `Date: ${TODAY}`, "", "TOOL INFORMATION", `Tool Name: ${form.toolName}`, `Vendor: ${form.vendorName}`, `Requested By: ${form.requestedBy}`, `Description: ${form.description}`, "", "CLASSIFICATION", `Tool Type: (${selType?.id}) ${selType?.label}`, `Vendor Rel.: ${form.vendorRelationship === "new" ? "New Vendor" : "Existing Vendor"}`, `Risk Tier: ${tc?.label}`, form.overrideTier ? `Override: Tier ${form.overrideTier} — ${form.overrideJustification}` : "", "", "ASSESSMENT TRACKS", ...TRACKS.filter(t => s3.tracks.includes(t.id)).map(t => `  ✓ ${t.label}`), "", "APPROVERS", ...s3.approvers.map(a => `  • ${a.role} — ${a.assignedTo || "Unassigned"} | Due: ${a.dueDate || "TBD"} | Status: ${a.status}`), f ? ["", "VENDOR DOCUMENT FINDINGS", `File: ${s3.uploadedFile}`, `Data Residency: ${f.dataResidency}`, `Enc. at Rest: ${f.encryptionAtRest}`, `Enc. in Transit: ${f.encryptionInTransit}`, `Trains on Data: ${f.trainsOnData}`, `Certifications: ${(f.certifications || []).join(", ") || "None"}`, `Sub-processors: ${(f.subProcessors || []).join(", ") || "None"}`, `Red Flags: ${(f.redFlags || []).join("; ") || "None"}`, `Summary: ${f.summary}`].join("\n") : "", s3.notes ? `\nNOTES\n${s3.notes}` : ""].filter(Boolean).join("\n");
  };

  const copyToClipboard = async () => { try { await navigator.clipboard.writeText(plainSummary()); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { alert("Copy failed — please select and copy manually."); } };

  const printSummary = () => {
    const w = window.open("", "_blank"); const f = s3.extractedFindings;
    w.document.write(`<!DOCTYPE html><html><head><title>Evaluation Summary — ${form.toolName}</title><style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;color:#1a1a1a;font-size:14px;line-height:1.7}h1{font-size:20px;border-bottom:2px solid #1B3A5C;padding-bottom:8px;color:#1B3A5C}h2{font-size:15px;color:#1B3A5C;margin-top:28px;margin-bottom:6px;border-bottom:1px solid #ddd;padding-bottom:4px}.row{display:flex;gap:12px;margin-bottom:4px}.label{font-weight:bold;min-width:160px;color:#555;font-size:13px}.badge{display:inline-block;padding:3px 10px;border-radius:3px;font-weight:bold;font-size:13px}.tier1{background:#FDEDEC;color:#C0392B;border:1px solid #E74C3C}.tier2{background:#FEF9EC;color:#B7770D;border:1px solid #F0A500}.tier3{background:#EBF7EE;color:#1E7E34;border:1px solid #28A745}ul{margin:4px 0;padding-left:20px}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#1B3A5C;color:#fff;padding:7px 10px;text-align:left}td{padding:7px 10px;border-bottom:1px solid #ddd}.rf{color:#C0392B}@media print{body{margin:20px}}</style></head><body><h1>Legal Tool Vetting — Evaluation Summary</h1><div class="row"><span class="label">Reference:</span><span>${s3.refNum || "Draft"}</span></div><div class="row"><span class="label">Date:</span><span>${TODAY}</span></div><h2>Tool Information</h2><div class="row"><span class="label">Tool Name:</span><span>${form.toolName}</span></div><div class="row"><span class="label">Vendor:</span><span>${form.vendorName}</span></div><div class="row"><span class="label">Requested By:</span><span>${form.requestedBy}</span></div><div class="row"><span class="label">Description:</span><span>${form.description}</span></div><h2>Classification</h2><div class="row"><span class="label">Tool Type:</span><span>(${selType?.id}) ${selType?.label}</span></div><div class="row"><span class="label">Vendor Relationship:</span><span>${form.vendorRelationship === "new" ? "New Vendor" : "Existing Vendor"}</span></div><div class="row"><span class="label">Risk Tier:</span><span class="badge tier${derivedTier}">${tc?.label}</span></div>${form.escalationFactors.length ? `<div class="row"><span class="label">Escalation Factors:</span><ul>${form.escalationFactors.map(e => `<li>${e}</li>`).join("")}</ul></div>` : ""}${form.overrideTier ? `<div class="row"><span class="label">Override:</span><span>Tier ${form.overrideTier} — ${form.overrideJustification}</span></div>` : ""}<h2>Assessment Tracks</h2><ul>${TRACKS.filter(t => s3.tracks.includes(t.id)).map(t => `<li><strong>${t.label}</strong><ul>${t.tasks.map(tk => `<li>${tk}</li>`).join("")}</ul></li>`).join("")}</ul><h2>Approvers</h2><table><thead><tr><th>Role</th><th>Assigned To</th><th>Due Date</th><th>Status</th></tr></thead><tbody>${s3.approvers.map(a => `<tr><td>${a.role}</td><td>${a.assignedTo||"—"}</td><td>${a.dueDate||"TBD"}</td><td>${a.status}</td></tr>`).join("")}</tbody></table>${f?`<h2>Vendor Document Findings</h2><div class="row"><span class="label">Data Residency:</span><span>${f.dataResidency}</span></div><div class="row"><span class="label">Encryption at Rest:</span><span>${f.encryptionAtRest}</span></div><div class="row"><span class="label">Encryption in Transit:</span><span>${f.encryptionInTransit}</span></div><div class="row"><span class="label">Trains on Data:</span><span>${f.trainsOnData}</span></div><div class="row"><span class="label">Certifications:</span><span>${(f.certifications||[]).join(", ")||"None"}</span></div><div class="row"><span class="label">Sub-processors:</span><span>${(f.subProcessors||[]).join(", ")||"None"}</span></div>${(f.redFlags||[]).length?`<div class="row"><span class="label">Red Flags:</span><ul>${f.redFlags.map(r=>`<li class="rf">${r}</li>`).join("")}</ul></div>`:""}<div class="row"><span class="label">Summary:</span><span>${f.summary}</span></div>`:""} ${s3.notes?`<h2>Additional Notes</h2><p>${s3.notes}</p>`:""}<p style="margin-top:40px;font-size:12px;color:#888">Generated by Legal Tool Vetting Assistant · ${new Date().toLocaleString()}</p></body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 400);
  };

  return (
    <div>
      <h2 style={{ fontFamily: "Georgia,serif", color: "#1B3A5C", marginTop: 0, marginBottom: 6, fontSize: 22 }}>Scope & Approval</h2>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <TierBadge tier={derivedTier} />
        <span style={{ fontSize: 13, color: "#7A8A9E" }}>· {form.toolName} · {form.vendorName}</span>
      </div>
      {/* Tracks */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#2C3E50", marginBottom: 4 }}>Assessment Tracks</div>
        <p style={{ fontSize: 12, color: "#7A8A9E", margin: "0 0 12px" }}>Auto-selected based on tier and vendor relationship. Override as needed.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {TRACKS.map(t => {
            const sel = s3.tracks.includes(t.id); const isExT4 = t.id === 4 && !isNew;
            return (
              <div key={t.id} style={{ border: `2px solid ${sel ? "#1B3A5C" : "#C8D0DB"}`, borderRadius: 7, overflow: "hidden" }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", cursor: "pointer", background: sel ? "#EDF1F7" : "#FAFBFC" }}>
                  <input type="checkbox" checked={sel} onChange={() => toggleTrack(t.id)} style={{ accentColor: "#1B3A5C", marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#1B3A5C" }}>{t.label}</div>
                    <div style={{ fontSize: 12, color: "#4A5568", marginTop: 2 }}>{isExT4 ? "Existing vendor: focus on DPA updates only." : t.desc}</div>
                  </div>
                </label>
                {sel && (
                  <div style={{ background: "#fff", padding: "10px 16px 12px 44px", borderTop: "1px solid #DDE3EC" }}>
                    <div style={{ fontSize: 12, color: "#7A8A9E", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>Key Tasks</div>
                    {t.tasks.map(tk => <div key={tk} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}><span style={{ color: "#28A745", fontSize: 13, marginTop: 1 }}>○</span><span style={{ fontSize: 13, color: "#2C3E50" }}>{tk}</span></div>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {/* Upload */}
      {s3.tracks.includes(2) && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#2C3E50", marginBottom: 4 }}>Vendor Security Questionnaire</div>
          <p style={{ fontSize: 12, color: "#7A8A9E", margin: "0 0 12px" }}>Upload a completed vendor security or compliance questionnaire (PDF). Claude will extract key findings automatically.</p>
          <div onClick={() => fileRef.current.click()} style={{ border: "2px dashed #C8D0DB", borderRadius: 7, padding: "28px 20px", textAlign: "center", cursor: "pointer", background: s3.uploadedFile ? "#EDF1F7" : "#FAFBFC" }} onMouseOver={e => e.currentTarget.style.borderColor = "#1B3A5C"} onMouseOut={e => e.currentTarget.style.borderColor = "#C8D0DB"}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
            {s3.uploadedFile ? <div style={{ fontSize: 14, color: "#1B3A5C", fontWeight: 600 }}>✓ {s3.uploadedFile} <span style={{ fontWeight: 400, color: "#7A8A9E", fontSize: 12 }}>(click to replace)</span></div> : <><div style={{ fontSize: 14, color: "#2C3E50", fontWeight: 600 }}>Click to upload a PDF</div><div style={{ fontSize: 12, color: "#7A8A9E", marginTop: 4 }}>Supported: PDF · Max 20MB</div></>}
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.docx" style={{ display: "none" }} onChange={handleFile} />
          {extracting && <div style={{ marginTop: 14, padding: "14px 18px", background: "#EDF1F7", border: "1px solid #BCC8D8", borderRadius: 6, fontSize: 13, color: "#1B3A5C", display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 20 }}>⏳</span> Analyzing document — extracting security and compliance findings…</div>}
          {extractError && <div style={{ marginTop: 14, padding: "12px 16px", background: "#FDEDEC", border: "1px solid #E74C3C", borderRadius: 6, fontSize: 13, color: "#C0392B" }}>⚠️ {extractError}</div>}
          {s3.extractedFindings && !extracting && (
            <div style={{ marginTop: 14, border: "1px solid #BCC8D8", borderRadius: 7, overflow: "hidden" }}>
              <div style={{ background: "#1B3A5C", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>🔍 Extracted Findings — {s3.uploadedFile}</span>
                {!s3.findingsConfirmed ? <button onClick={() => setS3(s => ({ ...s, findingsConfirmed: true }))} style={{ background: "#28A745", color: "#fff", border: "none", borderRadius: 4, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>✓ Confirm Findings</button> : <span style={{ color: "#90EE90", fontSize: 12, fontWeight: 600 }}>✓ Confirmed</span>}
              </div>
              <div style={{ padding: "16px 18px", background: "#fff" }}>
                {[{ key: "dataResidency", label: "Data Residency" }, { key: "encryptionAtRest", label: "Encryption at Rest" }, { key: "encryptionInTransit", label: "Encryption in Transit" }, { key: "trainsOnData", label: "Trains on Firm Data" }].map(({ key, label }) => (
                  <div key={key} style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12, marginBottom: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>{label}</span>
                    <input value={s3.extractedFindings[key] || ""} onChange={e => updateFinding(key, e.target.value)} disabled={s3.findingsConfirmed} style={{ ...inputStyle, fontSize: 13, padding: "7px 10px", opacity: s3.findingsConfirmed ? 0.75 : 1 }} />
                  </div>
                ))}
                {[{ key: "certifications", label: "Certifications" }, { key: "subProcessors", label: "Sub-processors" }, { key: "redFlags", label: "Red Flags", isRed: true }].map(({ key, label, isRed }) => (
                  <div key={key} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isRed ? "#C0392B" : "#555", marginBottom: 6 }}>{label}</div>
                    {(s3.extractedFindings[key] || []).map((item, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5 }}>
                        <input value={item} onChange={e => updateFindingArr(key, i, e.target.value)} disabled={s3.findingsConfirmed} style={{ ...inputStyle, fontSize: 13, padding: "6px 10px", flex: 1, borderColor: isRed ? "#E74C3C" : "#C8D0DB", opacity: s3.findingsConfirmed ? 0.75 : 1 }} />
                        {!s3.findingsConfirmed && <button onClick={() => removeFindingItem(key, i)} style={{ background: "none", border: "1px solid #E74C3C", borderRadius: 4, color: "#C0392B", cursor: "pointer", padding: "0 10px", fontSize: 16 }}>×</button>}
                      </div>
                    ))}
                    {!s3.findingsConfirmed && <button onClick={() => addFindingItem(key)} style={{ background: "none", border: "1px dashed #C8D0DB", borderRadius: 4, color: "#7A8A9E", cursor: "pointer", padding: "4px 12px", fontSize: 12, marginTop: 2 }}>+ Add</button>}
                  </div>
                ))}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>Summary</div>
                  <textarea value={s3.extractedFindings.summary || ""} onChange={e => updateFinding("summary", e.target.value)} disabled={s3.findingsConfirmed} rows={3} style={{ ...inputStyle, resize: "vertical", fontSize: 13, opacity: s3.findingsConfirmed ? 0.75 : 1 }} />
                </div>
                {!s3.findingsConfirmed && <p style={{ fontSize: 12, color: "#B7770D", background: "#FEF9EC", border: "1px solid #F0A500", borderRadius: 4, padding: "8px 12px", margin: "8px 0 0" }}>⚠️ Review and edit extracted findings above, then click <strong>Confirm Findings</strong> to lock them into the approval record.</p>}
              </div>
            </div>
          )}
        </div>
      )}
      {/* Approvers */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div><div style={{ fontWeight: 600, fontSize: 14, color: "#2C3E50" }}>Approvers & Reviewers</div><div style={{ fontSize: 12, color: "#7A8A9E", marginTop: 2 }}>Assign required approvers based on the derived risk tier.</div></div>
          <button onClick={addApprover} style={{ background: "#1B3A5C", color: "#fff", border: "none", borderRadius: 5, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add Approver</button>
        </div>
        {s3.approvers.length === 0 && <div style={{ border: "1px dashed #C8D0DB", borderRadius: 6, padding: "20px", textAlign: "center", color: "#7A8A9E", fontSize: 13 }}>No approvers added yet. Click <strong>+ Add Approver</strong> to assign reviewers.</div>}
        {s3.approvers.map((a, i) => (
          <div key={i} style={{ border: "1px solid #DDE3EC", borderRadius: 6, padding: "14px 16px", marginBottom: 10, background: "#FAFBFC" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr auto", gap: 10, alignItems: "center" }}>
              <div><div style={{ fontSize: 11, color: "#7A8A9E", fontWeight: 600, marginBottom: 4, textTransform: "uppercase" }}>Role</div><select value={a.role} onChange={e => updateApprover(i, "role", e.target.value)} style={{ ...inputStyle, padding: "8px 10px" }}><option value="">Select role…</option>{roleOptions.map(r => <option key={r} value={r}>{r}</option>)}<option value="Other">Other</option></select></div>
              <div><div style={{ fontSize: 11, color: "#7A8A9E", fontWeight: 600, marginBottom: 4, textTransform: "uppercase" }}>Assigned To</div><input value={a.assignedTo} onChange={e => updateApprover(i, "assignedTo", e.target.value)} placeholder="Name or team" style={{ ...inputStyle, padding: "8px 10px" }} /></div>
              <div><div style={{ fontSize: 11, color: "#7A8A9E", fontWeight: 600, marginBottom: 4, textTransform: "uppercase" }}>Due Date</div><input type="date" value={a.dueDate} onChange={e => updateApprover(i, "dueDate", e.target.value)} style={{ ...inputStyle, padding: "8px 10px" }} /></div>
              <div><div style={{ fontSize: 11, color: "#7A8A9E", fontWeight: 600, marginBottom: 4, textTransform: "uppercase" }}>Status</div><select value={a.status} onChange={e => updateApprover(i, "status", e.target.value)} style={{ ...inputStyle, padding: "8px 10px" }}>{["Pending", "In Review", "Approved", "Escalated"].map(s => <option key={s}>{s}</option>)}</select></div>
              <button onClick={() => removeApprover(i)} style={{ background: "none", border: "none", color: "#C0392B", cursor: "pointer", fontSize: 20, padding: "0 4px", marginTop: 18 }}>×</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 28 }}><Field label="Additional Notes"><Textarea value={s3.notes} onChange={v => setS3(s => ({ ...s, notes: v }))} placeholder="Any additional context, caveats, or instructions for reviewers…" rows={3} /></Field></div>
      {/* Next Steps */}
      <div style={{ marginBottom: 28 }}>
        <button onClick={() => setNextStepsOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 8, background: "#EDF1F7", border: "1px solid #BCC8D8", borderRadius: 6, padding: "10px 16px", cursor: "pointer", width: "100%", textAlign: "left" }}>
          <span style={{ fontSize: 16 }}>{nextStepsOpen ? "▾" : "▸"}</span>
          <span style={{ fontWeight: 600, fontSize: 14, color: "#1B3A5C" }}>View Next Steps Checklist</span>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#7A8A9E" }}>{NEXT_STEPS[derivedTier]?.length} items for {tc.label}</span>
        </button>
        {nextStepsOpen && (
          <div style={{ border: "1px solid #BCC8D8", borderTop: "none", borderRadius: "0 0 6px 6px", padding: "14px 18px", background: "#fff" }}>
            {NEXT_STEPS[derivedTier]?.map((step, i) => (
              <label key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10, cursor: "pointer" }}>
                <input type="checkbox" style={{ accentColor: "#1B3A5C", marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "#2C3E50", lineHeight: 1.5 }}>{step}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      {/* Action Bar */}
      <div style={{ borderTop: "1px solid #DDE3EC", paddingTop: 20, display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={onBack} style={{ background: "none", border: "1px solid #C8D0DB", borderRadius: 5, padding: "10px 20px", fontSize: 14, cursor: "pointer", color: "#4A5568" }}>← Back</button>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={copyToClipboard} style={{ background: copied ? "#EBF7EE" : "#fff", border: `1px solid ${copied ? "#28A745" : "#C8D0DB"}`, borderRadius: 5, padding: "10px 18px", fontSize: 13, cursor: "pointer", color: copied ? "#1E7E34" : "#4A5568", fontWeight: copied ? 600 : 400 }}>{copied ? "✓ Copied!" : "📋 Copy Summary"}</button>
          <button onClick={printSummary} style={{ background: "#fff", border: "1px solid #C8D0DB", borderRadius: 5, padding: "10px 18px", fontSize: 13, cursor: "pointer", color: "#4A5568" }}>🖨️ Print / Export PDF</button>
          <button onClick={handleSubmit} style={{ background: "#1B3A5C", color: "#fff", border: "none", borderRadius: 5, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Submit & Confirm →</button>
        </div>
      </div>
      {showConfirmModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "36px 40px", maxWidth: 480, width: "90%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#EBF7EE", border: "3px solid #28A745", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 32 }}>✓</div>
            <h2 style={{ fontFamily: "Georgia,serif", color: "#1B3A5C", margin: "0 0 8px", fontSize: 22 }}>Evaluation Submitted</h2>
            <p style={{ color: "#7A8A9E", fontSize: 13, margin: "0 0 20px" }}>Reference number:</p>
            <div style={{ background: "#EDF1F7", border: "1px solid #BCC8D8", borderRadius: 6, padding: "10px 20px", fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: "#1B3A5C", letterSpacing: 2, marginBottom: 20 }}>{s3.refNum}</div>
            <div style={{ textAlign: "left", background: "#F8F9FB", border: "1px solid #DDE3EC", borderRadius: 6, padding: "14px 18px", marginBottom: 24 }}>
              {[["Tool", form.toolName], ["Vendor", form.vendorName], ["Risk Tier", tc.label], ["Tracks", TRACKS.filter(t => s3.tracks.includes(t.id)).map(t => `Track ${t.id}`).join(", ")], ["Approvers", s3.approvers.length + " assigned"]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 12, marginBottom: 6, fontSize: 13 }}><span style={{ color: "#7A8A9E", fontWeight: 600, minWidth: 80 }}>{k}:</span><span style={{ color: "#2C3E50" }}>{v}</span></div>
              ))}
            </div>
            <p style={{ fontSize: 13, color: "#4A5568", margin: "0 0 20px" }}>This record has been saved to the <strong>Evaluations Dashboard</strong>.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={printSummary} style={{ background: "#fff", border: "1px solid #C8D0DB", borderRadius: 5, padding: "9px 18px", fontSize: 13, cursor: "pointer", color: "#4A5568" }}>🖨️ Print Summary</button>
              <button onClick={() => setShowConfirmModal(false)} style={{ background: "#1B3A5C", color: "#fff", border: "none", borderRadius: 5, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── App Shell ──
export default function App() {
  const [activeTab, setActiveTab] = useState("new");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(defaultForm);
  const [s3, setS3] = useState(defaultS3);
  const [records, setRecords] = useState([]);
  const [viewRecord, setViewRecord] = useState(null);
  const [storageReady, setStorageReady] = useState(false);

  // Load records from persistent storage on mount
  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get("ltva:records");
        if (result?.value) setRecords(JSON.parse(result.value));
      } catch {
        // No records yet — fresh start
      }
      setStorageReady(true);
    })();
  }, []);

  const selType = TOOL_TYPES.find(t => t.id === form.toolType);
  const isLocked = selType?.locked;
  const escalated = !isLocked && form.escalationFactors.length > 0;
  const derivedTier = isLocked ? 1 : (form.overrideTier || (escalated ? 1 : selType?.defaultTier || 2));

  const goToS3 = () => {
    const isNew = form.vendorRelationship === "new";
    const auto = TRACKS.filter(t => t.autoSelect(derivedTier, isNew)).map(t => t.id);
    setS3({ ...defaultS3, tracks: auto });
    setStep(3);
  };

  const handleSubmit = async (refNum) => {
    const record = { form: { ...form }, s3: { ...s3, refNum }, derivedTier, refNum };
    const updated = [record, ...records];
    setRecords(updated);
    try {
      await window.storage.set("ltva:records", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to persist record:", e);
    }
  };

  const reset = useCallback(() => {
    setForm({ ...defaultForm, dateInitiated: TODAY });
    setS3(defaultS3);
    setStep(1);
  }, []);

  const NavTab = ({ id, label, badge }) => (
    <button onClick={() => setActiveTab(id)} style={{ background: "none", border: "none", borderBottom: activeTab === id ? "3px solid #fff" : "3px solid transparent", color: activeTab === id ? "#fff" : "#9AB2CC", padding: "0 4px 16px", fontSize: 14, fontWeight: activeTab === id ? 600 : 400, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
      {label}
      {badge > 0 && <span style={{ background: activeTab === id ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.15)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 10 }}>{badge}</span>}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6F9", fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <header style={{ background: "#1B3A5C", padding: "0 32px", boxShadow: "0 2px 8px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: 22, marginRight: 12 }}>🏛️</span>
            <div>
              <div style={{ color: "#fff", fontFamily: "Georgia,serif", fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>Legal Tool Vetting Assistant</div>
              <div style={{ color: "#9AB2CC", fontSize: 11, letterSpacing: 0.5 }}>Knowledge Management · Technology Evaluation</div>
            </div>
          </div>
          {activeTab === "new" && step > 1 && (
            <button onClick={reset} style={{ background: "none", border: "1px solid #4A6D8C", borderRadius: 4, color: "#9AB2CC", fontSize: 12, cursor: "pointer", padding: "5px 12px" }}>+ New Evaluation</button>
          )}
          {activeTab === "dashboard" && (
            <button onClick={() => { reset(); setActiveTab("new"); }} style={{ background: "#fff", border: "none", borderRadius: 4, color: "#1B3A5C", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "6px 16px" }}>+ New Evaluation</button>
          )}
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 4 }}>
          <NavTab id="new" label="New Evaluation" />
          <NavTab id="dashboard" label="Evaluations" badge={records.length} />
        </div>
      </header>
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "36px 16px 80px" }}>
        {activeTab === "new" && (
          <>
            <StepIndicator step={step} />
            <div style={{ background: "#fff", borderRadius: 8, padding: "32px 36px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", border: "1px solid #DDE3EC" }}>
              {step === 1 && <Screen1 form={form} setForm={setForm} onNext={() => setStep(2)} />}
              {step === 2 && <Screen2 form={form} setForm={setForm} onNext={goToS3} onBack={() => setStep(1)} />}
              {step === 3 && <Screen3 form={form} s3={s3} setS3={setS3} onBack={() => setStep(2)} derivedTier={derivedTier} onSubmit={handleSubmit} />}
            </div>
          </>
        )}
        {activeTab === "dashboard" && (
          <div>
            <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ fontFamily: "Georgia,serif", color: "#1B3A5C", margin: "0 0 4px", fontSize: 24 }}>Evaluations Dashboard</h2>
                <p style={{ fontSize: 14, color: "#7A8A9E", margin: 0 }}>
                  {storageReady ? "Records are saved and will persist across sessions." : "Loading saved records…"}
                </p>
              </div>
              {records.length > 0 && (
                <button
                  onClick={async () => {
                    if (!confirm("Clear all saved records? This cannot be undone.")) return;
                    setRecords([]);
                    try { await window.storage.delete("ltva:records"); } catch {}
                  }}
                  style={{ background: "none", border: "1px solid #E74C3C", borderRadius: 5, color: "#C0392B", fontSize: 13, cursor: "pointer", padding: "6px 14px" }}
                >
                  🗑 Clear All Records
                </button>
              )}
            </div>
            {!storageReady
              ? <div style={{ textAlign: "center", padding: "60px 20px", color: "#7A8A9E", fontSize: 14 }}>Loading saved records…</div>
              : <Dashboard records={records} onView={r => setViewRecord(r)} />
            }
          </div>
        )}
      </main>
      {viewRecord && <SummaryModal record={viewRecord} onClose={() => setViewRecord(null)} />}
    </div>
  );
}
