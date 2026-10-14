import { X, Edit3, Loader2, Hash, ToggleLeft, FileText, Layers, MapPin, Activity, Plug, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getSubCategories, getCategories, getTestBenches, updateECU } from '../services/api';

// ── Portal-based custom dropdown — renders at document root, never clipped ──
interface DropdownProps {
  value: string;
  options: string[];
  onChange: (val: string) => void;
  placeholder?: string;
}

function CustomSelect({ value, options, onChange, placeholder = 'Select...' }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropH = Math.min(options.length * 40, 240);
    const openAbove = spaceBelow < dropH + 8 && rect.top > spaceBelow;

    setDropStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      zIndex: 99999,
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  };

  useEffect(() => {
    if (open) updatePosition();
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        dropRef.current && !dropRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const dropdown = open && options.length > 0
    ? (
      <div
        ref={dropRef}
        style={dropStyle}
        className="bg-white border border-[#E2E8F0] rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="max-h-60 overflow-y-auto">
          {options.map(opt => (
            <button
              key={opt ?? '__none__'}
              type="button"
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between transition-colors hover:bg-[#F1F5F9] ${
                value === opt ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold' : 'text-[#334155]'
              }`}
            >
              {opt || <span className="text-[#94A3B8]">{placeholder}</span>}
              {value === opt && opt !== '' && <Check className="w-3.5 h-3.5 text-[#2563EB] flex-shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    )
    : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 text-sm text-[#334155] transition-all flex items-center justify-between cursor-pointer"
      >
        <span className={value ? 'text-[#334155]' : 'text-[#94A3B8]'}>{value || placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-[#94A3B8] transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────
interface EditECUModalProps {
  isOpen: boolean;
  onClose: () => void;
  ecuData: {
    id: string | number;
    inventory_number?: string;
    serial_number: string;
    category: number | string;
    sub_category: string;
    status: string;
    location: string;
    connection: number | null;
    connection_name?: string;
    health_status: string;
    power_volts?: string;
    power_amps?: string;
    description?: string;
    project?: string;
  } | null;
  extraSubcategories?: string[];
  onSuccess?: () => void;
}

export function EditECUModal({ isOpen, onClose, ecuData, extraSubcategories = [], onSuccess }: EditECUModalProps) {
  const [inventoryNumber, setInventoryNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [status, setStatus] = useState('active');
  const [description, setDescription] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [location, setLocation] = useState('');
  const [healthStatus, setHealthStatus] = useState('working');
  const [connection, setConnection] = useState<number | string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDefectModalOpen, setIsDefectModalOpen] = useState(false);
  const [defectReason, setDefectReason] = useState('');
  const [hopeTicketId, setHopeTicketId] = useState('');
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);
  const [connections, setConnections] = useState<Array<{ id: number; name: string }>>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseSubcategories = [
    'ANTENNA', 'FBD5', 'SZT', 'REAR WIPER', 'STEERING WHEEL', 'TAGE',
    'WARNING LIGHT BUTTON', 'DOOR LOCK', 'INTERIOR MIRROR', 'RLS',
    'START/STOP BUTTON', 'EXM', 'HEADLIGHT', 'WINDOW LOCAL BUTTON',
    'HEIGHT SENSOR', 'MFL', 'SZL', 'INTERIOR LIGHT', 'INTERIOR LIGHT REAR',
    'BOOTLIT', 'WCA', 'BEL', 'ZBE', 'TAT', 'RADIO BUTTONS', 'HEAD UNIT',
    'AUC SENSOR', 'ELSV BUTTON', 'ELSV MECHANICAL',
  ];

  const locations = ['SFAX', 'GAR'];

  useEffect(() => {
    const fetchCategoryId = async () => {
      if (!ecuData?.category) return;
      try {
        const res = await getCategories();
        const categories = res.data.results ?? res.data;
        const categoryIdNum =
          typeof ecuData.category === 'number'
            ? ecuData.category
            : categories.find((c: any) => c.name.toLowerCase() === String(ecuData.category).toLowerCase())?.id;
        if (categoryIdNum) setCategoryId(categoryIdNum);
      } catch (error) { console.error('Failed to fetch category ID:', error); }
    };
    fetchCategoryId();
  }, [ecuData?.category]);

  useEffect(() => {
    const fetchSubcategories = async () => {
      if (!categoryId) return;
      setLoadingSubcategories(true);
      try {
        const params: Record<string, any> = { category: categoryId };
        if (ecuData?.project) params.project = ecuData.project;
        const res = await getSubCategories(params);
        const data = res.data.results ?? res.data;
        const dbNames = data.map((sub: any) => sub.name.toUpperCase());
        const allSubcategories = [...new Set([...baseSubcategories, ...dbNames, ...extraSubcategories.map(s => s.toUpperCase())])];
        allSubcategories.sort();
        setSubcategories(allSubcategories);
      } catch {
        const all = [...new Set([...baseSubcategories, ...extraSubcategories.map(s => s.toUpperCase())])];
        all.sort();
        setSubcategories(all);
      } finally { setLoadingSubcategories(false); }
    };
    fetchSubcategories();
  }, [categoryId, ecuData?.project, extraSubcategories]);

  useEffect(() => {
    const fetchTestBenches = async () => {
      setLoadingConnections(true);
      try {
        const res = await getTestBenches();
        const rows = res.data.results ?? res.data;
        const benches = rows
          .filter((t: any) => !ecuData?.project || t.project === ecuData.project)
          .map((t: any) => ({ id: t.id, name: t.name }))
          .filter((b: any) => b.name);
        if (benches.length) setConnections(benches);
      } catch (error) { console.error('Failed to fetch testbenches:', error); }
      finally { setLoadingConnections(false); }
    };
    fetchTestBenches();
  }, [ecuData?.project]);

  useEffect(() => {
    if (ecuData) {
      setInventoryNumber(ecuData.inventory_number ?? '');
      setSerialNumber(ecuData.serial_number ?? '');
      setStatus(ecuData.status || 'active');
      setDescription(ecuData.description ?? '');
      setSubCategory(ecuData.sub_category?.toUpperCase() ?? '');
      setLocation(ecuData.location ?? '');
      setHealthStatus(ecuData.health_status ?? 'working');
      setError(null);
      if (ecuData.connection && typeof ecuData.connection === 'number') {
        setConnection(ecuData.connection);
      } else if (ecuData.connection_name) {
        const matchingBench = connections.find(b => b.name === ecuData.connection_name);
        setConnection(matchingBench ? matchingBench.id : '');
      } else {
        setConnection('');
      }
    }
  }, [ecuData]);

  useEffect(() => {
    if (ecuData?.connection_name && connections.length > 0 && !ecuData.connection) {
      const matchingBench = connections.find(b => b.name === ecuData.connection_name);
      if (matchingBench) setConnection(matchingBench.id);
    }
  }, [connections, ecuData]);

  const handleHealthStatusChange = (value: string) => {
    setHealthStatus(value);
    if (value === 'defect') setIsDefectModalOpen(true);
  };

  const handleDefectModalClose = () => {
    setIsDefectModalOpen(false);
    setDefectReason('');
    setHopeTicketId('');
  };

  const handleDefectModalSubmit = async () => {
    if (!defectReason.trim() || !hopeTicketId.trim()) {
      alert('Please fill in both Defect Reason and Hope Ticket ID');
      return;
    }
    setIsSubmitting(true);
    try {
      if (ecuData?.id) {
        await updateECU(ecuData.id, {
          defect_reason: defectReason,
          defect_ticket_id: hopeTicketId,
          defect_reported_date: new Date().toISOString(),
          health_status: 'defect',
        });
      }
      setIsDefectModalOpen(false);
      alert('Defect information saved successfully!');
      if (onSuccess) onSuccess();
    } catch {
      alert('Failed to save defect information');
    } finally { setIsSubmitting(false); }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!serialNumber.trim()) { setError('Serial Number is required'); return; }
    setIsSubmitting(true);
    const updateData: Record<string, any> = {
      inventory_number: inventoryNumber.trim() || null,
      serial_number: serialNumber.trim(),
      status,
      description: description.trim() || null,
      sub_category: subCategory,
      location,
      health_status: healthStatus,
      connection: typeof connection === 'number' ? connection : null,
    };
    console.log('📤 Sending update data:', JSON.stringify(updateData, null, 2));
    try {
      if (!ecuData?.id) throw new Error('ECU ID is missing');
      const response = await updateECU(ecuData.id, updateData);
      console.log('✅ Update response:', response.data);
      alert(`ECU ${ecuData.id} updated successfully!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      if (error.response?.data) {
        setError(`Failed to update: ${Object.values(error.response.data).flat().join(', ')}`);
      } else {
        setError(`Failed to update: ${error.message ?? 'Unknown error'}`);
      }
    } finally { setIsSubmitting(false); }
  };

  if (!ecuData) return null;

  const connectionOptions = connections.map(c => c.name);
  const connectionName = connections.find(c => c.id === connection)?.name ?? '';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.18)' }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl z-50 w-full max-w-2xl overflow-visible"
          >
            {/* Header */}
            <div className="px-6 py-4 rounded-t-2xl" style={{ background: 'linear-gradient(135deg, #334E68, #243B53)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Edit3 className="w-5 h-5 text-white" />
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-wide">Edit ECU</h2>
                    <p className="text-xs text-white/70">ECU ID: {ecuData.id}</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
              )}

              <div className="grid grid-cols-2 gap-5">
                {/* Inventory Number - NEW FIELD */}
                <div>
                  <label className="flex items-center gap-2 mb-2.5">
                    <Hash className="w-4 h-4 text-[#64748B]" />
                    <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">
                      INV.NUM <span className="text-gray-400 text-[10px] font-normal">(Inventory Number)</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    value={inventoryNumber}
                    onChange={(e) => setInventoryNumber(e.target.value)}
                    placeholder="Enter Inventory Number"
                    className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 text-sm text-[#334155] transition-all"
                  />
                </div>

                {/* Serial Number */}
                <div>
                  <label className="flex items-center gap-2 mb-2.5">
                    <Hash className="w-4 h-4 text-[#64748B]" />
                    <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">
                      Serial Number <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={e => setSerialNumber(e.target.value)}
                    placeholder="Enter serial number"
                    className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 text-sm text-[#334155] transition-all"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="flex items-center gap-2 mb-2.5">
                    <ToggleLeft className="w-4 h-4 text-[#64748B]" />
                    <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">
                      Status <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <CustomSelect value={status === 'active' ? 'Active' : 'Not Active'} options={['Active', 'Not Active']} onChange={val => setStatus(val === 'Active' ? 'active' : 'not-active')} />
                </div>

                {/* Description */}
                <div className="col-span-2">
                  <label className="flex items-center gap-2 mb-2.5">
                    <FileText className="w-4 h-4 text-[#64748B]" />
                    <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Description</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Enter description"
                    rows={3}
                    className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 text-sm text-[#334155] transition-all resize-y"
                  />
                </div>

                {/* Sub-Category */}
                <div>
                  <label className="flex items-center gap-2 mb-2.5">
                    <Layers className="w-4 h-4 text-[#64748B]" />
                    <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Sub-Category</span>
                  </label>
                  {loadingSubcategories ? (
                    <div className="flex items-center justify-center py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                      <Loader2 className="w-4 h-4 animate-spin text-[#557486]" />
                    </div>
                  ) : (
                    <CustomSelect value={subCategory} options={subcategories} onChange={setSubCategory} placeholder="Select Sub-Category" />
                  )}
                </div>

                {/* Health Status */}
                <div>
                  <label className="flex items-center gap-2 mb-2.5">
                    <Activity className="w-4 h-4 text-[#64748B]" />
                    <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Health Status</span>
                  </label>
                  <CustomSelect
                    value={healthStatus.charAt(0).toUpperCase() + healthStatus.slice(1)}
                    options={['Working', 'Defect', 'Recovered']}
                    onChange={val => handleHealthStatusChange(val.toLowerCase())}
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="flex items-center gap-2 mb-2.5">
                    <MapPin className="w-4 h-4 text-[#64748B]" />
                    <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Location</span>
                  </label>
                  <CustomSelect value={location} options={locations} onChange={setLocation} />
                </div>

                {/* Connection */}
                <div>
                  <label className="flex items-center gap-2 mb-2.5">
                    <Plug className="w-4 h-4 text-[#64748B]" />
                    <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Connection (Test Bench)</span>
                  </label>
                  {loadingConnections ? (
                    <div className="flex items-center justify-center py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                      <Loader2 className="w-4 h-4 animate-spin text-[#557486]" />
                    </div>
                  ) : (
                    <CustomSelect
                      value={connectionName}
                      options={['', ...connectionOptions]}
                      onChange={val => {
                        if (!val) { setConnection(''); }
                        else {
                          const bench = connections.find(c => c.name === val);
                          setConnection(bench ? bench.id : '');
                        }
                      }}
                      placeholder="No Connection"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[#F8FAFC] border-t border-[#E2E8F0] rounded-b-2xl">
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 border-2 border-[#CBD5E1] text-[#475569] rounded-xl font-semibold text-sm hover:bg-white hover:border-[#94A3B8] transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)' }}
                className="px-6 py-2.5 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center gap-2 min-w-[140px] justify-center"
              >
                {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Saving...</span></> : <span>Save Changes</span>}
              </button>
            </div>
          </motion.div>

          {/* Defect Modal */}
          <AnimatePresence>
            {isDefectModalOpen && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 z-[60]" />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.18)' }}
                  className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl z-[70] w-full max-w-md overflow-hidden"
                >
                  <div className="px-6 py-4 rounded-t-2xl" style={{ background: 'linear-gradient(135deg, #334E68, #243B53)' }}>
                    <h3 className="text-lg font-bold text-white tracking-wide">Defect Details</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="flex items-center gap-2 mb-2.5">
                        <FileText className="w-4 h-4 text-[#64748B]" />
                        <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">
                          Defect Reason <span className="text-red-500">*</span>
                        </span>
                      </label>
                      <input
                        type="text"
                        value={defectReason}
                        onChange={e => setDefectReason(e.target.value)}
                        placeholder="Enter defect reason"
                        className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 text-sm text-[#334155] transition-all"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 mb-2.5">
                        <Hash className="w-4 h-4 text-[#64748B]" />
                        <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">
                          Hope Ticket ID <span className="text-red-500">*</span>
                        </span>
                      </label>
                      <input
                        type="text"
                        value={hopeTicketId}
                        onChange={e => setHopeTicketId(e.target.value)}
                        placeholder="Enter ticket ID"
                        className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 text-sm text-[#334155] transition-all"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                    <button
                      onClick={handleDefectModalClose}
                      disabled={isSubmitting}
                      className="px-5 py-2.5 border-2 border-[#CBD5E1] text-[#475569] rounded-xl font-semibold text-sm hover:bg-white hover:border-[#94A3B8] transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDefectModalSubmit}
                      disabled={isSubmitting}
                      style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)' }}
                      className="px-6 py-2.5 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Saving...</> : 'Save'}
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