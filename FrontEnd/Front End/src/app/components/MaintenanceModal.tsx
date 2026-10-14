// MaintenanceModal.tsx
import { useState, useEffect } from 'react';
import { X, Calendar, AlertTriangle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  testBench: any;
  onSave: (start: Date, end: Date, reason: string) => Promise<void>;
}

export function MaintenanceModal({ isOpen, onClose, testBench, onSave }: MaintenanceModalProps) {
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ date?: string }>({});

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (isOpen) {
      setStartDate(today);
      setStartTime('');
      setEndDate(today);
      setEndTime('');
      setReason('');
      setErrors({});
    }
  }, [isOpen]);

  const getTimeOptions = (selectedDate: string) => {
    const now = new Date();
    const isToday = selectedDate === today;
    const options: { value: string; display: string }[] = [];
    for (let hour = 8; hour <= 18; hour++) {
      for (const minute of [0, 30]) {
        if (hour === 18 && minute === 30) continue;
        if (isToday) {
          const slot = new Date();
          slot.setHours(hour, minute, 0, 0);
          if (slot <= now) continue;
        }
        const value = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const display = new Date(`2000-01-01T${value}`).toLocaleTimeString([], {
          hour: '2-digit', minute: '2-digit', hour12: true,
        });
        options.push({ value, display });
      }
    }
    return options;
  };

  const startTimeOptions = getTimeOptions(startDate);
  const endTimeOptions = getTimeOptions(endDate);

  const validateRange = (): boolean => {
    if (!startDate || !startTime || !endDate || !endTime) {
      setErrors({ date: 'Please select both start and end date/time' });
      return false;
    }
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);
    if (start >= end) {
      setErrors({ date: 'End time must be after start time' });
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async () => {
    if (!validateRange()) return;
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);
    setIsSubmitting(true);
    try {
      await onSave(start, end, reason);
      onClose();
    } catch {
      setErrors({ date: 'Failed to schedule maintenance. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const TimeGrid = ({
    options, selected, onSelect,
  }: { options: { value: string; display: string }[]; selected: string; onSelect: (v: string) => void }) => {
    if (options.length === 0) {
      return (
        <p style={{ fontSize: '11px', color: '#94A3B8', textAlign: 'center', padding: '6px 0' }}>
          No available slots — all times have passed.
        </p>
      );
    }
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
        {options.map(({ value, display }) => (
          <button
            key={value} type="button"
            onClick={() => { onSelect(value); setErrors({}); }}
            style={{
              padding: '5px 2px', borderRadius: '6px', fontSize: '11px',
              fontWeight: selected === value ? 700 : 500, cursor: 'pointer',
              border: selected === value ? '2px solid #f59e0b' : '1.5px solid #E2E8F0',
              background: selected === value ? 'linear-gradient(135deg, #fef3c7, #fde68a)' : '#F8FAFC',
              color: selected === value ? '#92400e' : '#475569',
              transition: 'all 0.12s', whiteSpace: 'nowrap',
            }}
          >{display}</button>
        ))}
      </div>
    );
  };

  const duration = startDate && startTime && endDate && endTime ? (() => {
    const diff = (new Date(`${endDate}T${endTime}`).getTime() - new Date(`${startDate}T${startTime}`).getTime()) / 60000;
    if (diff <= 0) return null;
    const h = Math.floor(diff / 60), m = diff % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  })() : null;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', border: '1.5px solid #E2E8F0',
    borderRadius: '8px', fontSize: '12px', outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            style={{ zIndex: 9998 }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col"
            style={{ zIndex: 9999, maxHeight: '90vh', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
          >
            {/* Header */}
            <div style={{
              padding: '12px 16px', flexShrink: 0,
              background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
              borderRadius: '16px 16px 0 0',
            }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Schedule Maintenance</h2>
                    <p className="text-xs text-white/80">{testBench?.name}</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div style={{ padding: '12px 16px', overflowY: 'auto', flex: 1 }}>

              {/* Info strip */}
              <div style={{
                background: '#FFF7ED', borderRadius: '8px', padding: '6px 10px',
                marginBottom: '10px', border: '1px solid #FED7AA',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <Calendar className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
                <p className="text-xs text-orange-700">Bench unavailable for bookings during this period</p>
              </div>

              {/* Start */}
              <div style={{ marginBottom: '10px' }}>
                <label style={labelStyle}>Start <span style={{ color: '#EF4444' }}>*</span></label>
                <div className="grid grid-cols-2 gap-2" style={{ marginBottom: '5px' }}>
                  <input
                    type="date" value={startDate} min={today} style={inputStyle}
                    onChange={(e) => {
                      const d = e.target.value; setStartDate(d); setErrors({});
                      if (startTime && !getTimeOptions(d).find(o => o.value === startTime)) setStartTime('');
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#f59e0b'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#E2E8F0'}
                  />
                  <div style={{
                    padding: '7px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px',
                    fontSize: '12px', color: startTime ? '#1e293b' : '#94A3B8', background: '#F8FAFC',
                  }}>
                    {startTime ? new Date(`2000-01-01T${startTime}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Pick time ↓'}
                  </div>
                </div>
                <TimeGrid options={startTimeOptions} selected={startTime} onSelect={setStartTime} />
              </div>

              {/* End */}
              <div style={{ marginBottom: '10px' }}>
                <label style={labelStyle}>End <span style={{ color: '#EF4444' }}>*</span></label>
                <div className="grid grid-cols-2 gap-2" style={{ marginBottom: '5px' }}>
                  <input
                    type="date" value={endDate} min={startDate || today} style={inputStyle}
                    onChange={(e) => {
                      const d = e.target.value; setEndDate(d); setErrors({});
                      if (endTime && !getTimeOptions(d).find(o => o.value === endTime)) setEndTime('');
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#f59e0b'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#E2E8F0'}
                  />
                  <div style={{
                    padding: '7px 10px', border: '1.5px solid #E2E8F0', borderRadius: '8px',
                    fontSize: '12px', color: endTime ? '#1e293b' : '#94A3B8', background: '#F8FAFC',
                  }}>
                    {endTime ? new Date(`2000-01-01T${endTime}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Pick time ↓'}
                  </div>
                </div>
                <TimeGrid options={endTimeOptions} selected={endTime} onSelect={setEndTime} />
              </div>

              {/* Duration */}
              {duration && !errors.date && (
                <div style={{
                  background: '#F8FAFC', borderRadius: '8px', padding: '5px 10px',
                  marginBottom: '8px', border: '1px solid #E2E8F0',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>Duration</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b' }}>{duration}</span>
                </div>
              )}

              {/* Error */}
              {errors.date && (
                <div style={{
                  background: '#FEF2F2', borderRadius: '8px', padding: '6px 10px',
                  marginBottom: '8px', border: '1px solid #FECACA',
                }}>
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle style={{ width: '11px', height: '11px' }} /> {errors.date}
                  </p>
                </div>
              )}

              {/* Reason */}
              <div>
                <label style={labelStyle}>Reason (Optional)</label>
                <textarea
                  value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="Enter maintenance reason..." rows={2}
                  style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit' }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#f59e0b'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#E2E8F0'}
                />
              </div>
            </div>

            {/* Footer — always visible, never scrolls away */}
            <div style={{
              display: 'flex', gap: '10px', padding: '12px 16px', flexShrink: 0,
              backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0',
              borderRadius: '0 0 16px 16px',
            }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1, padding: '9px', borderRadius: '8px', fontWeight: 600,
                  fontSize: '13px', cursor: 'pointer', border: '1px solid #E2E8F0',
                  background: '#fff', color: '#64748B',
                }}
              >Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={!startDate || !startTime || !endDate || !endTime || !!errors.date || isSubmitting}
                style={{
                  flex: 1, padding: '9px', borderRadius: '8px', fontWeight: 600,
                  fontSize: '13px', border: 'none', color: '#fff',
                  cursor: (!startDate || !startTime || !endDate || !endTime || !!errors.date || isSubmitting) ? 'not-allowed' : 'pointer',
                  background: (!startDate || !startTime || !endDate || !endTime || !!errors.date || isSubmitting)
                    ? '#94A3B8' : 'linear-gradient(135deg, #f59e0b, #ea580c)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >
                {isSubmitting ? (
                  <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Scheduling...</span></>
                ) : (
                  <><Check style={{ width: '13px', height: '13px' }} /><span>Schedule Maintenance</span></>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
