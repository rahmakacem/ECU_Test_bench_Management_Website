import { useState, useRef, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Upload, Check, Plus, Loader2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createBookingRequest, getAvailableTimeSlots, getTeams, getActivities, createTeam, createActivity, getDomains, createDomain } from '../services/api';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  testBench: {
    id?: number;
    name?: string;
    badge?: string;
    serialId?: string;
    project?: string;
  };
  currentUserId?: number;
  refreshTrigger?: boolean;
}

interface Team {
  id: number;
  name: string;
  project: string;
  domains: string[];
}

interface Activity {
  id: number;
  name: string;
}

interface Domain {
  id: number;
  name: string;
  team: number;
  team_name: string;
}

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const defaultTimeSlots = [
  { start: '08:00', end: '08:30', booked: false },
  { start: '08:30', end: '09:00', booked: false },
  { start: '09:00', end: '09:30', booked: false },
  { start: '09:30', end: '10:00', booked: false },
  { start: '10:00', end: '10:30', booked: false },
  { start: '10:30', end: '11:00', booked: false },
  { start: '11:00', end: '11:30', booked: false },
  { start: '11:30', end: '12:00', booked: false },
  { start: '12:00', end: '12:30', booked: false },
  { start: '12:30', end: '13:00', booked: false },
  { start: '13:00', end: '13:30', booked: false },
  { start: '13:30', end: '14:00', booked: false },
  { start: '14:00', end: '14:30', booked: false },
  { start: '14:30', end: '15:00', booked: false },
  { start: '15:00', end: '15:30', booked: false },
  { start: '15:30', end: '16:00', booked: false },
  { start: '16:00', end: '16:30', booked: false },
  { start: '16:30', end: '17:00', booked: false },
  { start: '17:00', end: '17:30', booked: false },
  { start: '17:30', end: '18:00', booked: false },
];

const isTimeSlotExpired = (slotDate: Date, slotEndTime: string): boolean => {
  const now = new Date();
  const [hours, minutes] = slotEndTime.split(':');
  const slotEndDateTime = new Date(slotDate);
  slotEndDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  const isToday = slotDate.toDateString() === now.toDateString();
  if (isToday) return now > slotEndDateTime;
  return slotEndDateTime < now;
};

const isDateExpired = (date: Date): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

// ── Reusable modern scroll-list with search + add-new ──────────────────────
interface ScrollListProps {
  label: string;
  items: string[];
  selected: string[];
  multiSelect?: boolean;
  onToggle: (item: string) => void;
  onAddNew?: (name: string) => Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  disabledMsg?: string;
  accentColor?: string;
  placeholder?: string;
}

