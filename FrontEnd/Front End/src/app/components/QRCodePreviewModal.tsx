import { X, QrCode, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QRCodePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  ecuData: {
    id: string;
    ssMan: string;
    qrCode: string;
  } | null;
}

export function QRCodePreviewModal({ isOpen, onClose, ecuData }: QRCodePreviewModalProps) {
  if (!ecuData) return null;

  // qrCode is base64 string from DB — build a data URI
  const imgSrc = ecuData.qrCode
    ? ecuData.qrCode.startsWith('data:')
      ? ecuData.qrCode
      : `data:image/png;base64,${ecuData.qrCode}`
    : null;

  const handleDownload = () => {
    if (!imgSrc) return;
    const link = document.createElement('a');
    link.href = imgSrc;
    link.download = `${ecuData.ssMan || ecuData.id}_qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.18)' }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-[14px] z-50 w-full max-w-md overflow-hidden"
          >
            {/* Header with Gradient */}
            <div 
              className="px-5 py-3.5"
              style={{ background: 'linear-gradient(135deg, #334E68, #243B53)' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <QrCode className="w-5 h-5 text-white" />
                  <h2 className="text-base font-bold text-white tracking-wide">QR Code Preview</h2>
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
              {/* QR Code Image */}
              <div className="flex items-center justify-center bg-[#F8FAFC] rounded-[10px] p-8 border-2 border-[#E2E8F0]">
                {imgSrc ? (
                  <img src={imgSrc} alt="QR Code" className="w-48 h-48 object-contain" />
                ) : (
                  <div className="w-48 h-48 flex flex-col items-center justify-center text-[#94A3B8] gap-3">
                    <QrCode className="w-16 h-16 opacity-30" />
                    <span className="text-xs font-bold uppercase tracking-widest">No QR Generated</span>
                  </div>
                )}
              </div>
              <p className="text-center text-xs text-[#94A3B8] font-mono">ECU ID: {ecuData.id}</p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-3.5 bg-[#F8FAFC] border-t border-[#E2E8F0]">
              <button
                onClick={onClose}
                className="px-5 py-2.5 border-2 border-[#CBD5E1] text-[#475569] rounded-[10px] font-semibold text-sm hover:bg-white hover:border-[#94A3B8] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDownload}
                disabled={!imgSrc}
                style={imgSrc ? { background: 'linear-gradient(135deg, #2563EB, #3B82F6)' } : {}}
                className={`px-6 py-2.5 text-white rounded-[10px] font-semibold text-sm flex items-center gap-2 transition-all ${imgSrc ? 'hover:shadow-lg hover:-translate-y-0.5' : 'bg-[#CBD5E1] cursor-not-allowed'}`}
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}