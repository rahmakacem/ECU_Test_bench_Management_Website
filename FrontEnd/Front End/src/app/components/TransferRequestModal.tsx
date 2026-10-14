import { X, Loader2, MapPin, ArrowRightLeft, CheckCircle, Plus, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { getLocations, createLocation } from '../services/api';

interface SelectedECU { id: string; serialNumber: string; location: string; }
interface TransferRequestModalProps {
  isOpen: boolean; onClose: () => void;
  selectedSerials?: string[]; selectedECUs?: SelectedECU[];
  onSubmit?: (serials: string[], toLocation: string, ecus: SelectedECU[]) => Promise<void> | void;
}

export function TransferRequestModal({ isOpen, onClose, selectedSerials = [], selectedECUs = [], onSubmit }: TransferRequestModalProps) {
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locations, setLocations] = useState<string[]>(['SFAX', 'GARCHING', 'GAR', 'ALGAU', 'LEO']);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [locationError, setLocationError] = useState(false);

  const fetchLocations = async (keep = false) => {
    setLoadingLocations(true);
    try {
      const res = await getLocations();
      const data = res.data;
      const raw = Array.isArray(data) ? data : data.results || [];
      const names: string[] = raw.map((l: any) => l.name || l.location_name || l.city || l.label || (typeof l === 'string' ? l : '')).filter(Boolean);
      const unique = [...new Set(names)];
      if (unique.length > 0) { setLocations(unique); if (!keep) setLocation(''); }
      else { setLocations(['SFAX', 'GARCHING', 'GAR', 'ALGAU', 'LEO']); if (!keep) setLocation(''); }
    } catch { setLocationError(true); setLocations(['SFAX', 'GARCHING', 'GAR', 'ALGAU', 'LEO']); if (!keep) setLocation(''); }
    finally { setLoadingLocations(false); }
  };

  useEffect(() => { if (isOpen) { setLocation(''); setShowAddLocation(false); setNewLocationName(''); setLocationError(false); fetchLocations(false); } }, [isOpen]);

  const handleAddLocation = async () => {
    if (!newLocationName.trim()) return;
    setIsAddingLocation(true);
    try {
      const name = newLocationName.trim().toUpperCase();
      await createLocation({ name });
      await fetchLocations(true);
      setLocation(name); setShowAddLocation(false); setNewLocationName('');
    } catch (e: any) { alert(e.response?.data?.name?.[0] || 'Failed to add location. It may already exist.'); }
    finally { setIsAddingLocation(false); }
  };

  const ecuCount = selectedSerials.length;
  const isBulk = ecuCount > 1;

  const handleSubmit = async () => {
    if (!location || ecuCount === 0) return;
    setIsSubmitting(true);
    try { await onSubmit?.(selectedSerials, location, selectedECUs); onClose(); }
    finally { setIsSubmitting(false); }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            onClick={onClose} className="fixed inset-0 z-50" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)' }} />

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed', inset: 0, zIndex: 51,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '24px', boxSizing: 'border-box',
            }}
          >
            <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 24px 64px rgba(15,23,42,0.18)', border: '1px solid rgba(226,232,240,0.8)', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 480, maxHeight: '92vh', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: '#f0f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ArrowRightLeft style={{ width: 18, height: 18, color: '#3b5bdb' }} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
                      {isBulk ? 'Bulk Transfer Request' : 'Transfer Request'}
                    </h2>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>
                      {isBulk ? `${ecuCount} ECUs selected` : '1 ECU selected'}
                    </p>
                  </div>
                </div>
                <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', flexShrink: 0 }}>
                  <X style={{ width: 15, height: 15 }} />
                </button>
              </div>

              {/* Body — scrollable */}
              <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto', flex: 1 }}>
                {/* ECU serials */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>ECU Serial{isBulk ? 's' : ''}</label>
                    <span style={{ fontSize: 10, fontWeight: 500, color: '#3b5bdb', background: '#eef2ff', padding: '2px 7px', borderRadius: 20 }}>{ecuCount} unit{ecuCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: ecuCount === 0 ? '12px 14px' : '8px 10px', border: '1px solid #f1f5f9', minHeight: 44, display: 'flex', alignItems: 'center' }}>
                    {ecuCount === 0
                      ? <span style={{ fontSize: 12, color: '#cbd5e1' }}>No ECUs selected</span>
                      : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {selectedSerials.map(s => (
                            <span key={s} style={{ fontSize: 11, fontWeight: 600, color: '#1e3a8a', background: '#dbeafe', padding: '3px 9px', borderRadius: 5, fontFamily: 'monospace' }}>{s}</span>
                          ))}
                        </div>
                    }
                  </div>
                  <p style={{ fontSize: 10, color: '#cbd5e1', marginTop: 5, marginBottom: 0 }}>One request per ECU will be created</p>
                </div>

                {/* Destination */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Destination</label>
                    {!showAddLocation && (
                      <button onClick={() => setShowAddLocation(true)} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 500, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 5px', borderRadius: 5 }}>
                        <Plus style={{ width: 11, height: 11 }} /> Add location
                      </button>
                    )}
                  </div>

                  {locationError && (
                    <div style={{ marginBottom: 8, padding: '7px 11px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 7, fontSize: 11, color: '#92400e' }}>
                      Could not load locations — showing defaults
                    </div>
                  )}

                  <AnimatePresence>
                    {showAddLocation && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }} style={{ overflow: 'hidden', marginBottom: 8 }}>
                        <div style={{ background: '#f8fafc', borderRadius: 9, padding: 10, border: '1px solid #e2e8f0', display: 'flex', gap: 7 }}>
                          <input type="text" value={newLocationName} onChange={e => setNewLocationName(e.target.value.toUpperCase())} placeholder="e.g. MUNICH" autoFocus
                            style={{ flex: 1, padding: '7px 11px', fontSize: 12, fontWeight: 500, border: '1px solid #e2e8f0', borderRadius: 7, outline: 'none', background: '#fff', color: '#0f172a', fontFamily: 'monospace' }} />
                          <button onClick={handleAddLocation} disabled={isAddingLocation || !newLocationName.trim()}
                            style={{ padding: '7px 13px', background: '#3b5bdb', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: isAddingLocation || !newLocationName.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 5 }}>
                            {isAddingLocation ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : 'Add'}
                          </button>
                          <button onClick={() => { setShowAddLocation(false); setNewLocationName(''); }} style={{ padding: '7px 9px', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, color: '#64748b', cursor: 'pointer' }}>✕</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {loadingLocations
                    ? <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 0' }}><Loader2 style={{ width: 18, height: 18, color: '#94a3b8' }} className="animate-spin" /></div>
                    : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7 }}>
                        {locations.map(loc => {
                          const isSel = location === loc;
                          return (
                            <button key={loc} type="button" onClick={() => setLocation(isSel ? '' : loc)}
                              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 11px', borderRadius: 9, border: isSel ? '1.5px solid #3b5bdb' : '1px solid #e2e8f0', background: isSel ? '#eef2ff' : '#fff', color: isSel ? '#3b5bdb' : '#475569', cursor: 'pointer', transition: 'all 0.13s', fontWeight: isSel ? 600 : 500, fontSize: 11, letterSpacing: '0.03em', boxShadow: isSel ? '0 0 0 3px rgba(59,91,219,0.08)' : 'none' }}>
                              <MapPin style={{ width: 12, height: 12, flexShrink: 0, color: isSel ? '#3b5bdb' : '#94a3b8' }} />
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc}</span>
                              {isSel && <CheckCircle style={{ width: 12, height: 12, flexShrink: 0, color: '#3b5bdb', marginLeft: 'auto' }} />}
                            </button>
                          );
                        })}
                      </div>
                  }
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderTop: '1px solid #f1f5f9', background: '#fafafa', gap: 10, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                  {location
                    ? <><div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} /><span style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Sending to <strong style={{ color: '#0f172a' }}>{location}</strong></span></>
                    : <span style={{ fontSize: 11, color: '#cbd5e1' }}>Select a destination</span>
                  }
                </div>
                <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                  <button onClick={onClose} disabled={isSubmitting} style={{ padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 9, background: '#fff', color: '#475569', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: isSubmitting ? 0.5 : 1 }}>Cancel</button>
                  <button onClick={handleSubmit} disabled={!location || ecuCount === 0 || isSubmitting}
                    style={{ padding: '8px 16px', borderRadius: 9, border: 'none', background: !location || ecuCount === 0 || isSubmitting ? '#e2e8f0' : '#3b5bdb', color: !location || ecuCount === 0 || isSubmitting ? '#94a3b8' : '#fff', fontSize: 12, fontWeight: 600, cursor: !location || ecuCount === 0 || isSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'background 0.15s' }}>
                    {isSubmitting ? <><Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> Submitting…</>
                      : <>{isBulk ? `Submit ${ecuCount} Requests` : 'Submit Request'}{location && ecuCount > 0 && <ChevronRight style={{ width: 12, height: 12 }} />}</>}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
