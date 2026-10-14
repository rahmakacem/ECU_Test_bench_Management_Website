import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, X, AlertCircle } from 'lucide-react';
import bmwIcon from '../../assets/091cf308e34181d10b6fc9c4cd2b602d42976135.png';
import measurementIcon from '../../assets/62aac5eef65ee4edfc98901c3aee7d933d78e723.png';
import powerVoltIcon from '../../assets/a32ee87fda46b4601dc2e2a8c5818cae2891adac.png';
import { AddCategoryModal } from './AddCategoryModal';

interface CategorySelectionProps {
  onSelectCategory: (category: string) => void;
  project: string;
}

// ── Hardcoded base categories (always visible in every project) ──
const HARDCODED_CATEGORIES = [
  {
    id: 'BMW',
    title: 'BMW',
    description: 'Select the BMW platform for your configuration.',
    buttonText: 'Configure BMW',
    icon: bmwIcon,
    bgColor: '#6B8396',
    buttonColor: '#4A5F73',
    isCustom: false,
  },
  {
    id: 'Measurement Style',
    title: 'Measurement Style',
    description: 'Select The Measurement Style Platform for your configuration.',
    buttonText: 'Configure Measurement',
    icon: measurementIcon,
    bgColor: '#C5CDD4',
    buttonColor: '#8B99A8',
    isCustom: false,
  },
  {
    id: 'Power Supply',
    title: 'Power Supply',
    description: 'Select the Power Supply Platform for your configuration.',
    buttonText: 'Configure Power Supply',
    icon: powerVoltIcon,
    bgColor: '#A77474',
    buttonColor: '#8B5858',
    isCustom: false,
  },
];

// Color cycle for custom categories
const COLOR_CYCLE = [
  { bgColor: '#557486', buttonColor: '#354D6F' },
  { bgColor: '#7594A4', buttonColor: '#557486' },
  { bgColor: '#936363', buttonColor: '#7A4F4F' },
  { bgColor: '#6B8396', buttonColor: '#4A5F73' },
  { bgColor: '#95A4AE', buttonColor: '#7594A4' },
];

interface CustomCategory {
  dbId: number;
  id: string;
  title: string;
  icon: string | null;
  bgColor: string;
  buttonColor: string;
}

// ── Toast confirm ──
function ToastConfirm({ title, onConfirm, onCancel, isDeleting }: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2"
      style={{ minWidth: 380 }}
    >
      <div
        className="flex items-start gap-3 rounded-2xl px-5 py-4 shadow-2xl border border-red-200"
        style={{ background: 'linear-gradient(135deg, #fff5f5 0%, #ffffff 100%)' }}
      >
        <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#354D6F]">Delete "{title}"?</p>
          <p className="text-xs text-[#64748B] mt-0.5">
            This will permanently remove the category and all its subcategories from this project.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-60"
              style={{ background: isDeleting ? '#94a3b8' : 'linear-gradient(135deg, #dc2626, #b91c1c)' }}
            >
              {isDeleting ? (
                <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Deleting…</>
              ) : (
                <><Trash2 className="w-3 h-3" />Yes, Delete</>
              )}
            </button>
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-[#475569] bg-[#F1F5F9] hover:bg-[#E2E8F0] transition-all disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
        <button onClick={onCancel} disabled={isDeleting} className="flex-shrink-0 p-1 hover:bg-red-100 rounded-lg transition-colors">
          <X className="w-4 h-4 text-[#94A3B8]" />
        </button>
      </div>
    </motion.div>
  );
}

