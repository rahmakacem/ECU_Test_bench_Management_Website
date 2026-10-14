// ECUHistoryModal.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X, Clock, Calendar, Plus, Upload, FileText, Database,
  Trash2, Edit, User, Hash, Box, Server, Send, CheckCircle,
  XCircle, PackageCheck, Loader2, RefreshCw, ArrowRight, Truck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getECUHistory } from '../services/api';

interface ECUHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DateFilter = 'today' | 'yesterday' | 'this-week' | 'this-month' | 'custom' | null;
type ActionFilter = 
  | 'all' | 'add' | 'update' | 'delete' | 'api' | 'excel' | 'bulk' 
  | 'transfer-pending' | 'transfer-approved' | 'transfer-declined' | 'transfer-confirmed'
  | 'return-to-supplier';

interface HistoryEntry {
  id: number;
  date: string;
  time: string;
  action: string;
  action_type: string;
  details: string;
  user: string;
  username: string;
  ecu: number | null;
  timestamp: string;
  ecu_snapshot: Record<string, unknown> | null;
  additional_data: Record<string, unknown> | null;
}

// ─── Color / icon maps for action chips ────────────────────────────────────────
const ACTION_COLORS: Record<string, {
  border: string; bg: string; icon: string; chipActive: string; chipInactive: string;
}> = {
  add: { 
    border: 'border-l-green-500', bg: 'bg-green-50', icon: 'text-green-600',
    chipActive: 'bg-green-500 text-white border-green-500',
    chipInactive: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
  },
  update: { 
    border: 'border-l-blue-500', bg: 'bg-blue-50', icon: 'text-blue-600',
    chipActive: 'bg-blue-500 text-white border-blue-500',
    chipInactive: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
  },
  delete: { 
    border: 'border-l-red-500', bg: 'bg-red-50', icon: 'text-red-600',
    chipActive: 'bg-red-500 text-white border-red-500',
    chipInactive: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
  },
  api: { 
    border: 'border-l-purple-500', bg: 'bg-purple-50', icon: 'text-purple-600',
    chipActive: 'bg-purple-500 text-white border-purple-500',
    chipInactive: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
  },
  excel: { 
    border: 'border-l-orange-500', bg: 'bg-orange-50', icon: 'text-orange-600',
    chipActive: 'bg-orange-500 text-white border-orange-500',
    chipInactive: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
  },
  bulk: { 
    border: 'border-l-indigo-500', bg: 'bg-indigo-50', icon: 'text-indigo-600',
    chipActive: 'bg-indigo-500 text-white border-indigo-500',
    chipInactive: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
  },
  'transfer-pending': { 
    border: 'border-l-yellow-500', bg: 'bg-yellow-50', icon: 'text-yellow-600',
    chipActive: 'bg-yellow-500 text-white border-yellow-500',
    chipInactive: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
  },
  'transfer-approved': { 
    border: 'border-l-green-500', bg: 'bg-green-50', icon: 'text-green-600',
    chipActive: 'bg-green-500 text-white border-green-500',
    chipInactive: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
  },
  'transfer-declined': { 
    border: 'border-l-red-500', bg: 'bg-red-50', icon: 'text-red-600',
    chipActive: 'bg-red-500 text-white border-red-500',
    chipInactive: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
  },
  'transfer-confirmed': { 
    border: 'border-l-blue-500', bg: 'bg-blue-50', icon: 'text-blue-600',
    chipActive: 'bg-blue-500 text-white border-blue-500',
    chipInactive: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
  },
  'return-to-supplier': { 
    border: 'border-l-purple-500', bg: 'bg-purple-50', icon: 'text-purple-600',
    chipActive: 'bg-purple-500 text-white border-purple-500',
    chipInactive: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
  },
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  add: Plus,
  update: Edit,
  delete: Trash2,
  api: Database,
  excel: FileText,
  bulk: Server,
  'transfer-pending': Send,
  'transfer-approved': CheckCircle,
  'transfer-declined': XCircle,
  'transfer-confirmed': PackageCheck,
  'return-to-supplier': Truck,
};