function ScrollList({
  label, items, selected, multiSelect = true,
  onToggle, onAddNew, loading = false, disabled = false,
  disabledMsg, accentColor = '#354D6F', placeholder = 'Search...',
}: ScrollListProps) {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const filtered = items.filter(i => i.toLowerCase().includes(search.toLowerCase()));

  const handleAdd = async () => {
    if (!newName.trim() || !onAddNew) return;
    setAdding(true);
    try {
      await onAddNew(newName.trim());
      setNewName('');
      setShowAdd(false);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Label row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#1A365B] uppercase tracking-wide">{label}</span>
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
              style={{ background: accentColor }}
            >
              {selected.length} SELECTED
            </span>
          )}
          {onAddNew && !showAdd && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1 text-[10px] font-bold text-[#557486] hover:text-[#354D6F] transition-colors"
            >
              <Plus className="w-3 h-3" /> Add New
            </button>
          )}
        </div>
      </div>

      {/* Add-new inline form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowAdd(false); }}
                placeholder={`New ${label.toLowerCase()}...`}
                className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#557486] bg-white"
              />
              <button
                onClick={handleAdd}
                disabled={adding || !newName.trim()}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50 transition-all"
                style={{ background: accentColor }}
              >
                {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add'}
              </button>
              <button
                onClick={() => { setShowAdd(false); setNewName(''); }}
                className="px-2.5 py-1.5 rounded-lg text-xs border border-slate-200 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Items — free vertical stack, no container */}
      {disabled && disabledMsg ? (
        <p className="text-xs text-slate-400 font-medium py-2 pl-1">{disabledMsg}</p>
      ) : loading ? (
        <div className="flex items-center py-3 pl-1">
          <Loader2 className="w-4 h-4 animate-spin text-[#557486]" />
        </div>
      ) : (
        <>
          {items.length > 5 && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white rounded-xl border border-slate-200">
              <Search className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={placeholder}
                className="flex-1 text-xs bg-transparent focus:outline-none text-slate-600 placeholder-slate-400"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-400 py-1 pl-1">{search ? 'No matches found' : 'No items available'}</p>
            ) : (
              filtered.map(item => {
                const isOn = selected.includes(item);
                return (
                  <div
                    key={item}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-semibold transition-all group ${
                      isOn
                        ? 'text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-100 hover:border-slate-200'
                    }`}
                    style={isOn ? { background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)` } : {}}
                  >
                    <button
                      onClick={() => onToggle(item)}
                      className="flex items-center gap-2.5 flex-1 text-left min-w-0"
                    >
                      <div
                        className={`w-4 h-4 rounded-md flex items-center justify-center flex-shrink-0 border transition-all ${
                          isOn ? 'bg-white/25 border-white/40' : 'border-slate-300 bg-white group-hover:border-slate-400'
                        }`}
                      >
                        {isOn && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                      </div>
                      <span className="truncate" style={{ fontSize: '0.75rem' }}>{item}</span>
                    </button>
                    {isOn && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggle(item); }}
                        className="flex-shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors"
                        title="Remove"
                      >
                        <svg className="w-3.5 h-3.5 text-red-300 hover:text-red-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export function BookingModal({ isOpen, onClose, onSuccess, testBench, currentUserId, refreshTrigger }: BookingModalProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState(today.getDate());

  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [availableSlots, setAvailableSlots] = useState<{ start: string; end: string; booked: boolean; bookedBy?: string; team?: string }[]>(defaultTimeSlots);
  const [expandedBookedSlot, setExpandedBookedSlot] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const [teams, setTeams] = useState<Team[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [loadingDomains, setLoadingDomains] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch teams + activities on open ──
  useEffect(() => {
    if (isOpen && testBench?.project) {
      fetchTeamsAndActivities();
    }
  }, [isOpen, testBench?.project]);

  // ── Reset on close ──
  useEffect(() => {
    if (!isOpen) {
      setSelectedTeam('');
      setSelectedDomains([]);
      setSelectedActivities([]);
      setSelectedFile(null);
      setSelectedTimeSlots([]);
      setDomains([]);
    }
  }, [isOpen]);

  // ── Fetch domains when team changes ──
  useEffect(() => {
    if (!selectedTeam) { setDomains([]); return; }
    const team = teams.find(t => t.name === selectedTeam);
    if (!team) return;
    setLoadingDomains(true);
    setSelectedDomains([]);
    getDomains({ team: team.id })
      .then(res => {
        const data: Domain[] = res.data.results || res.data;
        setDomains(data);
      })
      .catch(() => setDomains([]))
      .finally(() => setLoadingDomains(false));
  }, [selectedTeam, teams]);

  const fetchTeamsAndActivities = async () => {
    setLoadingTeams(true);
    setLoadingActivities(true);
    try {
      const [teamsRes, activitiesRes] = await Promise.all([
        getTeams({ project: testBench.project }),
        getActivities(),
      ]);
      const teamsData: Team[] = teamsRes.data.results || teamsRes.data;
      const activitiesData: Activity[] = activitiesRes.data.results || activitiesRes.data;
      setTeams(teamsData);
      setActivities(activitiesData);
    } catch (error) {
      console.error('Failed to fetch teams/activities:', error);
    } finally {
      setLoadingTeams(false);
      setLoadingActivities(false);
    }
  };

  // ── Available time slots ──
  const fetchAvailableSlots = async () => {
    if (!testBench?.id) return;
    setLoadingSlots(true);
    try {
      const formattedDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`;
      const response = await getAvailableTimeSlots(testBench.id, formattedDate);
      const allTimeSlots = [
        { start: '08:00', end: '08:30' }, { start: '08:30', end: '09:00' },
        { start: '09:00', end: '09:30' }, { start: '09:30', end: '10:00' },
        { start: '10:00', end: '10:30' }, { start: '10:30', end: '11:00' },
        { start: '11:00', end: '11:30' }, { start: '11:30', end: '12:00' },
        { start: '12:00', end: '12:30' }, { start: '12:30', end: '13:00' },
        { start: '13:00', end: '13:30' }, { start: '13:30', end: '14:00' },
        { start: '14:00', end: '14:30' }, { start: '14:30', end: '15:00' },
        { start: '15:00', end: '15:30' }, { start: '15:30', end: '16:00' },
        { start: '16:00', end: '16:30' }, { start: '16:30', end: '17:00' },
        { start: '17:00', end: '17:30' }, { start: '17:30', end: '18:00' },
      ];
      const availableStartTimes = response.data.available_slots || [];
      const bookedSlotsInfo: Record<string, { booked_by: string | null; team: string | null }> = response.data.booked_slots_info || {};
      const updatedSlots = allTimeSlots.map(slot => {
        const slotKey = `${slot.start}:00`;
        const isBooked = !availableStartTimes.includes(slotKey);
        const info = bookedSlotsInfo[slotKey];
        return { ...slot, booked: isBooked, bookedBy: info?.booked_by ?? undefined, team: info?.team ?? undefined };
      });
      setAvailableSlots(updatedSlots);
    } catch {
      setAvailableSlots(defaultTimeSlots);
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (isOpen && testBench?.id && selectedDate) fetchAvailableSlots();
  }, [isOpen, testBench?.id, selectedDate, currentMonth, currentYear, refreshTrigger]);

  useEffect(() => { setSelectedTimeSlots([]); }, [selectedDate]);

  // ── Add handlers ──
  const handleAddTeam = async (name: string) => {
    if (!testBench?.project) return;
    await createTeam({ name, project: testBench.project });
    await fetchTeamsAndActivities();
    setSelectedTeam(name);
  };

  const handleAddActivity = async (name: string) => {
    await createActivity({ name });
    await fetchTeamsAndActivities();
    setSelectedActivities(prev => [...prev, name]);
  };

  const handleAddDomain = async (name: string) => {
    const team = teams.find(t => t.name === selectedTeam);
    if (!team) return;
    await createDomain({ name, team: team.id });
    // Refresh domains
    const res = await getDomains({ team: team.id });
    const data: Domain[] = res.data.results || res.data;
    setDomains(data);
    setSelectedDomains([name]);
  };

  // ── Toggle helpers ──
  const toggleTeam = (name: string) => {
    setSelectedTeam(prev => prev === name ? '' : name);
    setSelectedDomains([]);
    setValidationErrors([]);
  };

  const toggleDomain = (name: string) => {
    setSelectedDomains(prev => prev.includes(name) ? [] : [name]);
    setValidationErrors([]);
  };

  const toggleActivity = (name: string) => {
    setSelectedActivities(prev => prev.includes(name) ? prev.filter(a => a !== name) : [...prev, name]);
    setValidationErrors([]);
  };

  const toggleTimeSlot = (slot: { start: string; end: string }) => {
    const slotKey = `${slot.start}-${slot.end}`;
    setSelectedTimeSlots(prev => prev.includes(slotKey) ? prev.filter(s => s !== slotKey) : [...prev, slotKey]);
    setValidationErrors([]);
  };

  // ── Calendar ──
  const handlePrevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const handleNextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
  const calendarDays: { day: number; isCurrentMonth: boolean; isSelected: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) calendarDays.push({ day: daysInPrevMonth - i, isCurrentMonth: false, isSelected: false });
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push({ day: i, isCurrentMonth: true, isSelected: i === selectedDate });
  const remaining = 42 - calendarDays.length;
  for (let i = 1; i <= remaining; i++) calendarDays.push({ day: i, isCurrentMonth: false, isSelected: false });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) { setSelectedFile(e.target.files[0]); setValidationErrors([]); }
  };

  const getDayName = (date: number) => daysOfWeek[new Date(currentYear, currentMonth, date).getDay()];
  const formatDate = () => {
    const s = (n: number) => (n >= 11 && n <= 13) ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
    return `${getDayName(selectedDate)} ${selectedDate}${s(selectedDate)} ${months[currentMonth]}`;
  };

  // ── Submit ──
  const handleConfirmBooking = async () => {
    const errors: string[] = [];
    if (!selectedTimeSlots.length) errors.push('At least one time slot must be selected');
    if (!selectedTeam) errors.push('A team must be selected');
    if (!selectedDomains.length) errors.push('A domain must be selected');
    if (!selectedActivities.length) errors.push('At least one activity must be selected');
    if (!selectedFile) errors.push('A test case file must be attached');
    if (!currentUserId) errors.push('You must be logged in to make a booking');
    if (errors.length > 0) { setValidationErrors(errors); return; }
    setValidationErrors([]);
    setIsSubmitting(true);
    try {
      let fileBase64 = null;
      if (selectedFile) {
        fileBase64 = await new Promise<string | ArrayBuffer | null>(resolve => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(selectedFile);
        });
      }
      const formattedDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`;
      const formatTime = (t: string) => { const [h, m] = t.split(':'); return `${h}:${m}:00`; };
      const bookingPromises = selectedTimeSlots.map(slotKey => {
        const [start, end] = slotKey.split('-');
        return createBookingRequest({
          testbench: testBench.id,
          date: formattedDate,
          time_slot_start: formatTime(start),
          time_slot_end: formatTime(end),
          team: selectedTeam,
          domain: selectedDomains.join(', '),
          activity: selectedActivities.join(', '),
          test_case_file: fileBase64,
          test_case_filename: selectedFile ? selectedFile.name : null,
          user: currentUserId,
        });
      });
      await Promise.all(bookingPromises);
      alert(`Booking confirmed for ${selectedTimeSlots.length} time slot(s)!`);
      onSuccess?.();
      handleClose();
    } catch (error: any) {
      alert(error.response?.data ? `Failed: ${JSON.stringify(error.response.data)}` : 'Failed to create booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedTimeSlots([]);
    setSelectedFile(null);
    setSelectedDomains([]);
    setSelectedActivities([]);
    setSelectedTeam('');
    onClose();
  };

  if (!isOpen) return null;

  const teamNames = teams.map(t => t.name);
  const domainNames = domains.map(d => d.name);
  const activityNames = activities.map(a => a.name);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col z-50"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-[#1A365B]">Book {testBench.name || testBench.badge}</h2>
                {testBench.project && (
                  <span className="text-xs font-bold text-[#557486] bg-[#EFF6FF] px-2 py-0.5 rounded-full mt-1 inline-block">
                    {testBench.project}
                  </span>
                )}
              </div>
              <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-6">

                {/* ── LEFT: Calendar + Team + Domain + Activity + File ── */}
                <div className="space-y-4">
                  <h3 className="font-bold text-[#1A365B] text-sm">Date</h3>

                  {/* Calendar nav */}
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={handlePrevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                      <ChevronLeft className="w-5 h-5 text-[#354D6F]" />
                    </button>
                    <span className="font-bold text-[#1A365B] text-sm">{months[currentMonth]} {currentYear}</span>
                    <button onClick={handleNextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                      <ChevronRight className="w-5 h-5 text-[#354D6F]" />
                    </button>
                  </div>

                  {/* Calendar grid */}
                  <div className="mb-4">
                    <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                      {daysOfWeek.map(day => (
                        <div key={day} className="text-center text-xs font-bold text-gray-600 py-1">{day}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {calendarDays.map((day, index) => {
                        const isPastDate = day.isCurrentMonth && (() => {
                          const d = new Date(currentYear, currentMonth, day.day);
                          const t = new Date(); t.setHours(0, 0, 0, 0);
                          return d < t;
                        })();
                        return (
                          <button
                            key={index}
                            onClick={() => day.isCurrentMonth && !isPastDate && setSelectedDate(day.day)}
                            className={`aspect-square flex items-center justify-center rounded-lg text-xs font-bold transition-all
                              ${day.isCurrentMonth ? 'text-[#1A365B]' : 'text-gray-300'}
                              ${day.isSelected ? 'bg-green-500 text-white' : 'hover:bg-gray-100'}
                              ${isPastDate ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                            disabled={isPastDate}
                          >
                            {day.day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Team scroll list ── */}
                  <ScrollList
                    label="Team"
                    items={teamNames}
                    selected={selectedTeam ? [selectedTeam] : []}
                    multiSelect={false}
                    onToggle={toggleTeam}
                    onAddNew={handleAddTeam}
                    loading={loadingTeams}
                    accentColor="#354D6F"
                    placeholder="Search teams..."
                  />

                  {/* ── Activity scroll list (multi-select) ── */}
                  <ScrollList
                    label="Activities (select one or more)"
                    items={activityNames}
                    selected={selectedActivities}
                    multiSelect={true}
                    onToggle={toggleActivity}
                    onAddNew={handleAddActivity}
                    loading={loadingActivities}
                    accentColor="#2563EB"
                    placeholder="Search activities..."
                  />

                  {/* File Upload */}
                  <div>
                    <h3 className="font-bold text-[#1A365B] mb-2 text-sm">Test Case File</h3>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 hover:border-[#557486] transition-colors">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Upload className="w-4 h-4 text-gray-400" />
                        <span className="text-xs font-bold text-[#354D6F]">Attach test case file</span>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="ml-auto px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300"
                        >
                          Choose File
                        </button>
                        <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xlsx" onChange={handleFileChange} className="hidden" />
                      </label>
                      <div className="mt-1.5 text-xs text-gray-500">{selectedFile ? selectedFile.name : 'No file chosen'}</div>
                    </div>
                  </div>
                </div>

                {/* ── RIGHT: Time Slots ── */}
                <div className="space-y-3">
                  <h3 className="font-bold text-[#1A365B] text-sm">{formatDate()}</h3>
                  <p className="text-xs text-gray-500">Select one or more time slots</p>

                  <div className="space-y-2 max-h-[480px] overflow-y-auto pr-2">
                    {loadingSlots ? (
                      <div className="flex justify-center py-8">
                        <div className="w-6 h-6 border-2 border-[#557486] border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      availableSlots.map((slot, index) => {
                        const slotKey = `${slot.start}-${slot.end}`;
                        const isSelected = selectedTimeSlots.includes(slotKey);
                        const isExpanded = expandedBookedSlot === slotKey;
                        const slotDate = new Date(currentYear, currentMonth, selectedDate);
                        const expired = isTimeSlotExpired(slotDate, slot.end);
                        const dateExpired = isDateExpired(slotDate);
                        const isDisabled = slot.booked || expired || dateExpired;
                        let disabledReason = '';
                        if (slot.booked) disabledReason = 'BOOKED';
                        else if (expired) disabledReason = 'EXPIRED';
                        else if (dateExpired) disabledReason = 'PAST DATE';

                        return (
                          <div key={index} className="flex flex-col gap-0.5">
                            <button
                              onClick={() => {
                                if (isDisabled) {
                                  if (expired) alert('This time slot has already ended and cannot be booked.');
                                  else if (dateExpired) alert('Cannot book slots on past dates.');
                                  else if (slot.booked) setExpandedBookedSlot(isExpanded ? null : slotKey);
                                } else {
                                  toggleTimeSlot(slot);
                                }
                              }}
                              className={`w-full p-2.5 rounded-lg font-bold text-xs transition-all flex items-center justify-between
                                ${isDisabled && !slot.booked ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                                  : slot.booked ? (isExpanded ? 'bg-gray-300 text-gray-600 ring-2 ring-gray-400' : 'bg-gray-200 text-gray-400 cursor-pointer')
                                  : isSelected ? 'bg-[#557486] text-white' : 'bg-white border-2 border-gray-300 text-[#354D6F] hover:border-[#557486]'}`}
                              disabled={isDisabled && !slot.booked}
                            >
                              <span>{slot.start} - {slot.end}</span>
                              {disabledReason && (
                                <span className={`text-xs font-extrabold uppercase tracking-widest ${disabledReason === 'EXPIRED' || disabledReason === 'PAST DATE' ? 'text-red-500' : 'text-orange-500'}`}>
                                  {disabledReason}
                                </span>
                              )}
                              {slot.booked && !disabledReason && <span className="text-red-500 text-xs font-extrabold uppercase tracking-widest">BOOKED</span>}
                              {!isDisabled && isSelected && <Check className="w-3 h-3 text-white" />}
                            </button>
                            {slot.booked && isExpanded && (slot.bookedBy || slot.team) && (
                              <div className="px-2.5 py-1.5 bg-gray-100 rounded-md border border-gray-200 flex items-center gap-1.5">
                                <span className="text-[10px] text-gray-500 font-medium">
                                  {[slot.bookedBy, slot.team].filter(Boolean).join(' · ')}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* ── Domain scroll list ── */}
                  <ScrollList
                    label="Domain"
                    items={domainNames}
                    selected={selectedDomains}
                    multiSelect={false}
                    onToggle={toggleDomain}
                    onAddNew={selectedTeam ? handleAddDomain : undefined}
                    loading={loadingDomains}
                    disabled={!selectedTeam}
                    disabledMsg="Select a team first"
                    accentColor="#557486"
                    placeholder="Search domains..."
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 flex-shrink-0">
              {/* Validation error banner */}
              {validationErrors.length > 0 && (
                <div className="mx-4 mt-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 flex gap-3 items-start">
                  <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <div>
                    <p className="text-sm font-bold text-red-700 mb-1">Please complete the following before confirming:</p>
                    <ul className="space-y-0.5">
                      {validationErrors.map((err, i) => (
                        <li key={i} className="text-xs text-red-600 flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                          {err}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              <div className="p-4 flex items-center justify-end gap-3">
                <button onClick={handleClose} className="px-5 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold uppercase text-sm hover:bg-gray-300">
                  CANCEL
                </button>
                <button
                  onClick={handleConfirmBooking}
                  disabled={isSubmitting || selectedTimeSlots.length === 0 || !selectedTeam || selectedActivities.length === 0}
                  className={`px-5 py-2 rounded-lg font-bold uppercase text-sm transition-all flex items-center gap-2
                    ${selectedTimeSlots.length > 0 && selectedTeam && selectedActivities.length > 0 && !isSubmitting
                      ? 'bg-gradient-to-r from-pink-500 to-red-500 text-white hover:shadow-lg'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                >
                  {isSubmitting
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>SUBMITTING...</span></>
                    : <span>CONFIRM BOOKING ({selectedTimeSlots.length})</span>}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