export function CategorySelection({ onSelectCategory, project }: CategorySelectionProps) {
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CustomCategory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Fetch custom categories from DB for this project ──
  useEffect(() => {
    if (!project) return;
    fetch(`http://localhost:8001/api/categories/`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const rows: { id: number; name: string }[] = data.results ?? data;
        // Filter out hardcoded ones
        const hardcodedNames = new Set(HARDCODED_CATEGORIES.map(c => c.id.toLowerCase()));
        const custom = rows
          .filter(r => !hardcodedNames.has(r.name.toLowerCase()))
          .map((r, idx) => {
            const style = COLOR_CYCLE[idx % COLOR_CYCLE.length];
            return {
              dbId: r.id,
              id: r.name,
              title: r.name,
              icon: null,
              bgColor: style.bgColor,
              buttonColor: style.buttonColor,
            };
          });
        setCustomCategories(custom);
      })
      .catch(() => setCustomCategories([]));
  }, [project]);

  // ── Handle new category saved ──
  const handleCategorySaved = (saved: { id: number; name: string; icon: string | null }) => {
    const style = COLOR_CYCLE[customCategories.length % COLOR_CYCLE.length];
    setCustomCategories(prev => [...prev, {
      dbId: saved.id,
      id: saved.name,
      title: saved.name,
      icon: saved.icon,
      bgColor: style.bgColor,
      buttonColor: style.buttonColor,
    }]);
  };

  // ── Handle delete ──
  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const csrfToken = localStorage.getItem('csrfToken') || '';
      const res = await fetch(`http://localhost:8001/api/categories/${pendingDelete.dbId}/`, {
        method: 'DELETE',
        headers: { 'X-CSRFToken': csrfToken },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete');
      setCustomCategories(prev => prev.filter(c => c.dbId !== pendingDelete.dbId));
      setPendingDelete(null);
    } catch {
      alert('Failed to delete category. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const allCategories = [...HARDCODED_CATEGORIES];

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="min-h-screen flex items-center justify-center p-8"
      >
        <div className="max-w-7xl w-full">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-[#354D6F] mb-4">Choose Your Category</h1>

          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-3 gap-8 mb-8">
            {/* Hardcoded categories */}
            {allCategories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
                onClick={() => onSelectCategory(category.id)}
                className="cursor-pointer relative group"
              >
                <div
                  className="rounded-2xl p-8 flex flex-col items-center text-center shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 h-[380px]"
                  style={{ backgroundColor: category.bgColor }}
                >
                  <div className="mb-6 flex items-center justify-center h-32">
                    <img src={category.icon} alt={category.title} className="w-32 h-32 object-contain" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">{category.title}</h3>
                  <p className="text-base text-white/90 mb-6 flex-grow leading-relaxed">{category.description}</p>
                  <button
                    className="w-full py-3 px-6 rounded-lg font-bold text-white uppercase transition-all hover:shadow-lg text-sm mt-auto"
                    style={{ backgroundColor: category.buttonColor }}
                    onClick={(e) => { e.stopPropagation(); onSelectCategory(category.id); }}
                  >
                    {category.buttonText}
                  </button>
                </div>
              </motion.div>
            ))}

            {/* Custom categories from DB */}
            {customCategories.map((category, index) => (
              <motion.div
                key={category.dbId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (allCategories.length + index) * 0.1, duration: 0.4 }}
                onClick={() => onSelectCategory(category.id)}
                className="cursor-pointer relative group"
              >
                <div
                  className="rounded-2xl p-8 flex flex-col items-center text-center shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 h-[380px]"
                  style={{ backgroundColor: category.bgColor }}
                >
                  {/* Delete button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setPendingDelete(category); }}
                    className="absolute top-3 right-3 w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>

                  <div className="mb-6 flex items-center justify-center h-32">
                    {category.icon ? (
                      <img src={category.icon} alt={category.title} className="w-32 h-32 object-contain" />
                    ) : (
                      <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center">
                        <span className="text-4xl font-bold text-white">
                          {category.title.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">{category.title}</h3>

                  <button
                    className="w-full py-3 px-6 rounded-lg font-bold text-white uppercase transition-all hover:shadow-lg text-sm mt-auto"
                    style={{ backgroundColor: category.buttonColor }}
                    onClick={(e) => { e.stopPropagation(); onSelectCategory(category.id); }}
                  >
                    Configure {category.title}
                  </button>
                </div>
              </motion.div>
            ))}

            {/* Ghost Add Category Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (allCategories.length + customCategories.length) * 0.1, duration: 0.4 }}
              onClick={() => setIsAddModalOpen(true)}
              className="cursor-pointer"
            >
              <div className="rounded-2xl p-8 flex flex-col items-center text-center border-2 border-dashed border-[#BAC8D1] bg-[#E0E0E0] hover:bg-gray-300 hover:border-[#557486] transition-all duration-300 hover:-translate-y-2 h-[380px]">
                <div className="mb-6 flex items-center justify-center h-32">
                  <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center">
                    <Plus className="w-12 h-12 text-[#354D6F]" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-[#354D6F] mb-3">Add Category</h3>
                <p className="text-base text-gray-600 mb-6 flex-grow leading-relaxed">
                  Add a new category to your configuration
                </p>
                <button
                  className="w-full py-3 px-6 rounded-lg font-bold text-white bg-[#557486] uppercase transition-all hover:shadow-lg hover:bg-[#354D6F] text-sm mt-auto"
                  onClick={(e) => { e.stopPropagation(); setIsAddModalOpen(true); }}
                >
                  Create New
                </button>
              </div>
            </motion.div>
          </div>

          <p className="text-center text-gray-500 text-sm">You can change your selection at any time.</p>
        </div>
      </motion.div>

      {/* Add Category Modal */}
      <AddCategoryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        project={project}
        onSaved={handleCategorySaved}
      />

      {/* Delete Toast */}
      <AnimatePresence>
        {pendingDelete && (
          <ToastConfirm
            title={pendingDelete.title}
            onConfirm={handleConfirmDelete}
            onCancel={() => { if (!isDeleting) setPendingDelete(null); }}
            isDeleting={isDeleting}
          />
        )}
      </AnimatePresence>
    </>
  );
}