// ─── Format update details to show field changes ──────────────────────────────
function formatUpdateDetails(entry: HistoryEntry): string {
  const additionalData = entry.additional_data;
  const changes = additionalData?.changes as Record<string, { old: string; new: string }> | undefined;
  
  if (changes && Object.keys(changes).length > 0) {
    const changeEntries = Object.entries(changes);
    return changeEntries.map(([field, change]) => {
      let fieldName = field.replace(/_/g, ' ').toUpperCase();
      if (fieldName === 'SS MAN') fieldName = 'SERIAL NUMBER';
      if (fieldName === 'CONNECTION NAME') fieldName = 'CONNECTION';
      if (fieldName === 'CATEGORY NAME') fieldName = 'CATEGORY';
      if (fieldName === 'SUB CATEGORY') fieldName = 'SUB-CATEGORY';
      if (fieldName === 'HEALTH STATUS') fieldName = 'HEALTH';
      return `${fieldName}: ${change.old} → ${change.new}`;
    }).join(' • ');
  }
  
  return entry.details;
}

// ─── Format action title for display ──────────────────────────────────────────
function formatActionTitle(entry: HistoryEntry): string {
  const actionType = entry.action_type;
  
  switch (actionType) {
    case 'add': return 'New ECU Added';
    case 'update': return 'ECU Updated';
    case 'delete': return 'ECU Removed';
    case 'api': return 'API Import';
    case 'excel': return 'Excel Import';
    case 'bulk': return 'Bulk Operation';
    case 'transfer-pending': return 'Transfer Request Pending';
    case 'transfer-approved': return 'Transfer Request Approved';
    case 'transfer-declined': return 'Transfer Request Declined';
    case 'transfer-confirmed': return 'Transfer Confirmed';
    case 'return-to-supplier': return 'Returned to Supplier';
    default: return entry.action || 'Action';
  }
}

// ─── Get serial number from entry ─────────────────────────────────────────────
function getSerialNumber(entry: HistoryEntry): string | null {
  const snapshot = entry.ecu_snapshot as any;
  if (snapshot?.serial_number) return snapshot.serial_number;
  if (entry.additional_data?.ecu_serial) return entry.additional_data?.ecu_serial as string;
  return null;
}

// ─── Get subcategory from entry ───────────────────────────────────────────────
function getSubcategory(entry: HistoryEntry): string | null {
  const snapshot = entry.ecu_snapshot as any;
  if (snapshot?.sub_category) return snapshot.sub_category;
  return null;
}

// ─── Get category from entry ──────────────────────────────────────────────────
function getCategory(entry: HistoryEntry): string | null {
  const snapshot = entry.ecu_snapshot as any;
  if (snapshot?.category_name) return snapshot.category_name;
  return null;
}

// ─── Get testbench from entry ─────────────────────────────────────────────────
function getTestbench(entry: HistoryEntry): string | null {
  const snapshot = entry.ecu_snapshot as any;
  if (snapshot?.connection_name) return snapshot.connection_name;
  return null;
}

