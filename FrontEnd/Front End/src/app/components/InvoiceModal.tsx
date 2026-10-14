// InvoiceModal.tsx
import { X, Download, Upload, FileText, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef } from 'react';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string | null;
  invoicePdf: string | null;
  ecuId: string;
  ecuSerial?: string;
  onUpdate: (invoiceId: string, pdfBase64: string | null) => Promise<void>;
}

export function InvoiceModal({ 
  isOpen, 
  onClose, 
  invoiceId, 
  invoicePdf, 
  ecuId,
  ecuSerial,
  onUpdate 
}: InvoiceModalProps) {
  const [newInvoiceId, setNewInvoiceId] = useState(invoiceId || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(invoicePdf || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size too large. Maximum 10MB.');
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      alert('Please select a valid PDF file');
    }
  };

  const handleDownload = () => {
    if (previewUrl) {
      const link = document.createElement('a');
      link.href = previewUrl;
      link.download = `invoice_${newInvoiceId || ecuId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleSave = async () => {
    if (!newInvoiceId.trim()) {
      alert('Please enter an Invoice ID');
      return;
    }

    setIsSubmitting(true);
    try {
      let pdfBase64 = previewUrl;
      
      // If a new file was selected, convert to base64
      if (selectedFile) {
        const reader = new FileReader();
        pdfBase64 = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(selectedFile);
        });
      }
      
      await onUpdate(newInvoiceId.trim(), pdfBase64 || null);
      onClose();
    } catch (error) {
      console.error('Failed to save invoice:', error);
      alert('Failed to save invoice. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (confirm('Remove the invoice? This action cannot be undone.')) {
      setIsSubmitting(true);
      try {
        await onUpdate('', null);
        setNewInvoiceId('');
        setSelectedFile(null);
        setPreviewUrl(null);
        onClose();
      } catch (error) {
        console.error('Failed to remove invoice:', error);
        alert('Failed to remove invoice. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleClose = () => {
    setNewInvoiceId(invoiceId || '');
    setSelectedFile(null);
    setPreviewUrl(invoicePdf || null);
    onClose();
  };

  const hasInvoice = invoiceId || previewUrl;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-50 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-4 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #1A365B, #0F2440)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-white" />
                  <div>
                    <h2 className="text-base font-bold text-white">Invoice Details</h2>
                    <p className="text-xs text-white/70">
                      ECU: {ecuSerial ? `${ecuSerial} (${ecuId})` : ecuId}
                    </p>
                  </div>
                </div>
                <button onClick={handleClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Invoice ID */}
              <div>
                <label className="block text-xs font-bold text-[#354D6F] mb-2 uppercase tracking-wide">
                  Invoice ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newInvoiceId}
                  onChange={(e) => setNewInvoiceId(e.target.value)}
                  placeholder="Enter Invoice ID (e.g., INV-2024-001)"
                  className="w-full px-4 py-2.5 bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-xl focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 text-sm transition-all"
                />
              </div>

              {/* PDF Upload */}
              <div>
                <label className="block text-xs font-bold text-[#354D6F] mb-2 uppercase tracking-wide">
                  Invoice PDF
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#BAC8D1] rounded-xl p-6 text-center cursor-pointer hover:border-[#2563EB] hover:bg-[#F8FAFC] transition-all"
                >
                  {previewUrl ? (
                    <div className="space-y-2">
                      <FileText className="w-10 h-10 text-green-500 mx-auto" />
                      <p className="text-sm text-green-600 font-medium">PDF uploaded</p>
                      <p className="text-xs text-gray-400">{selectedFile?.name || 'Invoice file'}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          setPreviewUrl(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="text-xs text-red-500 hover:text-red-600 font-medium"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-10 h-10 text-[#95A4AE] mx-auto" />
                      <p className="text-sm text-[#557486] font-medium">Click to upload PDF</p>
                      <p className="text-xs text-[#BAC8D1]">PDF files only, max 10MB</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* PDF Preview */}
              {previewUrl && (
                <div>
                  <label className="block text-xs font-bold text-[#354D6F] mb-2 uppercase tracking-wide">
                    Preview
                  </label>
                  <div className="border border-[#E2E8F0] rounded-xl overflow-hidden bg-gray-50 h-80">
                    <iframe
                      src={previewUrl}
                      title="Invoice Preview"
                      className="w-full h-full"
                    />
                  </div>
                </div>
              )}

              {/* Info Message */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-blue-700">Information</p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      The invoice PDF will be stored securely in the database. 
                      You can download, update, or remove it at any time.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex-shrink-0">
              {hasInvoice && (
                <button
                  onClick={handleDownload}
                  disabled={isSubmitting || !previewUrl}
                  className="px-4 py-2 border-2 border-[#2563EB] text-[#2563EB] rounded-xl font-bold text-sm hover:bg-[#2563EB] hover:text-white transition-all disabled:opacity-50 flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              )}
              {hasInvoice && (
                <button
                  onClick={handleRemove}
                  disabled={isSubmitting}
                  className="px-4 py-2 border-2 border-red-500 text-red-500 rounded-xl font-bold text-sm hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </button>
              )}
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 border-2 border-[#E2E8F0] text-[#475569] rounded-xl font-bold text-sm hover:bg-white hover:border-[#CBD5E1] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!newInvoiceId.trim() || isSubmitting}
                className="px-5 py-2 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                style={{
                  background: !newInvoiceId.trim() || isSubmitting
                    ? '#94a3b8'
                    : 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Save Invoice
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}