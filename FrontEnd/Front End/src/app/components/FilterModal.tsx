import { X, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: any) => void;
}

export function FilterModal({ isOpen, onClose, onApplyFilters }: FilterModalProps) {
  const [filterStatus, setFilterStatus] = useState('');
  const [filterConnection, setFilterConnection] = useState('');
  const [filterHealthStatus, setFilterHealthStatus] = useState('');

  const handleApply = () => {
    onApplyFilters({
      status: filterStatus,
      connection: filterConnection,
      healthStatus: filterHealthStatus,
    });
    onClose();
  };

  const handleReset = () => {
    setFilterStatus('');
    setFilterConnection('');
    setFilterHealthStatus('');
  };

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

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#F5F0E8] rounded-xl shadow-2xl z-50 w-full max-w-md"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#BAC8D1] bg-[#354D6F] rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-white" />
                  <h2 className="text-base font-bold text-white">Filter ECU Table</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="p-4 space-y-3">
              {/* Filter by Status */}
              <div>
                <label className="block text-xs font-bold text-[#354D6F] mb-1.5 uppercase">
                  Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[#BAC8D1] rounded-lg focus:outline-none focus:border-[#557486] text-sm bg-white"
                >
                  <option value="">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Not Active">Not Active</option>
                </select>
              </div>

              {/* Filter by Connection */}
              <div>
                <label className="block text-xs font-bold text-[#354D6F] mb-1.5 uppercase">
                  Connection
                </label>
                <select
                  value={filterConnection}
                  onChange={(e) => setFilterConnection(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[#BAC8D1] rounded-lg focus:outline-none focus:border-[#557486] text-sm bg-white"
                >
                  <option value="">All Connections</option>
                  <option value="BCP21-TSP1">BCP21-TSP1</option>
                  <option value="BCP21-TSP2">BCP21-TSP2</option>
                  <option value="BCP21-TSP3">BCP21-TSP3</option>
                </select>
              </div>

              {/* Filter by Health Status */}
              <div>
                <label className="block text-xs font-bold text-[#354D6F] mb-1.5 uppercase">
                  Health Status
                </label>
                <select
                  value={filterHealthStatus}
                  onChange={(e) => setFilterHealthStatus(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[#BAC8D1] rounded-lg focus:outline-none focus:border-[#557486] text-sm bg-white"
                >
                  <option value="">All Health Statuses</option>
                  <option value="Working">Working</option>
                  <option value="Defect">Defect</option>
                  <option value="Recovered">Recovered</option>
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#BAC8D1]">
              <button
                onClick={handleReset}
                className="px-4 py-2 border-2 border-[#BAC8D1] text-[#354D6F] rounded-lg font-bold text-sm hover:bg-gray-100 transition-all"
              >
                Reset
              </button>
              <button
                onClick={handleApply}
                className="px-4 py-2 bg-[#557486] text-white rounded-lg font-bold text-sm hover:bg-[#354D6F] transition-all"
              >
                Apply
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}