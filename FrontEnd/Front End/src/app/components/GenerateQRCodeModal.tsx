import { X, QrCode, Loader2, Hash, ToggleLeft, FileText, Layers, MapPin, Activity, Plug, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { createECU, getCategories, getTestBenches, getSubCategories } from '../services/api';

// ── Portal dropdown — renders at document.body level so it's never clipped ──
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

  // Position the portal dropdown relative to the trigger button
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropH = Math.min(options.length * 40, 240);

    // Open above if not enough space below
    const openAbove = spaceBelow < dropH + 8 && spaceAbove > spaceBelow;

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

  // Close on outside click
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

  const dropdown = open && options.length > 0 ? (
    <div
      ref={dropRef}
      style={dropStyle}
      className="bg-white border border-[#E2E8F0] rounded-[10px] shadow-2xl overflow-hidden"
    >
      <div className="max-h-60 overflow-y-auto">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => { onChange(opt); setOpen(false); }}
            className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between transition-colors hover:bg-[#F1F5F9] ${
              value === opt ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold' : 'text-[#334155]'
            }`}
          >
            {opt || <span className="text-[#94A3B8]">{placeholder}</span>}
            {value === opt && <Check className="w-3.5 h-3.5 text-[#2563EB] flex-shrink-0" />}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 text-sm text-[#334155] transition-all flex items-center justify-between cursor-pointer"
      >
        <span className={value ? '' : 'text-[#94A3B8]'}>{value || placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-[#94A3B8] transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────
interface GenerateQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProject: string;
  selectedCategory: string;
  tableData: Array<{ id: string }>;
  onSuccess: (newEcu: Record<string, unknown>) => void;
  extraSubcategories?: string[];
}

function generateUniqueId(existingIds: Set<string>): string {
  let id: string;
  do {
    const ts = Date.now().toString();
    const rand = Math.floor(Math.random() * 900 + 100).toString();
    id = (ts + rand).slice(0, 13);
  } while (existingIds.has(id));
  return id;
}

export function GenerateQRCodeModal({ isOpen, onClose, selectedProject, selectedCategory, tableData, onSuccess, extraSubcategories = [] }: GenerateQRCodeModalProps) {
  const [inventoryNumber, setInventoryNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [status, setStatus] = useState('Active');
  const [description, setDescription] = useState('');
  const [subCategory, setSubCategory] = useState('ANTENNA');
  const [location, setLocation] = useState('SFAX');
  const [healthStatus, setHealthStatus] = useState('Working');
  const [connection, setConnection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDefectModalOpen, setIsDefectModalOpen] = useState(false);
  const [defectReason, setDefectReason] = useState('');
  const [hopeTicketId, setHopeTicketId] = useState('');
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);
  const [connections, setConnections] = useState<string[]>([]);

  const baseSubcategories = [
    'ANTENNA', 'FBD5', 'SZT', 'REAR WIPER', 'STEERING WHEEL', 'TAGE',
    'WARNING LIGHT BUTTON', 'DOOR LOCK', 'INTERIOR MIRROR', 'RLS',
    'START/STOP BUTTON', 'EXM', 'HEADLIGHT', 'WINDOW LOCAL BUTTON',
    'HEIGHT SENSOR', 'MFL', 'SZL', 'INTERIOR LIGHT', 'INTERIOR LIGHT REAR',
    'BOOTLIT', 'WCA', 'BEL', 'ZBE', 'TAT', 'RADIO BUTTONS', 'HEAD UNIT',
    'AUC SENSOR', 'ELSV BUTTON', 'ELSV MECHANICAL',
  ];

  const locations = ['SFAX', 'GAR'];

  // Fetch category ID
  useEffect(() => {
    const fetchCategoryId = async () => {
      if (!selectedCategory) return;
      try {
        const res = await getCategories();
        const cats = res.data.results ?? res.data;
        const cat = cats.find((c: any) => c.name.toLowerCase() === selectedCategory.toLowerCase());
        if (cat) setCategoryId(cat.id);
      } catch (e) { console.error(e); }
    };
    fetchCategoryId();
  }, [selectedCategory]);

  // Fetch subcategories
  useEffect(() => {
    const fetchSubcategories = async () => {
      if (!categoryId) {
        const all = [...new Set([...baseSubcategories, ...extraSubcategories.map(s => s.toUpperCase())])].sort();
        setSubcategories(all);
        return;
      }
      setLoadingSubcategories(true);
      try {
        const res = await getSubCategories({ category: categoryId });
        const data = res.data.results ?? res.data;
        const filtered = data.filter((sub: any) => sub.category === categoryId);
        const names = filtered.map((sub: any) => sub.name.toUpperCase());
        const all = [...new Set([...baseSubcategories, ...names, ...extraSubcategories.map(s => s.toUpperCase())])].sort();
        setSubcategories(all);
        if (!all.includes(subCategory)) setSubCategory(all[0] ?? '');
      } catch {
        const all = [...new Set([...baseSubcategories, ...extraSubcategories.map(s => s.toUpperCase())])].sort();
        setSubcategories(all);
      } finally { setLoadingSubcategories(false); }
    };
    fetchSubcategories();
  }, [categoryId, extraSubcategories]);

  useEffect(() => {
    if (subcategories.length > 0 && !subcategories.includes(subCategory)) setSubCategory(subcategories[0]);
  }, [subcategories]);

  // Fetch testbenches filtered by current project
  useEffect(() => {
    const fetchTestBenches = async () => {
      try {
        const res = await getTestBenches();
        const rows = res.data.results ?? res.data;
        // Filter benches that belong to the currently selected project
        const filtered = rows.filter((t: any) =>
          !selectedProject || String(t.project) === String(selectedProject)
        );
        const names = (filtered.length > 0 ? filtered : rows)
          .map((t: any) => t.name)
          .filter(Boolean);
        setConnections(names);
        if (names.length) setConnection(names[0]);
      } catch (e) { console.error(e); }
    };
    fetchTestBenches();
  }, [selectedProject]);

  const handleHealthStatusChange = (val: string) => {
    setHealthStatus(val);
    if (val === 'Defect') setIsDefectModalOpen(true);
  };

  const handleDefectModalClose = () => {
    setIsDefectModalOpen(false);
    setDefectReason('');
    setHopeTicketId('');
    setHealthStatus('Working');
  };

  const handleDefectModalSubmit = () => {
    if (!defectReason.trim() || !hopeTicketId.trim()) {
      alert('Please fill in both Defect Reason and Hope Ticket ID');
      return;
    }
    setIsDefectModalOpen(false);
  };

  const handleSubmit = async () => {
    if (!serialNumber.trim()) { alert('Please enter a Serial Number'); return; }
    setIsSubmitting(true);
    try {
      const existingIds = new Set(tableData.map(e => e.id));
      const newId = generateUniqueId(existingIds);
      const qrDataURL = await QRCode.toDataURL(newId, { width: 256, margin: 2 });

      const catRes = await getCategories();
      const categories = catRes.data.results ?? catRes.data;
      const cat = categories.find((c: { name: string; id: number }) => c.name.toLowerCase() === selectedCategory.toLowerCase());
      if (!cat) throw new Error(`Category "${selectedCategory}" not found.`);

      const tbRes = await getTestBenches();
      const testbenches = tbRes.data.results ?? tbRes.data;
      const tb = testbenches.find((t: { name: string; id: number }) => t.name === connection);

      const res = await createECU({
        id: newId,
        inventory_number: inventoryNumber.trim() || null,
        serial_number: serialNumber.trim(),
        category: cat.id,
        sub_category: subCategory,
        status: status.toLowerCase(),
        location,
        description: description.trim(),
        connection: tb?.id ?? null,
        health_status: healthStatus.toLowerCase(),
        defect_reason: healthStatus === 'Defect' ? defectReason.trim() : '',
        defect_ticket_id: healthStatus === 'Defect' ? hopeTicketId.trim() : '',
        project: selectedProject,
        qr_code_path: qrDataURL,
      });

      const created = res.data;
      onSuccess({
        id: String(created.id ?? newId),
        inventoryNumber: inventoryNumber.trim(),
        ssMan: serialNumber.trim(),
        category: selectedCategory,
        subCategory,
        status: status === 'Active' ? 'Active' : 'Not Active',
        location,
        connection,
        healthStatus,
        powerSupplyVolt: '',
        powerSupplyAmp: '',
        lastUpdated: new Date().toISOString().slice(0, 10),
        dateAdded: new Date().toISOString().slice(0, 10),
        defectReason: healthStatus === 'Defect' ? defectReason : '',
        hopeTicketId: healthStatus === 'Defect' ? hopeTicketId : '',
        qrCode: qrDataURL,
        description: description.trim(),
      });

      // Reset form
      setInventoryNumber('');
      setSerialNumber('');
      setStatus('Active');
      setDescription('');
      setSubCategory('ANTENNA');
      setLocation('SFAX');
      setHealthStatus('Working');
      setConnection(connections[0] ?? '');
      setDefectReason('');
      setHopeTicketId('');
      onClose();
    } catch (e) {
      alert('Failed to generate QR Code: ' + (e instanceof Error ? e.message : 'Unknown error'));
    } finally { setIsSubmitting(false); }
  };

  if (!isOpen) return null;

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
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-[14px] z-50 w-full max-w-2xl overflow-visible"
          >
            {/* Header */}
            <div className="px-6 py-4 rounded-t-[14px]" style={{ background: 'linear-gradient(135deg, #334E68, #243B53)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <QrCode className="w-5 h-5 text-white" />
                  <h2 className="text-lg font-bold text-white tracking-wide">Generate QR Code</h2>
                </div>
                <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="p-6">
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
                    className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 text-sm text-[#334155] transition-all"
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
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="Enter serial number"
                    className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 text-sm text-[#334155] transition-all"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="flex items-center gap-2 mb-2.5">
                    <ToggleLeft className="w-4 h-4 text-[#64748B]" />
                    <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Status <span className="text-red-500">*</span></span>
                  </label>
                  <CustomSelect value={status} options={['Active', 'Not Active']} onChange={setStatus} />
                </div>

                {/* Description */}
                <div className="col-span-2">
                  <label className="flex items-center gap-2 mb-2.5">
                    <FileText className="w-4 h-4 text-[#64748B]" />
                    <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Description</span>
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter description"
                    className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 text-sm text-[#334155] transition-all"
                  />
                </div>

                {/* Sub-Category */}
                <div>
                  <label className="flex items-center gap-2 mb-2.5">
                    <Layers className="w-4 h-4 text-[#64748B]" />
                    <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Sub-Category</span>
                  </label>
                  {loadingSubcategories && subcategories.length === 0 ? (
                    <div className="flex items-center justify-center py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px]">
                      <Loader2 className="w-4 h-4 animate-spin text-[#557486]" />
                    </div>
                  ) : (
                    <CustomSelect value={subCategory} options={subcategories} onChange={setSubCategory} />
                  )}
                </div>

                {/* Location */}
                <div>
                  <label className="flex items-center gap-2 mb-2.5">
                    <MapPin className="w-4 h-4 text-[#64748B]" />
                    <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Location</span>
                  </label>
                  <CustomSelect value={location} options={locations} onChange={setLocation} />
                </div>

                {/* Health Status */}
                <div>
                  <label className="flex items-center gap-2 mb-2.5">
                    <Activity className="w-4 h-4 text-[#64748B]" />
                    <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Health Status</span>
                  </label>
                  <CustomSelect value={healthStatus} options={['Working', 'Defect', 'Recovered']} onChange={handleHealthStatusChange} />
                </div>

                {/* Connection — filtered by project */}
                <div>
                  <label className="flex items-center gap-2 mb-2.5">
                    <Plug className="w-4 h-4 text-[#64748B]" />
                    <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Connection</span>
                  </label>
                  <CustomSelect
                    value={connection}
                    options={connections}
                    onChange={setConnection}
                    placeholder="Select test bench"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[#F8FAFC] border-t border-[#E2E8F0] rounded-b-[14px]">
              <button onClick={onClose} disabled={isSubmitting} className="px-5 py-2.5 border-2 border-[#CBD5E1] text-[#475569] rounded-[10px] font-semibold text-sm hover:bg-white hover:border-[#94A3B8] transition-all disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!serialNumber.trim() || isSubmitting}
                style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)' }}
                className="px-6 py-2.5 text-white rounded-[10px] font-semibold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center gap-2 min-w-[120px] justify-center"
              >
                {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Generating...</span></> : <span>Generate</span>}
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
                  className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-[14px] z-[70] w-full max-w-md overflow-hidden"
                >
                  <div className="px-6 py-4 rounded-t-[14px]" style={{ background: 'linear-gradient(135deg, #334E68, #243B53)' }}>
                    <h3 className="text-lg font-bold text-white tracking-wide">Defect Details</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="flex items-center gap-2 mb-2.5">
                        <FileText className="w-4 h-4 text-[#64748B]" />
                        <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Defect Reason <span className="text-red-500">*</span></span>
                      </label>
                      <input type="text" value={defectReason} onChange={(e) => setDefectReason(e.target.value)} placeholder="Enter defect reason" className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 text-sm text-[#334155] transition-all" />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 mb-2.5">
                        <Hash className="w-4 h-4 text-[#64748B]" />
                        <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Hope Ticket ID <span className="text-red-500">*</span></span>
                      </label>
                      <input type="text" value={hopeTicketId} onChange={(e) => setHopeTicketId(e.target.value)} placeholder="Enter ticket ID" className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 text-sm text-[#334155] transition-all" />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                    <button onClick={handleDefectModalClose} className="px-5 py-2.5 border-2 border-[#CBD5E1] text-[#475569] rounded-[10px] font-semibold text-sm hover:bg-white hover:border-[#94A3B8] transition-all">Cancel</button>
                    <button onClick={handleDefectModalSubmit} style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)' }} className="px-6 py-2.5 text-white rounded-[10px] font-semibold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all">Save</button>
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