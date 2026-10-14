import { X, AlertTriangle, FileText, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DefectDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ecuData: {
    defectReason: string;
    hopeTicketId: string;
  } | null;
}

export function DefectDetailsModal({ isOpen, onClose, ecuData }: DefectDetailsModalProps) {
  if (!ecuData) return null;

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
            style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.18)' }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-[14px] z-50 w-full max-w-md overflow-hidden"
          >
            {/* Header with Gradient */}
            <div 
              className="px-5 py-3.5"
              style={{ background: 'linear-gradient(135deg, #B54747, #8F3838)' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-white" />
                  <h2 className="text-base font-bold text-white tracking-wide">Defect Details</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              {/* Defect Reason */}
              <div>
                <label className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-[#64748B]" />
                  <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">
                    Defect Reason
                  </span>
                </label>
                <div className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] text-sm text-[#334155]">
                  {ecuData.defectReason || 'No defect reason provided'}
                </div>
              </div>

              {/* Hope Ticket ID */}
              <div>
                <label className="flex items-center gap-2 mb-2">
                  <Hash className="w-4 h-4 text-[#64748B]" />
                  <span className="text-xs font-bold text-[#64748B] uppercase tracking-wide">
                    Hope Ticket ID
                  </span>
                </label>
                <div className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] text-sm text-[#334155] font-mono">
                  {ecuData.hopeTicketId || 'No ticket ID provided'}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-3.5 bg-[#F8FAFC] border-t border-[#E2E8F0]">
              <button
                onClick={onClose}
                style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)' }}
                className="px-6 py-2.5 text-white rounded-[10px] font-semibold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                Close
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}