// ─── Get supplier name from return-to-supplier entry ──────────────────────────
function getSupplierName(entry: HistoryEntry): string | null {
  const additionalData = entry.additional_data;
  if (additionalData?.supplier_name) {
    return additionalData.supplier_name as string;
  }
  return null;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function parseEntryDate(entry: HistoryEntry): Date {
  return new Date(entry.timestamp);
}

function applyDateFilter(entries: HistoryEntry[], filter: DateFilter, from: string, to: string): HistoryEntry[] {
  if (!filter) return entries;
  const now = new Date();
  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  return entries.filter(e => {
    const d = parseEntryDate(e);
    if (filter === 'today')      return d >= startOfDay(now);
    if (filter === 'yesterday') {
      const yest = new Date(now); yest.setDate(yest.getDate() - 1);
      return d >= startOfDay(yest) && d < startOfDay(now);
    }
    if (filter === 'this-week') {
      const week = new Date(now); week.setDate(week.getDate() - 7);
      return d >= week;
    }
    if (filter === 'this-month') {
      const month = new Date(now); month.setDate(1); month.setHours(0,0,0,0);
      return d >= month;
    }
    if (filter === 'custom' && from && to) {
      const s = new Date(from);
      const end = new Date(to); end.setHours(23,59,59);
      return d >= s && d <= end;
    }
    return true;
  });
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function ECUHistoryModal({ isOpen, onClose }: ECUHistoryModalProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>(null);
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getECUHistory(undefined);
      const data: HistoryEntry[] = res.data;
      console.log('Fetched global history entries:', data.length);
      setEntries(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch history', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchHistory();
  }, [isOpen, fetchHistory]);

  // ── Filters ──
  const dateFiltered = applyDateFilter(entries, dateFilter, fromDate, toDate);
  const filtered = dateFiltered.filter(e => {
    if (actionFilter === 'all') return true;
    return e.action_type === actionFilter;
  });

  // ── Statistics (without Total) ──
  const stats = useMemo(() => ({
    adds: entries.filter(e => e.action_type === 'add').length,
    updates: entries.filter(e => e.action_type === 'update').length,
    deletes: entries.filter(e => e.action_type === 'delete').length,
    api: entries.filter(e => e.action_type === 'api').length,
    excel: entries.filter(e => e.action_type === 'excel').length,
    bulk: entries.filter(e => e.action_type === 'bulk').length,
    transfers: entries.filter(e => 
      e.action_type === 'transfer-pending' || 
      e.action_type === 'transfer-approved' || 
      e.action_type === 'transfer-declined' || 
      e.action_type === 'transfer-confirmed'
    ).length,
    returns: entries.filter(e => e.action_type === 'return-to-supplier').length,
  }), [entries]);

  const clearDateFilter = () => { setDateFilter(null); setFromDate(''); setToDate(''); };
  const getDateRangeText = () => {
    if (dateFilter === 'custom' && fromDate && toDate) return `${fromDate} → ${toDate}`;
    return dateFilter ? dateFilter.replace('-', ' ').toUpperCase() : '';
  };

  const ACTION_CHIPS: { key: ActionFilter; label: string }[] = [
    { key: 'all', label: 'All Actions' },
    { key: 'add', label: 'Add' },
    { key: 'update', label: 'Update' },
    { key: 'delete', label: 'Delete' },
    { key: 'api', label: 'API' },
    { key: 'excel', label: 'Excel' },
    { key: 'bulk', label: 'Bulk' },
    { key: 'transfer-pending', label: 'Transfer Pending' },
    { key: 'transfer-approved', label: 'Transfer Approved' },
    { key: 'transfer-declined', label: 'Transfer Declined' },
    { key: 'transfer-confirmed', label: 'Transfer Confirmed' },
    { key: 'return-to-supplier', label: 'Return to Supplier' },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal - Compact header */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#F5F0E8] rounded-2xl shadow-2xl z-50 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Compact Header - reduced padding */}
            <div className="px-5 py-3 border-b border-[#BAC8D1]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-[#557486] rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#354D6F]">Global History Log</h2>
                    <p className="text-[10px] text-gray-500">All user actions across all ECUs</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={fetchHistory}
                    disabled={loading}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold text-[#475569] hover:bg-[#BAC8D1] border border-[#BAC8D1] transition-all disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Refresh
                  </button>
                  <button onClick={onClose} className="p-1.5 hover:bg-[#BAC8D1] rounded-lg transition-colors">
                    <X className="w-4 h-4 text-[#354D6F]" />
                  </button>
                </div>
              </div>
            </div>

            {/* Date Filters - compact */}
            <div className="px-5 py-2 border-b border-[#BAC8D1] bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(['today', 'yesterday', 'this-week', 'this-month', 'custom'] as DateFilter[]).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => filter === 'custom' ? setIsDatePickerOpen(true) : setDateFilter(filter === dateFilter ? null : filter)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase transition-all ${
                        dateFilter === filter
                          ? 'bg-[#557486] text-white'
                          : 'bg-gray-200 text-[#354D6F] hover:bg-gray-300'
                      }`}
                    >
                      {filter?.replace('-', ' ')}
                    </button>
                  ))}
                </div>
                
                {dateFilter && (
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-[#7594A4] text-white rounded-full text-[10px]">
                      <Calendar className="w-2.5 h-2.5" />
                      <span className="font-bold">{getDateRangeText()}</span>
                    </div>
                    <button
                      onClick={clearDateFilter}
                      className="p-0.5 hover:bg-[#BAC8D1] rounded-full transition-colors"
                    >
                      <X className="w-3 h-3 text-[#354D6F]" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Statistics Section - compact, no Total */}
            <div className="px-5 py-2 bg-[#F5EFE3]">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg shadow-sm">
                  <div className="w-5 h-5 bg-green-500 rounded-lg flex items-center justify-center">
                    <Plus className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <div className="text-[8px] text-gray-600 uppercase font-bold">Adds</div>
                    <div className="text-sm font-bold text-[#354D6F]">{stats.adds}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg shadow-sm">
                  <div className="w-5 h-5 bg-blue-500 rounded-lg flex items-center justify-center">
                    <Edit className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <div className="text-[8px] text-gray-600 uppercase font-bold">Updates</div>
                    <div className="text-sm font-bold text-[#354D6F]">{stats.updates}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg shadow-sm">
                  <div className="w-5 h-5 bg-red-500 rounded-lg flex items-center justify-center">
                    <Trash2 className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <div className="text-[8px] text-gray-600 uppercase font-bold">Deletes</div>
                    <div className="text-sm font-bold text-[#354D6F]">{stats.deletes}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg shadow-sm">
                  <div className="w-5 h-5 bg-purple-500 rounded-lg flex items-center justify-center">
                    <Database className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <div className="text-[8px] text-gray-600 uppercase font-bold">API</div>
                    <div className="text-sm font-bold text-[#354D6F]">{stats.api}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg shadow-sm">
                  <div className="w-5 h-5 bg-orange-500 rounded-lg flex items-center justify-center">
                    <FileText className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <div className="text-[8px] text-gray-600 uppercase font-bold">Excel</div>
                    <div className="text-sm font-bold text-[#354D6F]">{stats.excel}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg shadow-sm">
                  <div className="w-5 h-5 bg-indigo-500 rounded-lg flex items-center justify-center">
                    <Server className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <div className="text-[8px] text-gray-600 uppercase font-bold">Bulk</div>
                    <div className="text-sm font-bold text-[#354D6F]">{stats.bulk}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg shadow-sm">
                  <div className="w-5 h-5 bg-yellow-500 rounded-lg flex items-center justify-center">
                    <Send className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <div className="text-[8px] text-gray-600 uppercase font-bold">Transfers</div>
                    <div className="text-sm font-bold text-[#354D6F]">{stats.transfers}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg shadow-sm">
                  <div className="w-5 h-5 bg-purple-600 rounded-lg flex items-center justify-center">
                    <Truck className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <div className="text-[8px] text-gray-600 uppercase font-bold">Returns</div>
                    <div className="text-sm font-bold text-[#354D6F]">{stats.returns}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Type Filters - compact chips */}
            <div className="px-5 py-1.5 border-b border-[#BAC8D1] bg-white">
              <div className="flex items-center gap-1.5 flex-wrap">
                {ACTION_CHIPS.map(({ key, label }) => {
                  const isActive = actionFilter === key;
                  const colors = key === 'all' ? null : ACTION_COLORS[key];
                  return (
                    <button
                      key={key}
                      onClick={() => setActionFilter(key)}
                      className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase border transition-all ${
                        isActive
                          ? colors 
                            ? colors.chipActive 
                            : 'bg-[#354D6F] text-white border-[#354D6F] shadow-md'
                          : colors 
                            ? colors.chipInactive 
                            : 'bg-gray-100 text-[#354D6F] border-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* History Timeline */}
            <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: '500px' }}>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="w-10 h-10 border-4 border-[#557486] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Clock className="w-12 h-12 text-gray-400 mb-3" />
                  <p className="text-base text-gray-500 font-bold">No history entries found.</p>
                  <p className="text-[10px] text-gray-400 mt-1">Try adjusting your filters or perform some actions.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((entry) => {
                    const Icon = ACTION_ICONS[entry.action_type] || Plus;
                    const colors = ACTION_COLORS[entry.action_type] || ACTION_COLORS.add;
                    const serialNumber = getSerialNumber(entry);
                    const subcategory = getSubcategory(entry);
                    const category = getCategory(entry);
                    const testbench = getTestbench(entry);
                    const supplierName = getSupplierName(entry);
                    const actionTitle = formatActionTitle(entry);
                    
                    let formattedDetails = entry.details;
                    if (entry.action_type === 'update') {
                      formattedDetails = formatUpdateDetails(entry);
                    }
                    
                    if (entry.action_type === 'return-to-supplier' && supplierName) {
                      formattedDetails = `ECU ${serialNumber || entry.ecu} (${subcategory || 'ECU'}) returned to supplier: ${supplierName}`;
                    }
                    
                    const extra = entry.additional_data || {};
                    const transferFrom = extra.from as string | undefined;
                    const transferTo = extra.to as string | undefined;
                    const transferReason = extra.reason as string | undefined;
                    const newLocation = extra.new_location as string | undefined;
                    const approvedBy = extra.approved_by as string | undefined;
                    const declinedBy = extra.declined_by as string | undefined;

                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`flex items-start gap-3 p-3 bg-gray-50 rounded-lg border-l-4 ${colors.border} hover:shadow-md hover:translate-x-1 transition-all cursor-pointer`}
                      >
                        {/* Date & Time */}
                        <div className="flex flex-col items-center justify-center min-w-[90px] text-center flex-shrink-0">
                          <div className="text-[10px] text-gray-600 font-bold">{entry.date}</div>
                          <div className="text-xs text-[#354D6F] font-bold">{entry.time}</div>
                        </div>

                        {/* Icon */}
                        <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm flex-shrink-0`}>
                          <Icon className={`w-4 h-4 ${colors.icon}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[#354D6F] text-xs mb-0.5">{actionTitle}</div>
                          <div className="text-[11px] text-gray-600 mb-1.5 leading-relaxed">{formattedDetails}</div>
                          
                          {/* Metadata chips */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="flex items-center gap-0.5 text-gray-700">
                              <User className="w-2.5 h-2.5" />
                              <span className="text-[9px] font-bold">{entry.user}</span>
                              <span className="text-[8px] text-gray-500">@{entry.username}</span>
                            </div>

                            {serialNumber && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#7594A4] text-white rounded text-[8px] font-bold">
                                <Hash className="w-2 h-2" />
                                ECU: {serialNumber}
                              </span>
                            )}

                            {category && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#936363] text-white rounded text-[8px] font-bold">
                                <Box className="w-2 h-2" />
                                Cat: {category}
                              </span>
                            )}

                            {subcategory && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#A8BAC3] text-[#354D6F] rounded text-[8px] font-bold">
                                <Box className="w-2 h-2" />
                                Sub: {subcategory}
                              </span>
                            )}

                            {testbench && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#557486] text-white rounded text-[8px] font-bold">
                                <Server className="w-2 h-2" />
                                TB: {testbench}
                              </span>
                            )}

                            {supplierName && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[8px] font-bold border border-purple-200">
                                <Truck className="w-2 h-2" />
                                Supplier: {supplierName}
                              </span>
                            )}

                            {transferFrom && transferTo && (
                              <>
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#557486] text-white rounded text-[8px] font-bold">
                                  <ArrowRight className="w-2 h-2" />
                                  From: {transferFrom}
                                </span>
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#557486] text-white rounded text-[8px] font-bold">
                                  <ArrowRight className="w-2 h-2" />
                                  To: {transferTo}
                                </span>
                              </>
                            )}

                            {approvedBy && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#557486] text-white rounded text-[8px] font-bold">
                                <CheckCircle className="w-2 h-2" />
                                Approved: {approvedBy}
                              </span>
                            )}
                            
                            {declinedBy && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#557486] text-white rounded text-[8px] font-bold">
                                <XCircle className="w-2 h-2" />
                                Declined: {declinedBy}
                              </span>
                            )}

                            {entry.action_type === 'transfer-confirmed' && newLocation && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-600 text-white rounded text-[8px] font-bold">
                                <PackageCheck className="w-2 h-2" />
                                Arrived: {newLocation}
                              </span>
                            )}

                            {transferReason && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded text-[8px] font-medium max-w-xs truncate">
                                <XCircle className="w-2 h-2" />
                                Reason: {transferReason}
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>

          {/* Custom Date Picker Modal */}
          <AnimatePresence>
            {isDatePickerOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsDatePickerOpen(false)}
                  className="fixed inset-0 bg-black/30 z-[60]"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl z-[70] p-5 w-80"
                >
                  <h3 className="text-base font-bold text-[#354D6F] mb-3">Custom Date Range</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-[#354D6F] mb-1">From Date</label>
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full px-2 py-1.5 border-2 border-[#BAC8D1] rounded-lg focus:outline-none focus:border-[#557486] text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-[#354D6F] mb-1">To Date</label>
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full px-2 py-1.5 border-2 border-[#BAC8D1] rounded-lg focus:outline-none focus:border-[#557486] text-sm"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-end gap-2 mt-4">
                    <button
                      onClick={() => setIsDatePickerOpen(false)}
                      className="px-3 py-1.5 border-2 border-[#BAC8D1] text-[#354D6F] rounded-lg font-bold text-xs hover:bg-gray-100 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => { setDateFilter('custom'); setIsDatePickerOpen(false); }}
                      className="px-3 py-1.5 bg-[#354D6F] text-white rounded-lg font-bold text-xs hover:bg-[#1A365B] transition-all"
                    >
                      Apply
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