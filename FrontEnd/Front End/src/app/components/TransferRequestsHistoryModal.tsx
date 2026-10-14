import {
  X, CheckCircle, XCircle, Loader2, User, Clock,
  QrCode, MapPin, ArrowRight, ArrowLeft, Shield, AlertCircle,
  Calendar, FileText, Filter, Search, Trash2, PackageCheck,
  RefreshCw, GitBranch, Plus, Save, ChevronRight, ChevronLeft, Pencil, Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { getTransferRequests, approveTransferRequest, declineTransferRequest, confirmTransferArrival } from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────
type TRStatus = string;

interface TransferRequest {
  id: number; ecu: number; ecu_serial: string;
  requested_by: number | null; requested_by_name: string;
  requested_to_location: string; old_location: string;
  status: TRStatus; reviewed_by: number | null; reviewed_by_name?: string;
  reviewed_at: string | null; review_notes: string; created_at: string; updated_at: string;
}

interface TransferRequestsHistoryModalProps {
  isOpen: boolean; onClose: () => void;
  onApprove?: (id: string, reason: string) => Promise<void> | void;
  onDecline?: (id: string, reason: string) => Promise<void> | void;
  onConfirmArrival?: (id: string) => Promise<void> | void;
}

// ─── Workflow types ───────────────────────────────────────────────────────────
type NodeType  = 'start' | 'intermediate' | 'terminal' | 'end';
type NodeColor = 'blue' | 'green' | 'amber' | 'red' | 'teal' | 'purple' | 'gray' | 'pink' | 'indigo' | 'cyan' | 'orange' | 'rose';

interface StatusField {
  id: string; label: string;
  type: 'text' | 'date' | 'number' | 'checkbox' | 'textarea'; required: boolean;
}

interface StatusNode {
  id: string; label: string; type: NodeType; color: NodeColor;
  x: number; y: number; fields: StatusField[];
}

interface WFTransition { id: string; from: string; to: string; label: string; }

interface Workflow {
  id: string; name: string; nodes: StatusNode[]; transitions: WFTransition[]; isDefault?: boolean; updatedAt?: string;
}

// ─── Color map (12 colors) ────────────────────────────────────────────────────
const COLOR_MAP: Record<NodeColor, { bg: string; border: string; text: string; dot: string; name: string }> = {
  blue:   { bg: '#E6F1FB', border: '#85B7EB', text: '#0C447C', dot: '#378ADD', name: 'Blue'   },
  green:  { bg: '#EAF3DE', border: '#97C459', text: '#27500A', dot: '#639922', name: 'Green'  },
  amber:  { bg: '#FAEEDA', border: '#EF9F27', text: '#633806', dot: '#BA7517', name: 'Amber'  },
  red:    { bg: '#FCEBEB', border: '#F09595', text: '#791F1F', dot: '#E24B4A', name: 'Red'    },
  teal:   { bg: '#E1F5EE', border: '#5DCAA5', text: '#085041', dot: '#1D9E75', name: 'Teal'   },
  purple: { bg: '#EEEDFE', border: '#AFA9EC', text: '#26215C', dot: '#7F77DD', name: 'Purple' },
  gray:   { bg: '#F1EFE8', border: '#B4B2A9', text: '#2C2C2A', dot: '#888780', name: 'Gray'   },
  pink:   { bg: '#FBEAF0', border: '#ED93B1', text: '#4B1528', dot: '#D4537E', name: 'Pink'   },
  indigo: { bg: '#EEF2FF', border: '#818CF8', text: '#1e1b4b', dot: '#6366F1', name: 'Indigo' },
  cyan:   { bg: '#ECFEFF', border: '#67E8F9', text: '#083344', dot: '#06B6D4', name: 'Cyan'   },
  orange: { bg: '#FFF7ED', border: '#FDBA74', text: '#431407', dot: '#F97316', name: 'Orange' },
  rose:   { bg: '#FFF1F2', border: '#FDA4AF', text: '#4c0519', dot: '#F43F5E', name: 'Rose'   },
};

const TYPE_DEFAULTS: Record<NodeType, NodeColor> = { start: 'teal', intermediate: 'blue', terminal: 'red', end: 'green' };

// ─── Default workflow ─────────────────────────────────────────────────────────
const DEFAULT_WORKFLOW: Workflow = {
  id: 'default', name: 'Standard transfer workflow', isDefault: true,
  nodes: [
    { id: 'pending',   label: 'Pending',   type: 'start',        color: 'teal',  x: 220, y: 40,  fields: [] },
    { id: 'approved',  label: 'Approved',  type: 'intermediate', color: 'green', x: 80,  y: 200, fields: [] },
    { id: 'declined',  label: 'Declined',  type: 'terminal',     color: 'red',   x: 360, y: 200, fields: [{ id: 'f1', label: 'Reason', type: 'textarea', required: true }] },
    { id: 'confirmed', label: 'Confirmed', type: 'end',          color: 'green', x: 80,  y: 360, fields: [] },
  ],
  transitions: [
    { id: 't1', from: 'pending',  to: 'approved',  label: 'Approve' },
    { id: 't2', from: 'pending',  to: 'declined',  label: 'Decline' },
    { id: 't3', from: 'approved', to: 'confirmed', label: 'Confirm arrival' },
  ],
};

const uid = () => Math.random().toString(36).slice(2, 9);

// ─── Persist workflows in localStorage ───────────────────────────────────────
const WF_STORAGE_KEY = 'transfer_workflows_v1';
const ACTIVE_WF_KEY  = 'transfer_active_workflow_v1';

function loadWorkflows(): Workflow[] {
  try {
    const raw = localStorage.getItem(WF_STORAGE_KEY);
    if (raw) {
      const parsed: Workflow[] = JSON.parse(raw);
      // ensure default always exists
      const hasDefault = parsed.some(w => w.id === 'default');
      return hasDefault ? parsed : [DEFAULT_WORKFLOW, ...parsed];
    }
  } catch {}
  return [DEFAULT_WORKFLOW];
}

function saveWorkflows(wfs: Workflow[]) {
  try { localStorage.setItem(WF_STORAGE_KEY, JSON.stringify(wfs)); } catch {}
}

function loadActiveWfId(): string {
  try { return localStorage.getItem(ACTIVE_WF_KEY) || 'default'; } catch { return 'default'; }
}

function saveActiveWfId(id: string) {
  try { localStorage.setItem(ACTIVE_WF_KEY, id); } catch {}
}

// ─── Validate workflow ────────────────────────────────────────────────────────
function validateWorkflow(wf: Workflow): string[] {
  const errors: string[] = [];
  const starts = wf.nodes.filter(n => n.type === 'start');
  const ends   = wf.nodes.filter(n => n.type === 'end');
  if (starts.length === 0) errors.push('No start status defined');
  if (starts.length > 1)  errors.push('Only one start status allowed');
  if (ends.length === 0)  errors.push('No end status (Confirmed) — needed to trigger location change');
  if (wf.nodes.length < 2) errors.push('Add at least 2 statuses');
  if (wf.transitions.length === 0 && wf.nodes.length >= 2) errors.push('No transitions — add at least one');
  if (starts.length === 1 && ends.length > 0) {
    const reachable = new Set<string>();
    const queue = [starts[0].id];
    while (queue.length) {
      const cur = queue.shift()!; if (reachable.has(cur)) continue; reachable.add(cur);
      wf.transitions.filter(t => t.from === cur).forEach(t => queue.push(t.to));
    }
    ends.forEach(e => { if (!reachable.has(e.id)) errors.push(`"${e.label}" is not reachable from start`); });
  }
  return errors;
}

// ─── Cleared IDs ──────────────────────────────────────────────────────────────
const CK = 'transfer_requests_cleared_ids';
function getClearedIds(): number[] { try { return JSON.parse(localStorage.getItem(CK) || '[]'); } catch { return []; } }
function addClearedIds(ids: number[]) { localStorage.setItem(CK, JSON.stringify([...new Set([...getClearedIds(), ...ids])])); }

// ─── Date filter ──────────────────────────────────────────────────────────────
function applyDateFilter(reqs: TransferRequest[], f: string, c: { start: string; end: string }) {
  if (f === 'All Time') return reqs;
  const now = new Date();
  return reqs.filter(r => {
    const d = new Date(r.created_at);
    if (f === 'Last 7 Days')  return now.getTime() - d.getTime() <= 7  * 86400000;
    if (f === 'Last 30 Days') return now.getTime() - d.getTime() <= 30 * 86400000;
    if (f === 'Last 90 Days') return now.getTime() - d.getTime() <= 90 * 86400000;
    if (f === 'This Year')    return d.getFullYear() === now.getFullYear();
    if (f === 'Custom Range' && c.start && c.end) {
      const s = new Date(c.start), e = new Date(c.end); e.setHours(23,59,59); return d >= s && d <= e;
    }
    return true;
  });
}
const DATE_OPTIONS = ['Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'This Year', 'All Time', 'Custom Range'];

// ─── Dynamic Status Badge ─────────────────────────────────────────────────────
function StatusBadge({ status, workflow, onClick }: { status: string; workflow: Workflow; onClick?: () => void }) {
  const node = workflow.nodes.find(n => n.label.toLowerCase() === status.toLowerCase());
  const col  = node ? COLOR_MAP[node.color] : COLOR_MAP.gray;
  const hasTransitions = node ? workflow.transitions.some(t => t.from === node.id) : false;
  return (
    <button onClick={hasTransitions ? onClick : undefined} disabled={!hasTransitions}
      title={hasTransitions ? 'Click to take action' : 'No actions available'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20,
        background: col.bg, border: `1px solid ${col.border}`, color: col.text,
        fontSize: 11, fontWeight: 600,
        cursor: hasTransitions ? 'pointer' : 'default',
        opacity: hasTransitions ? 1 : 0.85,
        transition: 'opacity 0.15s, box-shadow 0.15s',
        boxShadow: hasTransitions ? undefined : 'none' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: col.dot, flexShrink: 0 }} />
      {status}
      {hasTransitions && <ChevronRight style={{ width: 10, height: 10, opacity: 0.5 }} />}
    </button>
  );
}

// ─── Arrow Layer ──────────────────────────────────────────────────────────────
function ArrowLayer({ nodes, transitions, selectedId, onSelect }:
  { nodes: StatusNode[]; transitions: WFTransition[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const nm = Object.fromEntries(nodes.map(n => [n.id, n]));
  const NW = 140, NH = 64;
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
      <defs>
        {(Object.keys(COLOR_MAP) as NodeColor[]).map(c => (
          <marker key={c} id={`wf-${c}`} markerWidth="7" markerHeight="6" refX="6" refY="3" orient="auto">
            <path d="M0 0 L7 3 L0 6 Z" fill={COLOR_MAP[c].border} />
          </marker>
        ))}
      </defs>
      {transitions.map(tr => {
        const from = nm[tr.from], to = nm[tr.to]; if (!from || !to) return null;
        const fx = from.x + NW/2, fy = from.y + NH, tx = to.x + NW/2, ty = to.y;
        const dy = ty - fy, dx = tx - fx;
        const cy = Math.max(Math.abs(dy)*0.5, 36), cx = dx*0.28;
        const d = `M${fx} ${fy} C${fx+cx} ${fy+cy} ${tx-cx} ${ty-cy} ${tx} ${ty}`;
        const col: NodeColor = nm[tr.to]?.color ?? 'blue';
        const sel = tr.id === selectedId;
        return (
          <g key={tr.id} style={{ pointerEvents: 'all', cursor: 'pointer' }} onClick={() => onSelect(tr.id)}>
            <path d={d} fill="none" stroke="transparent" strokeWidth="14" />
            <path d={d} fill="none" stroke={sel ? '#3b5bdb' : COLOR_MAP[col].border}
              strokeWidth={sel ? 2 : 1.5} strokeDasharray={sel ? '5 3' : undefined} markerEnd={`url(#wf-${col})`} />
            <text x={(fx+tx)/2+4} y={(fy+ty)/2-5} fontSize="10" fill={sel ? '#3b5bdb' : '#94a3b8'}
              fontFamily="inherit" fontWeight={sel ? '600' : '400'}>{tr.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Canvas Node ──────────────────────────────────────────────────────────────
function CanvasNode({ node, isSelected, onSelect, onDragEnd, onDoubleClick }:
  { node: StatusNode; isSelected: boolean; onSelect: () => void;
    onDragEnd: (x: number, y: number) => void; onDoubleClick: () => void }) {
  const col = COLOR_MAP[node.color];
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef(false), off = useRef({ x: 0, y: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    let moved = false;
    off.current = { x: e.clientX - node.x, y: e.clientY - node.y };
    drag.current = false;
    const onMove = (ev: MouseEvent) => {
      if (Math.abs(ev.clientX - startX) > 4 || Math.abs(ev.clientY - startY) > 4) {
        moved = true; drag.current = true;
      }
      if (!drag.current || !ref.current) return;
      ref.current.style.left = Math.max(0, ev.clientX - off.current.x) + 'px';
      ref.current.style.top  = Math.max(0, ev.clientY - off.current.y) + 'px';
    };
    const onUp = (ev: MouseEvent) => {
      ev.stopPropagation(); // prevent canvas onClick from clearing selection
      drag.current = false;
      if (moved) {
        onDragEnd(Math.max(0, ev.clientX - off.current.x), Math.max(0, ev.clientY - off.current.y));
      } else {
        onSelect(); // clean click — open inspector
      }
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const tb: Record<NodeType, { bg: string; color: string; label: string }> = {
    start:        { bg: '#E1F5EE', color: '#085041', label: 'start' },
    intermediate: { bg: '#E6F1FB', color: '#0C447C', label: 'step' },
    terminal:     { bg: '#FCEBEB', color: '#791F1F', label: 'terminal' },
    end:          { bg: '#EAF3DE', color: '#27500A', label: 'end · ⟳ loc' },
  };

  return (
    <div ref={ref} onMouseDown={onMouseDown} onDoubleClick={e => { e.stopPropagation(); onDoubleClick(); }}
      style={{ position: 'absolute', left: node.x, top: node.y, width: 140, borderRadius: 10,
        border: `1.5px solid ${isSelected ? '#3b5bdb' : col.border}`, background: col.bg,
        padding: '10px 12px', cursor: 'grab', userSelect: 'none',
        boxShadow: isSelected ? '0 0 0 3px rgba(59,91,219,0.18)' : '0 1px 4px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.12s, border-color 0.12s', zIndex: isSelected ? 10 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: col.text, lineHeight: 1.3 }}>{node.label}</span>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: col.dot, flexShrink: 0, marginTop: 3 }} />
      </div>
      <span style={{ marginTop: 6, display: 'inline-block', fontSize: 9, fontWeight: 600,
        padding: '2px 6px', borderRadius: 20, background: tb[node.type].bg, color: tb[node.type].color }}>
        {tb[node.type].label}
      </span>
      {node.fields.length > 0 && (
        <div style={{ marginTop: 4, fontSize: 9, color: col.dot }}>
          {node.fields.length} field{node.fields.length > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

// ─── Node Edit Modal ──────────────────────────────────────────────────────────
function NodeEditModal({ node, onSave, onClose }:
  { node: StatusNode; onSave: (n: StatusNode) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<StatusNode>({ ...node, fields: node.fields.map(f => ({ ...f })) });
  const inp: React.CSSProperties = { width: '100%', padding: '7px 9px', fontSize: 12, borderRadius: 7, border: '1px solid #e2e8f0', outline: 'none', background: '#fff', color: '#0f172a', boxSizing: 'border-box' };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
        style={{ background: '#fff', borderRadius: 16, width: 420, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Edit status</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X style={{ width: 15, height: 15 }} /></button>
        </div>
        <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>Name</label>
            <input value={draft.label} onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>Type</label>
            <select value={draft.type} onChange={e => { const t = e.target.value as NodeType; setDraft(d => ({ ...d, type: t, color: TYPE_DEFAULTS[t] })); }} style={inp}>
              <option value="start">Start</option>
              <option value="intermediate">Intermediate</option>
              <option value="terminal">Terminal (no outgoing)</option>
              <option value="end">End · triggers location change (Confirmed)</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: '#64748b', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Color</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6 }}>
              {(Object.keys(COLOR_MAP) as NodeColor[]).map(c => (
                <button key={c} onClick={() => setDraft(d => ({ ...d, color: c }))} title={COLOR_MAP[c].name}
                  style={{ padding: 6, borderRadius: 7, cursor: 'pointer', border: `2px solid ${draft.color === c ? COLOR_MAP[c].dot : 'transparent'}`, background: COLOR_MAP[c].bg, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: COLOR_MAP[c].dot }} />
                  <span style={{ fontSize: 7, color: COLOR_MAP[c].text }}>{COLOR_MAP[c].name}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Fields</label>
              <button onClick={() => setDraft(d => ({ ...d, fields: [...d.fields, { id: uid(), label: '', type: 'text', required: false }] }))}
                style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#3b5bdb', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Plus style={{ width: 10, height: 10 }} /> Add field
              </button>
            </div>
            {draft.fields.length === 0
              ? <div style={{ fontSize: 11, color: '#cbd5e1' }}>No fields — fields must be filled when this status is applied via the review modal</div>
              : draft.fields.map((f, i) => (
                <div key={f.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 7, padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <input value={f.label} onChange={e => setDraft(d => ({ ...d, fields: d.fields.map((ff, ii) => ii === i ? { ...ff, label: e.target.value } : ff) }))}
                    placeholder="Field name" style={{ ...inp, flex: 1, margin: 0 }} />
                  <select value={f.type} onChange={e => setDraft(d => ({ ...d, fields: d.fields.map((ff, ii) => ii === i ? { ...ff, type: e.target.value as StatusField['type'] } : ff) }))}
                    style={{ padding: '5px 6px', fontSize: 11, borderRadius: 6, border: '1px solid #e2e8f0', outline: 'none', background: '#fff' }}>
                    <option value="text">Text</option>
                    <option value="textarea">Long text</option>
                    <option value="date">Date</option>
                    <option value="number">Number</option>
                    <option value="checkbox">Checkbox</option>
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#64748b', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={f.required} onChange={e => setDraft(d => ({ ...d, fields: d.fields.map((ff, ii) => ii === i ? { ...ff, required: e.target.checked } : ff) }))} /> Req
                  </label>
                  <button onClick={() => setDraft(d => ({ ...d, fields: d.fields.filter((_, ii) => ii !== i) }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', flexShrink: 0 }}>
                    <Trash2 style={{ width: 11, height: 11 }} />
                  </button>
                </div>
              ))
            }
          </div>
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, color: '#64748b', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => { onSave(draft); onClose(); }} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#3b5bdb', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Save</button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Add Transition Dialog ────────────────────────────────────────────────────
function AddTransitionDialog({ nodes, defaultFrom, onAdd, onClose }:
  { nodes: StatusNode[]; defaultFrom?: string; onAdd: (f: string, t: string, l: string) => void; onClose: () => void }) {
  const [from, setFrom] = useState(defaultFrom ?? nodes[0]?.id ?? '');
  const [to,   setTo  ] = useState('');
  const [label, setLabel] = useState('');
  const avail = nodes.filter(n => n.id !== from);
  useEffect(() => { if (avail.length) setTo(avail[0].id); }, [from]);
  const s: React.CSSProperties = { width: '100%', padding: '7px 9px', fontSize: 12, borderRadius: 7, border: '1px solid #e2e8f0', outline: 'none', background: '#fff', color: '#0f172a' };
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 20, width: 300, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 14 }}>Add transition</div>
        {[{ lbl: 'From', val: from, set: setFrom, opts: nodes }, { lbl: 'To', val: to, set: setTo, opts: avail }].map(f => (
          <div key={f.lbl} style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 10, color: '#64748b', marginBottom: 3 }}>{f.lbl}</label>
            <select value={f.val} onChange={e => f.set(e.target.value)} style={s}>{f.opts.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select>
          </div>
        ))}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 10, color: '#64748b', marginBottom: 3 }}>Button label</label>
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Approve" style={s} />
          <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 3 }}>This text appears as the action button in the review modal</div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '6px 13px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, color: '#64748b', cursor: 'pointer' }}>Cancel</button>
          <button disabled={!from || !to || !label || from === to} onClick={() => { onAdd(from, to, label); onClose(); }}
            style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: '#3b5bdb', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: (!from || !to || !label || from === to) ? 0.45 : 1 }}>Add</button>
        </div>
      </div>
    </div>
  );
}

// ─── Inspector ────────────────────────────────────────────────────────────────
function Inspector({ selected, nodes, transitions, onEditNode, onDeleteNode, onUpdateTransition, onDeleteTransition, onAddTransition }:
  { selected: { type: 'node' | 'transition'; id: string } | null; nodes: StatusNode[]; transitions: WFTransition[];
    onEditNode: (id: string) => void; onDeleteNode: (id: string) => void;
    onUpdateTransition: (id: string, p: Partial<WFTransition>) => void;
    onDeleteTransition: (id: string) => void; onAddTransition: () => void }) {
  const inp: React.CSSProperties = { width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 7, border: '1px solid #e2e8f0', outline: 'none', background: '#fff', color: '#0f172a', boxSizing: 'border-box' };

  if (!selected) return (
    <div style={{ padding: 14, fontSize: 11, color: '#94a3b8', lineHeight: 1.7 }}>
      <strong style={{ color: '#64748b', display: 'block', marginBottom: 4 }}>How to use</strong>
      · Click a node to inspect it here<br />
      · Double-click to edit name, color, fields<br />
      · Click an arrow to inspect/edit it<br />
      · Drag nodes to reposition<br />
      <div style={{ marginTop: 10, padding: 8, borderRadius: 7, background: '#f0f4ff', border: '1px solid #c7d2fe', fontSize: 10, color: '#3730a3' }}>
        The <strong>end</strong> node (Confirmed) triggers location change when reached.
      </div>
    </div>
  );

  if (selected.type === 'node') {
    const node = nodes.find(n => n.id === selected.id); if (!node) return null;
    const col = COLOR_MAP[node.color];
    const outgoing = transitions.filter(t => t.from === node.id);
    return (
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: col.dot }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{node.label}</span>
        </div>
        <button onClick={() => onEditNode(node.id)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 7, border: '1px solid #c7d2fe', background: '#eef2ff', color: '#3730a3', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
          <Pencil style={{ width: 11, height: 11 }} /> Edit name, color & fields
        </button>
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase' }}>Fields ({node.fields.length})</div>
          {node.fields.length === 0
            ? <div style={{ fontSize: 10, color: '#cbd5e1' }}>None</div>
            : node.fields.map(f => (
              <div key={f.id} style={{ fontSize: 10, color: '#64748b', padding: '3px 6px', borderRadius: 5, background: '#f8fafc', marginBottom: 3 }}>
                {f.label || '(unnamed)'} · {f.type}{f.required ? ' *' : ''}
              </div>
            ))
          }
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase' }}>Transitions out</div>
          {outgoing.length === 0 ? <div style={{ fontSize: 10, color: '#cbd5e1' }}>Dead end — add a transition</div>
            : outgoing.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 6px', borderRadius: 5, background: '#f8fafc', marginBottom: 3, fontSize: 10, color: '#64748b' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={e => (e.currentTarget.style.background = '#f8fafc')}>
                <ArrowRight style={{ width: 9, height: 9, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{nodes.find(n => n.id === t.to)?.label}</span>
                <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>"{t.label}"</span>
                <button
                  onClick={() => onDeleteTransition(t.id)}
                  title="Remove transition"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: '1px 2px', borderRadius: 3, display: 'flex', alignItems: 'center', flexShrink: 0, lineHeight: 1 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#cbd5e1')}>
                  <Trash2 style={{ width: 9, height: 9 }} />
                </button>
              </div>
            ))
          }
          <button onClick={onAddTransition} style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#3b5bdb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Plus style={{ width: 10, height: 10 }} /> Add transition from here
          </button>
        </div>
        {node.type !== 'start' && (
          <button onClick={() => onDeleteNode(node.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Trash2 style={{ width: 10, height: 10 }} /> Delete status
          </button>
        )}
      </div>
    );
  }

  const tr = transitions.find(t => t.id === selected.id); if (!tr) return null;
  const fn = nodes.find(n => n.id === tr.from), tn = nodes.find(n => n.id === tr.to);
  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Transition</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 8, background: '#f8fafc', border: '1px solid #f1f5f9', fontSize: 11 }}>
        <span style={{ fontWeight: 500, color: fn ? COLOR_MAP[fn.color].text : '#0f172a' }}>{fn?.label ?? tr.from}</span>
        <ArrowRight style={{ width: 10, height: 10, color: '#94a3b8' }} />
        <span style={{ fontWeight: 500, color: tn ? COLOR_MAP[tn.color].text : '#0f172a' }}>{tn?.label ?? tr.to}</span>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 10, color: '#64748b', marginBottom: 3 }}>Button label</label>
        <input value={tr.label} onChange={e => onUpdateTransition(tr.id, { label: e.target.value })} style={inp} />
        <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 3 }}>Shown as the action button in the review modal</div>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 10, color: '#64748b', marginBottom: 3 }}>To status</label>
        <select value={tr.to} onChange={e => onUpdateTransition(tr.id, { to: e.target.value })} style={inp}>
          {nodes.filter(n => n.id !== tr.from).map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
        </select>
      </div>
      <button onClick={() => onDeleteTransition(tr.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <Trash2 style={{ width: 10, height: 10 }} /> Delete transition
      </button>
    </div>
  );
}

// ─── Canvas Editor ────────────────────────────────────────────────────────────
function WorkflowCanvasEditor({ workflow, onSave, onBack, isActive, onActivate }:
  { workflow: Workflow; onSave: (wf: Workflow) => void; onBack: () => void; isActive: boolean; onActivate: () => void }) {
  const [nodes, setNodes]   = useState<StatusNode[]>(workflow.nodes);
  const [trs,   setTrs  ]   = useState<WFTransition[]>(workflow.transitions);
  const [name,  setName ]   = useState(workflow.name);
  const [sel,   setSel  ]   = useState<{ type: 'node' | 'transition'; id: string } | null>(null);
  const [showAddTr, setShowAddTr] = useState(false);
  const [addTrFrom, setAddTrFrom] = useState<string | undefined>();
  const [editNodeId, setEditNodeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const errors = validateWorkflow({ ...workflow, nodes, transitions: trs });
  const valid  = errors.length === 0;

  const hasUnsavedChanges = JSON.stringify({ name, nodes, transitions: trs }) !== JSON.stringify({ name: workflow.name, nodes: workflow.nodes, transitions: workflow.transitions });

  const handleBack = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Discard them and go back?')) onBack();
    } else {
      onBack();
    }
  };

  const updateNode = (id: string, p: Partial<StatusNode>) => setNodes(ns => ns.map(n => n.id === id ? { ...n, ...p } : n));
  const saveNode   = (updated: StatusNode) => setNodes(ns => ns.map(n => n.id === updated.id ? updated : n));
  const deleteNode = (id: string) => { setNodes(ns => ns.filter(n => n.id !== id)); setTrs(ts => ts.filter(t => t.from !== id && t.to !== id)); setSel(null); };
  const addNode    = () => { const id = uid(); setNodes(ns => [...ns, { id, label: 'New status', type: 'intermediate', color: 'blue', x: 80+Math.random()*160, y: 80+Math.random()*180, fields: [] }]); setSel({ type: 'node', id }); };
  const addTr      = (f: string, t: string, l: string) => setTrs(ts => [...ts, { id: uid(), from: f, to: t, label: l }]);
  const updateTr   = (id: string, p: Partial<WFTransition>) => setTrs(ts => ts.map(t => t.id === id ? { ...t, ...p } : t));
  const deleteTr   = (id: string) => { setTrs(ts => ts.filter(t => t.id !== id)); if (sel?.id === id) setSel(null); };
  const handleSave = async () => {
    if (!valid) return;
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 300));
    onSave({ ...workflow, name, nodes, transitions: trs });
    setIsSaving(false);
  };

  const editingNode = editNodeId ? nodes.find(n => n.id === editNodeId) ?? null : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #f1f5f9', background: '#fafafa', flexShrink: 0 }}>
        <button onClick={handleBack} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', fontSize: 11, color: '#64748b', cursor: 'pointer' }}>← Back</button>
        <input value={name} onChange={e => setName(e.target.value)}
          style={{ flex: 1, padding: '5px 9px', fontSize: 12, fontWeight: 500, maxWidth: 240, border: '1px solid #e2e8f0', borderRadius: 7, outline: 'none', color: '#0f172a', background: '#fff' }} />
        {!isActive
          ? <button onClick={onActivate} style={{ padding: '5px 11px', borderRadius: 7, border: '1px solid #818cf8', background: '#eef2ff', color: '#3b5bdb', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>Set active</button>
          : <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: '#3b5bdb', color: '#fff', fontWeight: 500 }}>Active</span>
        }
        <div style={{ flex: 1 }} />
        <button onClick={addNode} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', fontSize: 11, color: '#475569', cursor: 'pointer' }}>
          <Plus style={{ width: 11, height: 11 }} /> Status
        </button>
        <button onClick={() => { setAddTrFrom(sel?.type === 'node' ? sel.id : undefined); setShowAddTr(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', fontSize: 11, color: '#475569', cursor: 'pointer' }}>
          <ArrowRight style={{ width: 11, height: 11 }} /> Transition
        </button>
      </div>

      {/* Canvas + Inspector */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div onClick={() => setSel(null)}
          style={{ flex: 1, position: 'relative', background: '#f8fafc', overflow: 'auto', minHeight: 0,
            backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
          <ArrowLayer nodes={nodes} transitions={trs}
            selectedId={sel?.type === 'transition' ? sel.id : null}
            onSelect={id => setSel({ type: 'transition', id })} />
          {nodes.map(node => (
            <CanvasNode key={node.id} node={node}
              isSelected={sel?.type === 'node' && sel.id === node.id}
              onSelect={() => setSel({ type: 'node', id: node.id })}
              onDragEnd={(x, y) => updateNode(node.id, { x, y })}
              onDoubleClick={() => setEditNodeId(node.id)} />
          ))}
          {showAddTr && <AddTransitionDialog nodes={nodes} defaultFrom={addTrFrom} onAdd={addTr} onClose={() => setShowAddTr(false)} />}
        </div>
        <div style={{ width: 190, borderLeft: '1px solid #f1f5f9', background: '#fff', overflowY: 'auto', flexShrink: 0 }}>
          <Inspector selected={sel} nodes={nodes} transitions={trs}
            onEditNode={id => setEditNodeId(id)}
            onDeleteNode={deleteNode} onUpdateTransition={updateTr} onDeleteTransition={deleteTr}
            onAddTransition={() => { setAddTrFrom(sel?.type === 'node' ? sel.id : undefined); setShowAddTr(true); }} />
        </div>
      </div>

      {/* Footer */}
      {/* Footer */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid #f1f5f9', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
        <button onClick={handleSave} disabled={!valid || isSaving}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, border: 'none',
            background: valid ? '#3b5bdb' : '#e2e8f0', color: valid ? '#fff' : '#94a3b8',
            fontSize: 12, fontWeight: 600, cursor: valid ? 'pointer' : 'not-allowed' }}>
          {isSaving ? <><Loader2 style={{ width: 11, height: 11 }} className="animate-spin" /> Saving…</> : <><Save style={{ width: 11, height: 11 }} /> Save workflow</>}
        </button>
      </div>

      <AnimatePresence>
        {editingNode && <NodeEditModal node={editingNode} onSave={saveNode} onClose={() => setEditNodeId(null)} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Workflow List ────────────────────────────────────────────────────────────
function WorkflowListView({ workflows, activeId, onEdit, onCreate, onActivate, onDelete }:
  { workflows: Workflow[]; activeId: string | null; onEdit: (id: string) => void; onCreate: () => void;
    onActivate: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Workflows</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>Click a workflow to set it active · Edit to modify</div>
        </div>
        <button onClick={onCreate} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 11, fontWeight: 500, color: '#475569', cursor: 'pointer' }}>
          <Plus style={{ width: 11, height: 11 }} /> New workflow
        </button>
      </div>
      {workflows.map(wf => {
        const isActive = wf.id === activeId;
        const fmtUpdated = wf.updatedAt
          ? new Date(wf.updatedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : null;
        return (
          <div key={wf.id} onClick={() => onActivate(wf.id)}
            style={{ borderRadius: 12, border: isActive ? '1.5px solid #3b5bdb' : '1px solid #e2e8f0',
              background: isActive ? '#f0f4ff' : '#fff', padding: '13px 15px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer', transition: 'all 0.15s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                background: isActive ? '#eef2ff' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <GitBranch style={{ width: 14, height: 14, color: isActive ? '#3b5bdb' : '#94a3b8' }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? '#1e3a8a' : '#0f172a', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {wf.name}
                  {wf.isDefault && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 20, background: '#f1f5f9', color: '#64748b', fontWeight: 400 }}>default</span>}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                  {wf.nodes.length} statuses · {wf.transitions.length} transitions
                  {fmtUpdated && <span style={{ marginLeft: 8, color: '#cbd5e1' }}>· updated {fmtUpdated}</span>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {isActive && <span style={{ fontSize: 9, padding: '3px 7px', borderRadius: 20, background: '#3b5bdb', color: '#fff', fontWeight: 500 }}>Active</span>}
              <button onClick={e => { e.stopPropagation(); onEdit(wf.id); }}
                title="Edit workflow" style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                <Pencil style={{ width: 11, height: 11 }} />
              </button>
              {!wf.isDefault && (
                <button onClick={e => { e.stopPropagation(); onDelete(wf.id); }}
                  title="Delete workflow" style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #fecaca', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}>
                  <Trash2 style={{ width: 11, height: 11 }} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Dynamic Review Modal ─────────────────────────────────────────────────────
interface ReviewState {
  request: TransferRequest;
  step: 'choose' | 'fill';
  chosenTransition: WFTransition | null;
  fieldValues: Record<string, string | boolean>;
}

function DynamicReviewModal({ state, workflow, onClose, onSubmit, isProcessing, onUpdateState }:
  { state: ReviewState; workflow: Workflow; onClose: () => void;
    onSubmit: (req: TransferRequest, tr: WFTransition, fields: Record<string, string | boolean>) => void;
    isProcessing: boolean;
    onUpdateState: (patch: Partial<ReviewState>) => void }) {
  const req  = state.request;
  const node = workflow.nodes.find(n => n.label.toLowerCase() === req.status.toLowerCase());
  const outgoing = node ? workflow.transitions.filter(t => t.from === node.id) : [];
  const toNode   = state.chosenTransition ? workflow.nodes.find(n => n.id === state.chosenTransition!.to) : null;
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', outline: 'none', background: '#fff', color: '#0f172a', boxSizing: 'border-box' };

  const canSubmit = !toNode || toNode.fields.filter(f => f.required).every(f => {
    const v = state.fieldValues[f.id];
    if (f.type === 'checkbox') return true;
    return v !== undefined && v !== '';
  });

  const chosenCol = state.chosenTransition
    ? (() => { const tn = workflow.nodes.find(n => n.id === state.chosenTransition!.to); return tn ? COLOR_MAP[tn.color] : COLOR_MAP.blue; })()
    : COLOR_MAP.blue;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,15,30,0.65)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        style={{ background: '#fff', borderRadius: 20, width: 460, maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 32px 80px rgba(0,0,0,0.28)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px 16px', flexShrink: 0, background: 'linear-gradient(135deg, #1e3a5f 0%, #243B53 60%, #2d4f6e 100%)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -28, right: -28, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ position: 'absolute', top: -10, right: 40, width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
            {state.step === 'fill' ? (
              <button onClick={() => onUpdateState({ step: 'choose', chosenTransition: null, fieldValues: {} })}
                style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ChevronLeft style={{ width: 14, height: 14 }} />
              </button>
            ) : (
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Zap style={{ width: 15, height: 15, color: 'rgba(255,255,255,0.9)' }} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 600, marginBottom: 1, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                {state.step === 'choose' ? 'Transfer Review' : state.chosenTransition?.label}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>Request #{req.id}</div>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
          {/* Route strip */}
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <MapPin style={{ width: 11, height: 11, color: '#60a5fa', flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{req.ecu_serial || `ECU #${req.ecu}`}</span>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
              <ArrowRight style={{ width: 10, height: 10, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{req.old_location || '—'}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>›</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd' }}>{req.requested_to_location}</span>
            </div>
          </div>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          {['Choose action', 'Confirm'].map((label, i) => {
            const active = (i === 0 && state.step === 'choose') || (i === 1 && state.step === 'fill');
            const done   = i === 0 && state.step === 'fill';
            return (
              <div key={i} style={{ flex: 1, padding: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                borderBottom: active ? '2px solid #3b5bdb' : '2px solid transparent',
                background: active ? '#f8f9ff' : '#fff', transition: 'all 0.2s' }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700,
                  background: done ? '#dcfce7' : active ? '#3b5bdb' : '#f1f5f9',
                  color: done ? '#16a34a' : active ? '#fff' : '#94a3b8' }}>
                  {done ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? '#1e3a8a' : done ? '#16a34a' : '#94a3b8' }}>{label}</span>
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {state.step === 'choose' ? (
            <>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Available actions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {outgoing.length === 0
                  ? <div style={{ fontSize: 12, color: '#94a3b8', padding: '20px', borderRadius: 12, background: '#f8fafc', textAlign: 'center', border: '1px dashed #e2e8f0' }}>No actions available from this status.</div>
                  : outgoing.map(tr => {
                      const tn  = workflow.nodes.find(n => n.id === tr.to);
                      const col = tn ? COLOR_MAP[tn.color] : COLOR_MAP.blue;
                      return (
                        <motion.button key={tr.id} whileHover={{ scale: 1.015, boxShadow: `0 4px 16px ${col.dot}33` }} whileTap={{ scale: 0.99 }}
                          onClick={() => onUpdateState({ step: 'fill', chosenTransition: tr, fieldValues: {} })}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px',
                            borderRadius: 13, border: `1.5px solid ${col.border}`, background: col.bg, cursor: 'pointer', textAlign: 'left',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.04)', transition: 'box-shadow 0.15s' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 11, background: '#fff', border: `1.5px solid ${col.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                              <span style={{ width: 11, height: 11, borderRadius: '50%', background: col.dot, display: 'block' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: col.text, marginBottom: 3 }}>{tr.label}</div>
                              <div style={{ fontSize: 11, color: col.text, opacity: 0.6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <ArrowRight style={{ width: 9, height: 9 }} />
                                <span>{tn?.label}</span>
                                {tn?.fields.length ? <span style={{ padding: '1px 6px', borderRadius: 20, background: 'rgba(0,0,0,0.07)', fontSize: 9, fontWeight: 600 }}>{tn.fields.length} field{tn.fields.length > 1 ? 's' : ''}</span> : null}
                              </div>
                            </div>
                          </div>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <ChevronRight style={{ width: 13, height: 13, color: col.text, opacity: 0.5 }} />
                          </div>
                        </motion.button>
                      );
                    })
                }
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 11,
                background: chosenCol.bg, border: `1.5px solid ${chosenCol.border}`, marginBottom: 2 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: chosenCol.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: chosenCol.text, flex: 1 }}>Applying: <strong>{state.chosenTransition?.label}</strong></span>
                <span style={{ fontSize: 11, color: chosenCol.text, opacity: 0.55, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <ArrowRight style={{ width: 9, height: 9 }} /> {workflow.nodes.find(n => n.id === state.chosenTransition?.to)?.label}
                </span>
              </div>
              {toNode && toNode.fields.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {toNode.fields.map(f => (
                    <div key={f.id}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#475569', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {f.label}{f.required && <span style={{ color: '#ef4444', fontSize: 10 }}>*</span>}
                      </label>
                      {f.type === 'textarea'
                        ? <textarea rows={3} value={(state.fieldValues[f.id] as string) || ''}
                            onChange={e => onUpdateState({ fieldValues: { ...state.fieldValues, [f.id]: e.target.value } })}
                            placeholder={`Enter ${f.label.toLowerCase()}…`}
                            style={{ ...inp, resize: 'none' as const, borderRadius: 10 }} />
                        : f.type === 'checkbox'
                        ? <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                            <input type="checkbox" checked={!!(state.fieldValues[f.id])}
                              onChange={e => onUpdateState({ fieldValues: { ...state.fieldValues, [f.id]: e.target.checked } })}
                              style={{ width: 15, height: 15, accentColor: '#3b5bdb' }} />
                            <span style={{ fontSize: 12, color: '#475569' }}>{f.label}</span>
                          </label>
                        : <input type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                            value={(state.fieldValues[f.id] as string) || ''}
                            onChange={e => onUpdateState({ fieldValues: { ...state.fieldValues, [f.id]: e.target.value } })}
                            placeholder={`Enter ${f.label.toLowerCase()}…`}
                            style={{ ...inp, borderRadius: 10 }} />
                      }
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <CheckCircle style={{ width: 16, height: 16, color: '#16a34a', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#166534' }}>No additional info required. Ready to confirm.</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {state.step === 'fill' && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8, background: '#fafbfc', flexShrink: 0 }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: '9px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 12, fontWeight: 600, color: '#64748b', cursor: 'pointer' }}>
              Cancel
            </button>
            <button disabled={!canSubmit || isProcessing}
              onClick={() => state.chosenTransition && onSubmit(req, state.chosenTransition, state.fieldValues)}
              style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: 'none',
                background: canSubmit && !isProcessing ? `linear-gradient(135deg, ${chosenCol.dot}, ${chosenCol.border})` : '#e2e8f0',
                color: canSubmit && !isProcessing ? '#fff' : '#94a3b8',
                fontSize: 12, fontWeight: 700, cursor: canSubmit && !isProcessing ? 'pointer' : 'not-allowed',
                boxShadow: canSubmit && !isProcessing ? `0 4px 14px ${chosenCol.dot}55` : 'none', transition: 'all 0.2s' }}>
              {isProcessing
                ? <><Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> Processing…</>
                : <>{state.chosenTransition?.label} <ChevronRight style={{ width: 13, height: 13 }} /></>
              }
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
type ModalView = 'requests' | 'workflows';

export function TransferRequestsHistoryModal({ isOpen, onClose, onApprove, onDecline, onConfirmArrival }: TransferRequestsHistoryModalProps) {

  // ── Workflow state — persisted in localStorage ──
  const [workflows, setWorkflows]   = useState<Workflow[]>(() => loadWorkflows());
  const [activeWfId, setActiveWfId] = useState<string>(() => loadActiveWfId());
  const [editingWfId, setEditingWfId] = useState<string | null>(null);

  // Keep localStorage in sync
  useEffect(() => { saveWorkflows(workflows); }, [workflows]);
  useEffect(() => { saveActiveWfId(activeWfId); }, [activeWfId]);

  const activeWorkflow = useMemo(() => workflows.find(w => w.id === activeWfId) ?? DEFAULT_WORKFLOW, [workflows, activeWfId]);

  // ── Requests state ──
  const [view, setView]           = useState<ModalView>('requests');
  const [requests, setRequests]   = useState<TransferRequest[]>([]);
  const [loading, setLoading]     = useState(false);
  const [activeSF, setActiveSF]   = useState<string[]>([]);
  const [search, setSearch]       = useState('');
  const [dateFilter, setDateFilter] = useState('Last 30 Days');
  const [custom, setCustom]       = useState({ start: '', end: '' });
  const [showFP, setShowFP]       = useState(false);
  const [fromLoc, setFromLoc]     = useState<string[]>([]);
  const [toLoc, setToLoc]         = useState<string[]>([]);
  const filterRef = useRef<HTMLDivElement>(null);

  // ── Review state ──
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmReq, setConfirmReq]   = useState<TransferRequest | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showClear, setShowClear]     = useState(false);

  const fetchReqs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTransferRequests();
      const data: TransferRequest[] = res.data.results ?? res.data;
      setRequests(data.filter(r => !getClearedIds().includes(r.id)));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (isOpen) { fetchReqs(); setView('requests'); } }, [isOpen, fetchReqs]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFP(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);

  const allFrom = useMemo(() => [...new Set(requests.map(r => r.old_location).filter(Boolean))].sort(), [requests]);
  const allTo   = useMemo(() => [...new Set(requests.map(r => r.requested_to_location).filter(Boolean))].sort(), [requests]);

  const filtered = useMemo(() => {
    let rows = applyDateFilter(requests, dateFilter, custom);
    if (search.trim()) rows = rows.filter(r => (r.ecu_serial || '').toLowerCase().includes(search.trim().toLowerCase()));
    if (fromLoc.length) rows = rows.filter(r => fromLoc.includes(r.old_location));
    if (toLoc.length)   rows = rows.filter(r => toLoc.includes(r.requested_to_location));
    if (activeSF.length) rows = rows.filter(r => activeSF.some(s => r.status.toLowerCase() === s.toLowerCase()));
    return rows;
  }, [requests, search, dateFilter, custom, fromLoc, toLoc, activeSF]);

  // Stat counts from active workflow nodes
  const statCounts = useMemo(() => {
    const c: Record<string, number> = {};
    activeWorkflow.nodes.forEach(n => { c[n.label] = requests.filter(r => r.status.toLowerCase() === n.label.toLowerCase()).length; });
    return c;
  }, [requests, activeWorkflow]);

  const hasFilters = fromLoc.length > 0 || toLoc.length > 0;
  const clearAll   = () => { setSearch(''); setDateFilter('Last 30 Days'); setCustom({ start:'', end:'' }); setFromLoc([]); setToLoc([]); setActiveSF([]); };
  const toggleLoc  = (list: string[], set: (v: string[]) => void, val: string) => set(list.includes(val) ? list.filter(x => x !== val) : [...list, val]);
  const fmt        = (iso: string) => { if (!iso) return null; const d = new Date(iso); return `${d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })} ${d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}`; };

  // ── Workflow CRUD ──
  const saveWorkflow   = (wf: Workflow) => { setWorkflows(ws => ws.map(w => w.id === wf.id ? { ...wf, updatedAt: new Date().toISOString() } : w)); setEditingWfId(null); };
  const deleteWorkflow = (id: string)   => { setWorkflows(ws => ws.filter(w => w.id !== id)); if (activeWfId === id) setActiveWfId('default'); };
  const createWorkflow = () => {
    const id = uid();
    const pendingId = uid(), confirmedId = uid();
    const newWf: Workflow = {
      id, name: 'New workflow', updatedAt: new Date().toISOString(),
      nodes: [
        { id: pendingId,   label: 'Pending',   type: 'start', color: 'teal',  x: 180, y: 40,  fields: [] },
        { id: confirmedId, label: 'Confirmed', type: 'end',   color: 'green', x: 180, y: 200, fields: [] },
      ],
      transitions: [],
    };
    setWorkflows(ws => [...ws, newWf]);
    setEditingWfId(id);
  };

  // ── Transition submit ──
  const handleTransitionSubmit = async (req: TransferRequest, tr: WFTransition, fields: Record<string, string | boolean>) => {
    setIsProcessing(true);
    try {
      const toNode   = activeWorkflow.nodes.find(n => n.id === tr.to);
      const newStatus = toNode?.label ?? tr.to;
      const notesVal  = Object.values(fields).filter(v => typeof v === 'string' && v).join(', ');

      // Call existing API endpoints where labels match, otherwise generic local update
      const lbl = tr.label.toLowerCase();
      if (lbl.includes('approve')) {
        const res = await approveTransferRequest(req.id, notesVal);
        setRequests(prev => prev.map(r => r.id === req.id ? { ...r, ...res.data, status: newStatus } : r));
        await onApprove?.(String(req.id), notesVal);
      } else if (lbl.includes('decline')) {
        const res = await declineTransferRequest(req.id, notesVal);
        setRequests(prev => prev.map(r => r.id === req.id ? { ...r, ...res.data, status: newStatus } : r));
        await onDecline?.(String(req.id), notesVal);
      } else if (lbl.includes('confirm')) {
        const res = await confirmTransferArrival(req.id);
        setRequests(prev => prev.map(r => r.id === req.id ? { ...r, ...res.data, status: newStatus } : r));
        await onConfirmArrival?.(String(req.id));
      } else {
        // Generic: update status locally (custom transitions like "Schedule")
        setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: newStatus, review_notes: notesVal } : r));
      }
    } catch (e) { console.error(e); } finally {
      setIsProcessing(false);
      setReviewState(null);
    }
  };

  const handleConfirmArrival = async () => {
    if (!confirmReq) return; setIsConfirming(true);
    try {
      const res = await confirmTransferArrival(confirmReq.id);
      await onConfirmArrival?.(String(confirmReq.id));
      setRequests(prev => prev.map(r => r.id === confirmReq.id ? { ...r, status: 'confirmed', ...res.data } : r));
    } finally { setIsConfirming(false); setConfirmReq(null); }
  };

  const editingWorkflow = editingWfId ? workflows.find(w => w.id === editingWfId) ?? null : null;

  // ── Check if a status has available transitions ──
  const isClickable = (status: string) => {
    const node = activeWorkflow.nodes.find(n => n.label.toLowerCase() === status.toLowerCase());
    return node ? activeWorkflow.transitions.some(t => t.from === node.id) : false;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-[14px] z-50 w-full max-w-7xl overflow-hidden flex flex-col"
            style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.18)', height: '92vh', maxHeight: '92vh' }}>

            {/* Header */}
            <div className="px-6 py-4 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #334E68, #243B53)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                    <ArrowRight className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-white tracking-wide">Transfer Requests</h2>
                </div>
                <div className="flex items-center gap-3">
                  <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 3, gap: 2 }}>
                    {(['requests', 'workflows'] as const).map(t => (
                      <button key={t} onClick={() => { setView(t); setEditingWfId(null); }}
                        style={{ padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                          background: view === t ? 'rgba(255,255,255,0.92)' : 'transparent',
                          color: view === t ? '#334E68' : 'rgba(255,255,255,0.7)',
                          fontSize: 12, fontWeight: view === t ? 600 : 400, transition: 'all 0.15s', textTransform: 'capitalize' }}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
              <AnimatePresence mode="wait">

                {/* ── REQUESTS VIEW ── */}
                {view === 'requests' && (
                  <motion.div key="requests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }} className="flex-1 overflow-y-auto flex flex-col">

                    {/* Toolbar */}
                    <div style={{ padding: '10px 20px', borderBottom: '1px solid #F1F5F9', background: '#fff', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
                      <button onClick={() => setView('workflows')}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid #c7d2fe', background: '#eef2ff', cursor: 'pointer', flexShrink: 0 }}>
                        <GitBranch style={{ width: 11, height: 11, color: '#3b5bdb' }} />
                        <span style={{ fontSize: 11, color: '#3730a3', fontWeight: 600 }}>{activeWorkflow.name}</span>
                        <ChevronRight style={{ width: 10, height: 10, color: '#818cf8' }} />
                      </button>
                      <div style={{ width: 1, height: 18, background: '#E2E8F0', flexShrink: 0 }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <Calendar style={{ width: 12, height: 12, color: '#94A3B8', flexShrink: 0 }} />
                        {DATE_OPTIONS.filter(o => o !== 'Custom Range').map(opt => (
                          <button key={opt} onClick={() => { setDateFilter(opt); setCustom({ start:'', end:'' }); }}
                            style={{ padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500,
                              background: dateFilter === opt ? '#334E68' : '#F1F5F9', color: dateFilter === opt ? '#fff' : '#64748B' }}>{opt}</button>
                        ))}
                        <button onClick={() => setDateFilter('Custom Range')}
                          style={{ padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500,
                            background: dateFilter === 'Custom Range' ? '#334E68' : '#F1F5F9', color: dateFilter === 'Custom Range' ? '#fff' : '#64748B' }}>Custom</button>
                      </div>
                      {dateFilter === 'Custom Range' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input type="date" value={custom.start} onChange={e => setCustom(p => ({ ...p, start: e.target.value }))} style={{ padding: '4px 7px', fontSize: 11, border: '1px solid #E2E8F0', borderRadius: 6, outline: 'none' }} />
                          <span style={{ fontSize: 11, color: '#94A3B8' }}>→</span>
                          <input type="date" value={custom.end} onChange={e => setCustom(p => ({ ...p, end: e.target.value }))} style={{ padding: '4px 7px', fontSize: 11, border: '1px solid #E2E8F0', borderRadius: 6, outline: 'none' }} />
                          <button onClick={() => { setCustom({ start:'', end:'' }); setDateFilter('Last 30 Days'); }} style={{ padding: 3, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>✕</button>
                        </div>
                      )}
                      <div style={{ flex: 1 }} />
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <Search style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: '#94A3B8' }} />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search serial…"
                          style={{ paddingLeft: 27, paddingRight: 10, paddingTop: 6, paddingBottom: 6, fontSize: 12, border: '1px solid #E2E8F0', borderRadius: 8, outline: 'none', width: 180, background: '#fff', color: '#334155' }} />
                      </div>
                      <div style={{ position: 'relative' }} ref={filterRef}>
                        <button onClick={() => setShowFP(v => !v)}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: `1px solid ${hasFilters ? '#334E68' : '#E2E8F0'}`, background: hasFilters ? '#334E68' : '#fff', color: hasFilters ? '#fff' : '#475569', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                          <Filter style={{ width: 11, height: 11 }} /> Locations
                          {hasFilters && <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 20, fontSize: 10, padding: '1px 5px' }}>{fromLoc.length + toLoc.length}</span>}
                        </button>
                        <AnimatePresence>
                          {showFP && (
                            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                              style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 20, width: 240, padding: 14 }}>
                              {[{ lbl: 'From', list: fromLoc, set: setFromLoc, opts: allFrom }, { lbl: 'To', list: toLoc, set: setToLoc, opts: allTo }].map((g, gi) => (
                                <div key={g.lbl} style={{ marginBottom: gi === 0 ? 12 : 0 }}>
                                  <p style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{g.lbl} location</p>
                                  {g.opts.map(loc => (
                                    <label key={loc} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 6px', borderRadius: 6, cursor: 'pointer' }}>
                                      <input type="checkbox" checked={g.list.includes(loc)} onChange={() => toggleLoc(g.list, g.set, loc)} style={{ accentColor: '#334E68' }} />
                                      <span style={{ fontSize: 12, color: '#475569' }}>{loc}</span>
                                    </label>
                                  ))}
                                  {gi === 0 && <div style={{ height: 1, background: '#F1F5F9', margin: '10px 0' }} />}
                                </div>
                              ))}
                              {hasFilters && <button onClick={() => { setFromLoc([]); setToLoc([]); }} style={{ width: '100%', marginTop: 8, padding: '5px', borderRadius: 6, border: 'none', background: '#FEF2F2', color: '#EF4444', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>Clear location filters</button>}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <button onClick={fetchReqs} disabled={loading}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', color: '#475569', fontSize: 11, fontWeight: 500, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
                        {loading ? <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" /> : <RefreshCw style={{ width: 11, height: 11 }} />} Refresh
                      </button>
                    </div>

                    {/* Dynamic stat cards */}
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFC', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                      {activeWorkflow.nodes.map(node => {
                        const col = COLOR_MAP[node.color];
                        const count = statCounts[node.label] ?? 0;
                        const isActive = activeSF.some(s => s.toLowerCase() === node.label.toLowerCase());
                        return (
                          <button key={node.id}
                            onClick={() => setActiveSF(prev => prev.some(s => s.toLowerCase() === node.label.toLowerCase()) ? prev.filter(s => s.toLowerCase() !== node.label.toLowerCase()) : [...prev, node.label])}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
                              border: isActive ? `1.5px solid ${col.border}` : '1px solid #E2E8F0', background: isActive ? col.bg : '#fff' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                              <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, color: col.text }}>{count}</span>
                              <span style={{ fontSize: 10, fontWeight: 500, marginTop: 1, color: col.dot }}>{node.label}</span>
                            </div>
                            <div style={{ width: 1, height: 24, background: '#E2E8F0' }} />
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.dot }} />
                          </button>
                        );
                      })}
                      <div style={{ flex: 1 }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {(search || hasFilters || dateFilter !== 'Last 30 Days' || activeSF.length > 0) && (
                          <button onClick={clearAll} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid #fecaca', background: '#fff', color: '#ef4444', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                            <Trash2 style={{ width: 10, height: 10 }} /> Clear filters
                          </button>
                        )}
                        <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
                        <button onClick={() => setShowClear(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          <Trash2 style={{ width: 10, height: 10 }} /> Clear history
                        </button>
                      </div>
                    </div>

                    {/* Table */}
                    <div style={{ flex: 1, overflow: 'auto' }}>
                      <table className="w-full">
                        <thead>
                          <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                            {[{ icon: <QrCode className="w-3.5 h-3.5" />, label: 'Request ID' },{ icon: <QrCode className="w-3.5 h-3.5" />, label: 'Serial Number' },{ icon: <MapPin className="w-3.5 h-3.5" />, label: 'From' },{ icon: <ArrowRight className="w-3.5 h-3.5" />, label: 'To' },{ icon: <User className="w-3.5 h-3.5" />, label: 'Requested By & At' },{ icon: <Shield className="w-3.5 h-3.5" />, label: 'Reviewed By & At' },{ icon: <FileText className="w-3.5 h-3.5" />, label: 'Status' },{ icon: <AlertCircle className="w-3.5 h-3.5" />, label: 'Notes' }].map(col => (
                              <th key={col.label} className="px-4 py-3 text-left"><div className="flex items-center gap-1.5"><span className="text-[#94A3B8]">{col.icon}</span><span className="text-xs font-bold text-[#334155] uppercase tracking-wide">{col.label}</span></div></th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {loading ? (
                            <tr><td colSpan={8} className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin text-[#334E68] mx-auto mb-2" /><p className="text-sm text-[#64748B]">Loading…</p></td></tr>
                          ) : filtered.length === 0 ? (
                            <tr><td colSpan={8} className="p-10 text-center"><FileText className="w-10 h-10 mx-auto mb-3 text-[#CBD5E1]" /><p className="text-sm font-semibold text-[#64748B]">No transfer requests found</p></td></tr>
                          ) : filtered.map((req, i) => (
                            <tr key={req.id} className={`border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFC]'}`}>
                              <td className="px-4 py-3 text-xs font-mono font-bold text-[#334155]">#{req.id}</td>
                              <td className="px-4 py-3 text-xs font-semibold text-[#334155]">{req.ecu_serial || `ECU #${req.ecu}`}</td>
                              <td className="px-4 py-3"><span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-semibold">{req.old_location || '—'}</span></td>
                              <td className="px-4 py-3"><span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-md text-xs font-semibold">{req.requested_to_location}</span></td>
                              <td className="px-4 py-3"><div className="flex flex-col gap-0.5"><span className="text-xs font-semibold text-[#334155]">{req.requested_by_name || '—'}</span>{req.created_at && <span className="text-[11px] text-[#94A3B8]">{fmt(req.created_at)}</span>}</div></td>
                              <td className="px-4 py-3">{req.reviewed_at ? <div className="flex flex-col gap-0.5"><span className="text-xs font-semibold text-[#334155]">{req.reviewed_by_name || '—'}</span><span className="text-[11px] text-[#94A3B8]">{fmt(req.reviewed_at)}</span></div> : <span className="text-[#CBD5E1] text-xs">—</span>}</td>
                              <td className="px-4 py-3">
                                <StatusBadge status={req.status} workflow={activeWorkflow}
                                  onClick={() => isClickable(req.status)
                                    ? setReviewState({ request: req, step: 'choose', chosenTransition: null, fieldValues: {} })
                                    : undefined} />
                              </td>
                              <td className="px-4 py-3 text-xs text-[#64748B]" style={{ maxWidth: 160 }}>
                                {req.review_notes ? <span className="line-clamp-2">{req.review_notes}</span> : <span className="text-[#CBD5E1]">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

                {/* ── WORKFLOWS VIEW ── */}
                {view === 'workflows' && (
                  <motion.div key="workflows" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', height: '100%' }}>
                    {editingWorkflow
                      ? <WorkflowCanvasEditor workflow={editingWorkflow} isActive={editingWorkflow.id === activeWfId}
                          onActivate={() => { setActiveWfId(editingWorkflow.id); saveActiveWfId(editingWorkflow.id); }}
                          onSave={saveWorkflow} onBack={() => setEditingWfId(null)} />
                      : <WorkflowListView workflows={workflows} activeId={activeWfId}
                          onEdit={setEditingWfId} onCreate={createWorkflow}
                          onActivate={(id) => { setActiveWfId(id); setView('requests'); }}
                          onDelete={deleteWorkflow} />
                    }
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Dynamic review modal */}
          <AnimatePresence>
            {reviewState && (
              <DynamicReviewModal
                state={reviewState} workflow={activeWorkflow}
                onClose={() => setReviewState(null)}
                onSubmit={handleTransitionSubmit}
                isProcessing={isProcessing}
                onUpdateState={patch => setReviewState(prev => prev ? { ...prev, ...patch } : prev)} />
            )}
          </AnimatePresence>

          {/* Confirm arrival */}
          <AnimatePresence>
            {confirmReq && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 z-[60]" />
                <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.18 }}
                  className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-[14px] z-[70] w-full max-w-sm overflow-hidden" style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.22)' }}>
                  <div className="px-5 py-4" style={{ background: 'linear-gradient(135deg, #1e40af, #2563EB)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5"><PackageCheck className="w-4 h-4 text-white" /><h3 className="text-sm font-bold text-white">Confirm Arrival</h3></div>
                      <button onClick={() => setConfirmReq(null)} className="p-1 hover:bg-white/20 rounded-lg"><X className="w-4 h-4 text-white" /></button>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-start gap-3 bg-blue-50 rounded-xl p-4 border border-blue-100">
                      <PackageCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-[#1e3a5f] leading-relaxed">Confirm arrival of ECU <strong>{confirmReq.ecu_serial}</strong> at <strong className="text-[#2563EB]">{confirmReq.requested_to_location}</strong>?
                        <span className="text-xs text-[#64748B] mt-1 block">This will update the ECU's location.</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-5 py-3.5 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                    <button onClick={() => setConfirmReq(null)} disabled={isConfirming} className="flex-1 px-4 py-2.5 border-2 border-[#E2E8F0] text-[#475569] rounded-xl font-bold text-sm hover:bg-white transition-all disabled:opacity-50">No, not yet</button>
                    <button onClick={handleConfirmArrival} disabled={isConfirming} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-xl font-bold text-sm disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #1e40af, #2563EB)' }}>
                      {isConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Yes, Confirm
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Clear history */}
          <AnimatePresence>
            {showClear && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 z-[60]" />
                <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.18 }}
                  className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-[14px] z-[70] w-full max-w-sm overflow-hidden" style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.22)' }}>
                  <div className="px-5 py-4 bg-gradient-to-r from-red-500 to-red-600">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5"><Trash2 className="w-4 h-4 text-white" /><h3 className="text-sm font-bold text-white">Clear All History</h3></div>
                      <button onClick={() => setShowClear(false)} className="p-1 hover:bg-white/20 rounded-lg"><X className="w-4 h-4 text-white" /></button>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="bg-red-50 rounded-xl p-4 border border-red-100 text-sm text-red-800 leading-relaxed">
                      This will hide all <strong>{requests.length}</strong> request{requests.length !== 1 ? 's' : ''} from this view.
                      <span className="text-xs text-red-500 mt-1 block">Data remains in the database.</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-5 py-3.5 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                    <button onClick={() => setShowClear(false)} className="flex-1 px-4 py-2.5 border-2 border-[#E2E8F0] text-[#475569] rounded-xl font-bold text-sm hover:bg-white transition-all">Cancel</button>
                    <button onClick={() => { addClearedIds(requests.map(r => r.id)); setRequests([]); setShowClear(false); }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-bold text-sm">
                      <Trash2 className="w-4 h-4" /> Clear History
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
