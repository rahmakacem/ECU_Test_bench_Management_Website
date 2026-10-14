import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { useMemo } from 'react';

interface TbFilterState {
  project: string[];
  status: string[];
  location: string[];
  room: string[];
  type: string[];
}

interface TbFilterDropdownProps {
  isOpen: boolean;
  filters: TbFilterState;
  expandedSections: {
    project: boolean;
    status: boolean;
    location: boolean;
    room: boolean;
    type: boolean;
  };
  onToggleSection: (section: keyof TbFilterState) => void;
  onToggleFilter: (category: keyof TbFilterState, value: string) => void;
  onApply: () => void;
  onClear: () => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
  testBenches: any[];
  projects: string[];
}

export function TbFilterDropdown({
  isOpen,
  filters,
  expandedSections,
  onToggleSection,
  onToggleFilter,
  onApply,
  onClear,
  dropdownRef,
  testBenches,
  projects
}: TbFilterDropdownProps) {

  // Compute counts dynamically from testBenches
  const counts = useMemo(() => {
    return {
      project: projects.map(p => ({
        label: p,
        count: testBenches.filter(b => b.project === p).length
      })),
      status: [
        { label: 'available', displayName: 'Available Now', count: testBenches.filter(b => b.status === 'available').length },
        { label: 'in-use', displayName: 'In Use', count: testBenches.filter(b => b.status === 'in-use').length },
        { label: 'faulty', displayName: 'Defect', count: testBenches.filter(b => b.status === 'faulty').length },
        { label: 'maintenance', displayName: 'Under Maintenance', count: testBenches.filter(b => b.status === 'maintenance').length },
      ],
      location: [...new Set(testBenches.map(b => b.location).filter(Boolean))].map(loc => ({
        label: loc,
        count: testBenches.filter(b => b.location === loc).length
      })),
      room: [...new Set(testBenches.map(b => b.room).filter(Boolean))].map(rm => ({
        label: rm,
        count: testBenches.filter(b => b.room === rm).length
      })),
      type: [
        { label: 'MTS', count: testBenches.filter(b => b.bench_type === 'MTS').length },
        { label: 'BTS', count: testBenches.filter(b => b.bench_type === 'BTS').length },
      ],
    };
  }, [testBenches, projects]);

  const renderSection = (
    key: keyof TbFilterState,
    title: string,
    items: { label: string; count: number; displayName?: string }[]
  ) => (
    <div className="px-3">
      <button
        onClick={() => onToggleSection(key)}
        className="w-full flex items-center justify-between py-2 hover:bg-[#F8FAFC] rounded transition-colors"
      >
        <span className="font-bold text-[#354D6F] uppercase text-xs">{title}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#64748B] transition-transform ${expandedSections[key] ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-200 ease-in-out ${expandedSections[key] ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="space-y-0.5 py-1">
          {items.map(({ label, count, displayName }) => (
            <label
              key={label}
              className="flex items-center justify-between py-1.5 px-2 hover:bg-[#F1F5F9] rounded cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters[key].includes(label)}
                  onChange={() => onToggleFilter(key, label)}
                  className="w-3.5 h-3.5 accent-[#2563EB] rounded"
                />
                <span className="text-xs text-[#475569]">{displayName || label}</span>
              </div>
              <span className="text-xs text-[#94A3B8]">{count}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl w-[300px] z-50 border border-[#E2E8F0]"
        >
          <div className="absolute -top-2 right-6 w-4 h-4 bg-white border-l border-t border-[#E2E8F0] transform rotate-45"></div>

          <div className="max-h-[400px] overflow-y-auto py-3 space-y-0">
            {renderSection('project', 'PROJECT', counts.project)}
            <div className="h-px bg-[#E2E8F0] my-2"></div>
            {renderSection('status', 'STATUS', counts.status.map(s => ({ ...s, displayName: s.displayName })))}
            <div className="h-px bg-[#E2E8F0] my-2"></div>
            {renderSection('location', 'LOCATION (CITY)', counts.location)}
            <div className="h-px bg-[#E2E8F0] my-2"></div>
            {renderSection('room', 'ROOM', counts.room)}
            <div className="h-px bg-[#E2E8F0] my-2"></div>
            {renderSection('type', 'TYPE', counts.type)}
          </div>

          <div className="border-t border-[#E2E8F0] p-3 flex items-center gap-2 bg-white rounded-b-xl">
            <button
              onClick={onApply}
              className="flex-1 px-4 py-2 bg-[#354D6F] text-white rounded-lg font-bold text-xs hover:bg-[#1A365B] transition-all"
            >
              APPLY
            </button>
            <button
              onClick={onClear}
              className="flex-1 px-4 py-2 bg-[#E2E8F0] text-[#475569] rounded-lg font-bold text-xs hover:bg-[#CBD5E1] transition-all"
            >
              CLEAR
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}