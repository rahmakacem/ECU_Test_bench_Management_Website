import { X, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef } from 'react';

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: string;
  onSaved: (category: { id: number; name: string; icon: string | null }) => void;
}

export function AddCategoryModal({ isOpen, onClose, project, onSaved }: AddCategoryModalProps) {
  const [categoryName, setCategoryName] = useState('');
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setIconPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!categoryName.trim()) return;
    setIsSaving(true);
    setError('');
    try {
      const csrfToken = localStorage.getItem('csrfToken') || '';
      const res = await fetch('http://localhost:8001/api/categories/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
        credentials: 'include',
        body: JSON.stringify({ name: categoryName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.name?.[0] || 'Failed to save category');
      }
      const saved = await res.json();
      onSaved({ id: saved.id, name: saved.name, icon: iconPreview });
      handleCancel();
    } catch (err: any) {
      setError(err.message || 'Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setCategoryName('');
    setIconPreview(null);
    setError('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCancel}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-50 w-full max-w-md"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4 rounded-t-2xl"
              style={{ background: 'linear-gradient(135deg, #354D6F, #1A365B)' }}
            >
              <div>
                <h2 className="text-base font-bold text-white uppercase tracking-wide">Add New Category</h2>
                <p className="text-xs text-white/70 mt-0.5">Adding to Project {project}</p>
              </div>
              <button onClick={handleCancel} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-5">
              {/* Category Name */}
              <div>
                <label className="block text-xs font-bold text-[#354D6F] mb-1.5 uppercase tracking-wide">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="e.g. Measurement Style"
                  className="w-full px-3 py-2.5 border-2 border-[#BAC8D1] rounded-lg focus:outline-none focus:border-[#557486] text-sm"
                />
              </div>

              {/* Upload Icon */}
              <div>
                <label className="block text-xs font-bold text-[#354D6F] mb-1.5 uppercase tracking-wide">
                  Upload Icon (Optional)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#BAC8D1] rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-[#557486] hover:bg-[#F5F0E8]/30 transition-all"
                >
                  {iconPreview ? (
                    <img src={iconPreview} alt="Preview" className="w-16 h-16 object-contain" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-[#95A4AE] mb-2" />
                      <span className="text-sm text-[#95A4AE]">Click to upload icon</span>
                      <span className="text-xs text-[#BAC8D1] mt-1">PNG, JPG, SVG</span>
                    </>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </div>

              {error && (
                <p className="text-xs text-red-500 font-medium">{error}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#BAC8D1]">
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="px-4 py-2 border-2 border-[#BAC8D1] text-[#354D6F] rounded-lg font-bold text-sm hover:bg-[#F5F0E8] transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!categoryName.trim() || isSaving}
                className="px-4 py-2 bg-[#354D6F] text-white rounded-lg font-bold text-sm hover:bg-[#1A365B] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving…
                  </>
                ) : 'Save Category'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
