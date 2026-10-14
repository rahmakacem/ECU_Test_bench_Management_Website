import { X, Calendar, Clock, User, CheckCircle, XCircle, Loader2, Filter, Trash2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { getBookingRequests, approveBookingRequest, declineBookingRequest, deleteBookingRequest } from '../services/api';

interface BookingRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: number;
  currentUserRole?: string;
}

interface BookingRequest {
  id: number;
  testbench: number;
  testbench_name: string;
  user: number;
  user_name: string;
  date: string;
  time_slot_start: string;
  time_slot_end: string;
  time_slot_display: string;
  team: string;
  domain: string | null;
  activity: string;
  test_case_file: string | null;
  test_case_filename: string | null;
  status: 'pending' | 'approved' | 'declined';
  reason: string | null;
  reviewed_by: number | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  created_at: string;
  seen_by_user?: boolean;
}

interface FilterState {
  status: string[];
  testbench: string[];
}

export function BookingRequestsModal({ isOpen, onClose, currentUserId, currentUserRole }: BookingRequestsModalProps) {
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [isProcessing, setIsProcessing] = useState<'approve' | 'decline' | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('Last 30 Days');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  
  // Filter states
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    status: [],
    testbench: [],
  });
  const [expandedSections, setExpandedSections] = useState({
    status: false,
    testbench: false,
  });
  
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  // Fetch booking requests
  useEffect(() => {
    if (!isOpen) return;
    
    const fetchBookings = async () => {
      setLoading(true);
      try {
        const res = await getBookingRequests();
        const data = res.data.results ?? res.data;
        
        // Mark requests as seen when modal opens
        const updatedData = data.map((req: BookingRequest) => ({
          ...req,
          seen_by_user: true
        }));
        
        setBookingRequests(updatedData);
        setFilteredRequests(updatedData);
      } catch (error) {
        console.error('Failed to fetch booking requests:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchBookings();
  }, [isOpen]);

  // Get unique testbench names for filter
  const testbenchOptions = useMemo(() => {
    const names = new Set(bookingRequests.map(r => r.testbench_name));
    return Array.from(names).sort();
  }, [bookingRequests]);

  // Apply filters
  useEffect(() => {
    let filtered = [...bookingRequests];
    
    // Apply status filter
    if (filters.status.length > 0) {
      filtered = filtered.filter(r => filters.status.includes(r.status));
    }
    
    // Apply testbench filter
    if (filters.testbench.length > 0) {
      filtered = filtered.filter(r => filters.testbench.includes(r.testbench_name));
    }
    
    // Apply date filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (dateFilter === 'Last 7 Days') {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      filtered = filtered.filter(r => new Date(r.created_at) >= sevenDaysAgo);
    } else if (dateFilter === 'Last 30 Days') {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      filtered = filtered.filter(r => new Date(r.created_at) >= thirtyDaysAgo);
    } else if (dateFilter === 'Last 90 Days') {
      const ninetyDaysAgo = new Date(today);
      ninetyDaysAgo.setDate(today.getDate() - 90);
      filtered = filtered.filter(r => new Date(r.created_at) >= ninetyDaysAgo);
    } else if (dateFilter === 'This Year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      filtered = filtered.filter(r => new Date(r.created_at) >= startOfYear);
    } else if (dateFilter === 'Custom Range' && customDateRange.start && customDateRange.end) {
      filtered = filtered.filter(r => {
        const date = new Date(r.created_at);
        return date >= new Date(customDateRange.start) && date <= new Date(customDateRange.end);
      });
    }
    
    setFilteredRequests(filtered);
  }, [bookingRequests, filters, dateFilter, customDateRange]);

  // Close filter panel on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isFilterPanelOpen &&
        filterPanelRef.current &&
        filterButtonRef.current &&
        !filterPanelRef.current.contains(event.target as Node) &&
        !filterButtonRef.current.contains(event.target as Node)
      ) {
        setIsFilterPanelOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterPanelOpen]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const toggleFilter = (category: keyof FilterState, value: string) => {
    setFilters(prev => {
      const currentValues = prev[category];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      return { ...prev, [category]: newValues };
    });
  };

  const removeFilter = (category: keyof FilterState, value: string) => {
    setFilters(prev => ({
      ...prev,
      [category]: prev[category].filter(v => v !== value)
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      status: [],
      testbench: [],
    });
    setDateFilter('Last 30 Days');
    setCustomDateRange({ start: '', end: '' });
  };

  const hasActiveFilters = useMemo(() => {
    return filters.status.length > 0 || filters.testbench.length > 0;
  }, [filters]);

  // Clear all booking requests (delete all)
  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to delete ALL booking requests? This action cannot be undone.')) {
      return;
    }
    
    try {
      const deletePromises = bookingRequests.map(req => deleteBookingRequest(req.id));
      await Promise.all(deletePromises);
      
      setBookingRequests([]);
      setFilteredRequests([]);
      alert('All booking requests have been deleted.');
    } catch (error) {
      console.error('Failed to delete all booking requests:', error);
      alert('Failed to delete all booking requests. Please try again.');
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    setIsProcessing('approve');
    try {
      await approveBookingRequest(selectedRequest.id, reviewReason);
      setBookingRequests(prev => prev.map(r => 
        r.id === selectedRequest.id 
          ? { ...r, status: 'approved', reviewed_by_name: currentUserRole === 'admin' ? 'Admin' : 'User', reviewed_at: new Date().toISOString(), reason: reviewReason || null }
          : r
      ));
      setSelectedRequest(null);
      setReviewReason('');
    } catch (error) {
      alert('Failed to approve booking request');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDecline = async () => {
    if (!selectedRequest) return;
    if (!reviewReason.trim()) {
      alert('Please provide a reason for declining');
      return;
    }
    setIsProcessing('decline');
    try {
      await declineBookingRequest(selectedRequest.id, reviewReason);
      setBookingRequests(prev => prev.map(r => 
        r.id === selectedRequest.id 
          ? { ...r, status: 'declined', reviewed_by_name: currentUserRole === 'admin' ? 'Admin' : 'User', reviewed_at: new Date().toISOString(), reason: reviewReason }
          : r
      ));
      setSelectedRequest(null);
      setReviewReason('');
    } catch (error) {
      alert('Failed to decline booking request');
    } finally {
      setIsProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 text-orange-700 rounded-full text-xs font-bold"><Clock className="w-3.5 h-3.5" />Pending</div>;
      case 'approved':
        return <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold"><CheckCircle className="w-3.5 h-3.5" />Approved</div>;
      case 'declined':
        return <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 rounded-full text-xs font-bold"><XCircle className="w-3.5 h-3.5" />Declined</div>;
      default:
        return null;
    }
  };

  const formatDateForDisplay = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const dateFilterOptions = ['Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'This Year', 'All Time', 'Custom Range'];

  const handleDateFilterSelect = (option: string) => {
    setDateFilter(option);
    if (option === 'Custom Range') {
      setShowCustomDatePicker(true);
    } else {
      setShowCustomDatePicker(false);
    }
  };

  const clearCustomDateRange = () => {
    setCustomDateRange({ start: '', end: '' });
    setDateFilter('Last 30 Days');
    setShowCustomDatePicker(false);
  };

  const stats = {
    total: filteredRequests.length,
    pending: filteredRequests.filter(r => r.status === 'pending').length,
    approved: filteredRequests.filter(r => r.status === 'approved').length,
    declined: filteredRequests.filter(r => r.status === 'declined').length,
  };

  const renderSection = (
    key: keyof FilterState,
    title: string,
    items: string[]
  ) => (
    <div className="px-3">
      <button
        onClick={() => toggleSection(key)}
        className="w-full flex items-center justify-between py-2 hover:bg-[#F8FAFC] rounded transition-colors"
      >
        <span className="font-bold text-[#354D6F] uppercase text-xs">{title}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#64748B] transition-transform ${expandedSections[key] ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-200 ease-in-out ${expandedSections[key] ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="space-y-0.5 py-1">
          {items.map((item) => {
            const count = bookingRequests.filter(r => 
              key === 'status' ? r.status === item : r.testbench_name === item
            ).length;
            return (
              <label
                key={item}
                className="flex items-center justify-between py-1.5 px-2 hover:bg-[#F1F5F9] rounded cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters[key].includes(item)}
                    onChange={() => toggleFilter(key, item)}
                    className="w-3.5 h-3.5 accent-[#2563EB] rounded"
                  />
                  <span className="text-xs text-[#475569] capitalize">{item}</span>
                </div>
                <span className="text-xs text-[#94A3B8]">{count}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.18)' }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-[14px] z-50 w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-4 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #334E68, #243B53)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-white" />
                  <h2 className="text-lg font-bold text-white tracking-wide">Booking Requests</h2>
                </div>
                <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              <div className="p-6 space-y-4">
                {/* Stats Section with Clear All Button */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-gradient-to-r from-orange-50 to-orange-100 rounded-full px-3.5 py-1.5 border border-orange-200">
                      <Clock className="w-4 h-4 text-orange-600" />
                      <span className="text-xs font-bold text-orange-700">Pending</span>
                      <span className="text-sm font-bold text-orange-800">{stats.pending}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-gradient-to-r from-green-50 to-green-100 rounded-full px-3.5 py-1.5 border border-green-200">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-xs font-bold text-green-700">Approved</span>
                      <span className="text-sm font-bold text-green-800">{stats.approved}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-gradient-to-r from-red-50 to-red-100 rounded-full px-3.5 py-1.5 border border-red-200">
                      <XCircle className="w-4 h-4 text-red-600" />
                      <span className="text-xs font-bold text-red-700">Declined</span>
                      <span className="text-sm font-bold text-red-800">{stats.declined}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-blue-100 rounded-full px-3.5 py-1.5 border border-blue-200">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold text-blue-700">Total</span>
                      <span className="text-sm font-bold text-blue-800">{stats.total}</span>
                    </div>
                  </div>
                  
                  {/* Clear All Button */}
                  <button
                    onClick={handleClearAll}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear All
                  </button>
                </div>

                {/* Date Filter and Filter Button Row */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Calendar className="w-4 h-4 text-[#64748B]" />
                    <span className="text-xs font-bold text-[#64748B] uppercase">Date Filter:</span>
                    {dateFilterOptions.map((option) => (
                      <button
                        key={option}
                        onClick={() => handleDateFilterSelect(option)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                          dateFilter === option
                            ? 'bg-[#2563EB] text-white'
                            : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:border-[#2563EB]'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                    {showCustomDatePicker && (
                      <div className="flex items-center gap-2 ml-2">
                        <input
                          type="date"
                          value={customDateRange.start}
                          onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                          className="px-2 py-1 text-xs border border-[#E2E8F0] rounded"
                        />
                        <span className="text-xs text-[#64748B]">to</span>
                        <input
                          type="date"
                          value={customDateRange.end}
                          onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                          className="px-2 py-1 text-xs border border-[#E2E8F0] rounded"
                        />
                        <button onClick={clearCustomDateRange} className="p-1 hover:bg-red-100 rounded">
                          <X className="w-3 h-3 text-red-500" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Filter Icon Button */}
                  <div className="relative">
                    <button
                      ref={filterButtonRef}
                      onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                      className="p-2 bg-[#354D6F] text-white rounded-lg hover:bg-[#1A365B] transition-all"
                    >
                      <Filter className="w-4 h-4" />
                    </button>
                    
                    <AnimatePresence>
                      {isFilterPanelOpen && (
                        <motion.div
                          ref={filterPanelRef}
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          transition={{ duration: 0.15 }}
                          className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl w-[280px] z-50 border border-[#E2E8F0]"
                        >
                          <div className="absolute -top-2 right-4 w-4 h-4 bg-white border-l border-t border-[#E2E8F0] transform rotate-45"></div>
                          
                          <div className="max-h-[350px] overflow-y-auto py-3">
                            {renderSection('status', 'STATUS', ['pending', 'approved', 'declined'])}
                            <div className="h-px bg-[#E2E8F0] my-2"></div>
                            {renderSection('testbench', 'TESTBENCH', testbenchOptions)}
                          </div>
                          
                          <div className="border-t border-[#E2E8F0] p-3 flex items-center gap-2">
                            <button
                              onClick={() => setIsFilterPanelOpen(false)}
                              className="flex-1 px-4 py-2 bg-[#354D6F] text-white rounded-lg font-bold text-xs hover:bg-[#1A365B]"
                            >
                              APPLY
                            </button>
                            <button
                              onClick={clearAllFilters}
                              className="flex-1 px-4 py-2 bg-[#E2E8F0] text-[#475569] rounded-lg font-bold text-xs hover:bg-[#CBD5E1]"
                            >
                              CLEAR
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Filter Chips */}
                {hasActiveFilters && (
                  <div className="bg-[#F5F0E8] rounded-lg p-3 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#354D6F] uppercase">Active Filters:</span>
                    {filters.status.map(value => (
                      <div key={`status-${value}`} className="flex items-center gap-1 px-3 py-1 bg-white border border-[#BAC8D1] rounded-full text-xs">
                        <span className="text-[#354D6F] font-medium capitalize">Status: {value}</span>
                        <button onClick={() => removeFilter('status', value)}><X className="w-3 h-3 text-[#936363]" /></button>
                      </div>
                    ))}
                    {filters.testbench.map(value => (
                      <div key={`testbench-${value}`} className="flex items-center gap-1 px-3 py-1 bg-white border border-[#BAC8D1] rounded-full text-xs">
                        <span className="text-[#354D6F] font-medium">Testbench: {value}</span>
                        <button onClick={() => removeFilter('testbench', value)}><X className="w-3 h-3 text-[#936363]" /></button>
                      </div>
                    ))}
                    <button onClick={clearAllFilters} className="ml-auto px-3 py-1 bg-[#936363] text-white rounded-full text-xs font-bold hover:bg-[#7a5252]">
                      Clear All Filters
                    </button>
                  </div>
                )}

                {/* Table */}
                <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-[#F8FAFC] to-[#F1F5F9] border-b border-[#E2E8F0]">
                          <th className="px-3 py-3 text-left"><div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-[#64748B]" /><span className="text-xs font-bold text-[#334155] uppercase">Testbench</span></div></th>
                          <th className="px-3 py-3 text-left"><div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-[#64748B]" /><span className="text-xs font-bold text-[#334155] uppercase">Date & Time</span></div></th>
                          <th className="px-3 py-3 text-left"><div className="flex items-center gap-2"><User className="w-4 h-4 text-[#64748B]" /><span className="text-xs font-bold text-[#334155] uppercase">Requested By</span></div></th>
                          <th className="px-3 py-3 text-left"><div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-[#64748B]" /><span className="text-xs font-bold text-[#334155] uppercase">Requested At</span></div></th>
                          <th className="px-3 py-3 text-left"><div className="flex items-center gap-2"><User className="w-4 h-4 text-[#64748B]" /><span className="text-xs font-bold text-[#334155] uppercase">Reviewed By</span></div></th>
                          <th className="px-3 py-3 text-left"><div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#64748B]" /><span className="text-xs font-bold text-[#334155] uppercase">Status</span></div></th>
                          <th className="px-3 py-3 text-left"><div className="flex items-center gap-2"><XCircle className="w-4 h-4 text-[#64748B]" /><span className="text-xs font-bold text-[#334155] uppercase">Reason</span></div></th>
                         </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr><td colSpan={7} className="p-12 text-center"><div className="w-8 h-8 border-4 border-[#557486] border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
                        ) : filteredRequests.length === 0 ? (
                          <tr><td colSpan={7} className="p-12 text-center text-[#64748B]"><Calendar className="w-12 h-12 mx-auto mb-3 text-[#CBD5E1]" /><p className="text-sm font-medium">No booking requests found</p></td></tr>
                        ) : (
                          filteredRequests.map((request) => (
                            <tr key={request.id} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC]">
                              <td className="px-3 py-3 text-xs font-medium text-[#334155]">{request.testbench_name}</td>
                              <td className="px-3 py-3 text-xs text-[#64748B]">
                                <div className="font-medium">{formatDateForDisplay(request.date)}</div>
                                <div className="text-[10px] text-gray-400 mt-0.5">{request.time_slot_display}</div>
                              </td>
                              <td className="px-3 py-3 text-xs text-[#64748B]">{request.user_name}</td>
                              <td className="px-3 py-3 text-xs text-[#64748B]">{new Date(request.created_at).toLocaleString()}</td>
                              <td className="px-3 py-3 text-xs text-[#64748B]">{request.reviewed_by_name || '—'}</td>
                              <td className="px-3 py-3">
                                <button 
                                  onClick={() => (currentUserRole === 'admin' || request.user === currentUserId) && request.status === 'pending' && setSelectedRequest(request)} 
                                  className={`cursor-pointer ${(currentUserRole !== 'admin' && request.user !== currentUserId) ? 'cursor-default' : ''}`}
                                >
                                  {getStatusBadge(request.status)}
                                </button>
                              </td>
                              <td className="px-3 py-3 text-xs text-[#64748B] max-w-[180px] truncate">{request.reason || '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Review Modal */}
          <AnimatePresence>
            {selectedRequest && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 z-[60]" />
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-[14px] z-[70] w-full max-w-lg overflow-hidden">
                  <div className="px-5 py-3" style={{ background: 'linear-gradient(135deg, #334E68, #243B53)' }}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-white tracking-wide">Review Booking Request</h3>
                      <button onClick={() => { setSelectedRequest(null); setReviewReason(''); }} className="p-1 hover:bg-white/20 rounded"><X className="w-4 h-4 text-white" /></button>
                    </div>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="bg-[#F8FAFC] rounded-lg p-4 border border-[#E2E8F0]">
                      <p className="text-sm text-[#334155] leading-relaxed">
                        Do you want to approve the booking request for <span className="font-bold text-[#2563EB]">{selectedRequest.testbench_name}</span> on{' '}
                        <span className="font-bold">{formatDateForDisplay(selectedRequest.date)}</span> at{' '}
                        <span className="font-bold">{selectedRequest.time_slot_display}</span>?
                      </p>
                      <div className="mt-3 pt-3 border-t border-[#E2E8F0] space-y-1.5">
                        <div className="flex items-center gap-4">
                          <p className="text-xs text-[#64748B]"><span className="font-bold">Team:</span> {selectedRequest.team}</p>
                          {selectedRequest.domain && (
                            <p className="text-xs text-[#64748B]"><span className="font-bold">Domain:</span> {selectedRequest.domain}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                          <p className="text-xs text-[#64748B]"><span className="font-bold">Activity:</span> {selectedRequest.activity}</p>
                          {selectedRequest.test_case_file && selectedRequest.test_case_filename && (
                            <p className="text-xs text-[#64748B] flex items-center gap-1">
                              <span className="font-bold">Test Case File:</span>
                              <button
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = selectedRequest.test_case_file!;
                                  const ext = selectedRequest.test_case_filename!.includes('.')
                                    ? '.' + selectedRequest.test_case_filename!.split('.').pop()
                                    : '';
                                  const date = new Date(selectedRequest.created_at);
                                  const dateStr = `${String(date.getDate()).padStart(2,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${date.getFullYear()}`;
                                  link.download = `TC_${selectedRequest.user_name.replace(/\s+/g,'_')}_${dateStr}${ext}`;
                                  link.click();
                                }}
                                className="text-[#2563EB] underline hover:text-[#1A365B] font-medium transition-colors text-[10px]"
                              >
                                Download
                              </button>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="flex items-center gap-2 mb-2">
                        <XCircle className="w-4 h-4 text-[#64748B]" />
                        <span className="text-xs font-bold text-[#64748B] uppercase">Reason (required if declining)</span>
                      </label>
                      <textarea value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} placeholder="Enter reason for declining..." rows={3} className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] text-sm resize-none" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                    <button onClick={handleDecline} disabled={isProcessing !== null} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg font-semibold text-sm hover:shadow-lg transition-all disabled:opacity-50">
                      {isProcessing === 'decline' ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</> : <><XCircle className="w-4 h-4" />Decline</>}
                    </button>
                    <button onClick={handleApprove} disabled={isProcessing !== null} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-semibold text-sm hover:shadow-lg transition-all disabled:opacity-50">
                      {isProcessing === 'approve' ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</> : <><CheckCircle className="w-4 h-4" />Approve</>}
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