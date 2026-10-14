import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { useMemo } from 'react';

interface FilterState {
  status: string[];
  healthStatus: string[];
  connection: string[];
  location: string[];
}

interface ECURow {
  status: string;
  healthStatus: string;
  connection: string;
  location: string;
}

interface FilterDropdownProps {
  isOpen: boolean;
  filters: FilterState;
  expandedSections: {
    status: boolean;
    healthStatus: boolean;
    connection: boolean;
    location: boolean;
  };
  onToggleSection: (section: keyof FilterState) => void;
  onToggleFilter: (category: keyof FilterState, value: string) => void;
  onApply: () => void;
  onClear: () => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
  tableData: ECURow[];
}

export function FilterDropdown({
  isOpen,
  filters,
  expandedSections,
  onToggleSection,
  onToggleFilter,
  onApply,
  onClear,
  dropdownRef,
  tableData
}: FilterDropdownProps) {

  // Compute counts dynamically from tableData
  const counts = useMemo(() => {
    const count = (key: keyof ECURow, value: string) =>
      tableData.filter(e => e[key] === value).length;

    // Get all unique connections and locations from tableData
    const uniqueConnections = [...new Set(tableData.map(e => e.connection).filter(Boolean))].sort();
    const uniqueLocations = [...new Set(tableData.map(e => e.location).filter(Boolean))].sort();

    return {
      status: [
        { label: 'Active', count: count('status', 'Active') },
        { label: 'Not Active', count: count('status', 'Not Active') },
      ],
      healthStatus: [
        { label: 'Working', count: count('healthStatus', 'Working') },
        { label: 'Defect', count: count('healthStatus', 'Defect') },
        { label: 'Recovered', count: count('healthStatus', 'Recovered') },
      ],
      connection: uniqueConnections.map(c => ({ label: c, count: count('connection', c) })),
      location: uniqueLocations.map(l => ({ label: l, count: count('location', l) })),
    };
  }, [tableData]);

  const renderSection = (
    key: keyof FilterState,
    title: string,
    items: { label: string; count: number }[]
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
          {items.map(({ label, count }) => (
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
                <span className="text-xs text-[#475569]">{label}</span>
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
            {renderSection('status', 'STATUS', counts.status)}
            <div className="h-px bg-[#E2E8F0] my-2"></div>
            {renderSection('healthStatus', 'HEALTH STATUS', counts.healthStatus)}
            <div className="h-px bg-[#E2E8F0] my-2"></div>
            {renderSection('connection', 'CONNECTION', counts.connection)}
            <div className="h-px bg-[#E2E8F0] my-2"></div>
            {renderSection('location', 'LOCATION', counts.location)}
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
