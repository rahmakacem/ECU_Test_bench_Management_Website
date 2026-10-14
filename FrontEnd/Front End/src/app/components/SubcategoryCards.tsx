import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Trash2, Radio, Gauge, SquareStack, Disc, Tag, AlertTriangle, Lock, ScanFace, Sun,
  Power, Lightbulb, SquareDashedMousePointer, ArrowUpDown, Square, Waves, Atom, Zap,
  Music2, Settings2, ToggleLeft, Wrench, Circle, DoorOpen, Droplets, Maximize2, Component,
  Cpu, RectangleHorizontal, Wind, X, AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type React from 'react';
import { AddSubcategoryModal } from './AddSubcategoryModal';
import { getSubCategories, getCategories, createSubCategory } from '../services/api';
import api from '../services/api';

// ─────────────────────────── icon map ───────────────────────────
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Radio, Gauge, SquareStack, Wind, Disc, Tag, AlertTriangle, Lock, ScanFace, Sun,
  Power, Zap, Lightbulb, SquareDashedMousePointer, ArrowUpDown, Square, Waves,
  Atom, Music2, Settings2, ToggleLeft, Wrench, Circle, DoorOpen, Droplets,
  Maximize2, Component, Cpu, RectangleHorizontal,
};

const colorSequence = ['#557486', '#6B8396', '#7594A4', '#95A4AE', '#936363', '#A8BAC3'];

// ─────────────────────────── Toast ───────────────────────────
interface ToastConfirmProps {
  message: string;
  subMessage?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

function ToastConfirm({ message, subMessage, onConfirm, onCancel, isDeleting }: ToastConfirmProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2"
      style={{ minWidth: 360 }}
    >
      <div
        className="flex items-start gap-3 rounded-2xl px-5 py-4 shadow-2xl border border-red-200"
        style={{ background: 'linear-gradient(135deg, #fff5f5 0%, #ffffff 100%)' }}
      >
        <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-red-600" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#354D6F] leading-snug">{message}</p>
          {subMessage && (
            <p className="text-xs text-[#64748B] mt-0.5 leading-snug">{subMessage}</p>
          )}
          <div className="flex gap-2 mt-3">
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-60"
              style={{ background: isDeleting ? '#94a3b8' : 'linear-gradient(135deg, #dc2626, #b91c1c)' }}
            >
              {isDeleting ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="w-3 h-3" />
                  Yes, Delete
                </>
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

        <button
          onClick={onCancel}
          disabled={isDeleting}
          className="flex-shrink-0 p-1 hover:bg-red-100 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-[#94A3B8]" />
        </button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────── Props ───────────────────────────
interface SubcategoryCardsProps {
  category: string;
  project: string;
  onAddSubcategory: () => void;
  tableData?: Array<{ subCategory: string }>;
  onFilterChange?: (selected: string[]) => void;
  onCustomSubcategoriesChange?: (names: string[]) => void;
  onECUsDeleted?: () => void;
}

// ─────────────────────────── Component ───────────────────────────
export function SubcategoryCards({
  category,
  project,
  onAddSubcategory,
  tableData = [],
  onFilterChange,
  onCustomSubcategoriesChange,
  onECUsDeleted,
}: SubcategoryCardsProps) {
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [customSubcategories, setCustomSubcategories] = useState<Array<{
    id?: number;
    name: string;
    Icon: React.ComponentType<{ className?: string }>;
    color: string;
  }>>([]);

  // Toast state
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Resolve category ID ──
  useEffect(() => {
    if (!category) return;
    (async () => {
      try {
        const res = await getCategories();
        const categories: Array<{ id: number; name: string }> = res.data.results ?? res.data;
        const cat = categories.find(c => c.name.toLowerCase() === category.toLowerCase());
        if (cat) setCategoryId(cat.id);
      } catch (e) {
        console.error('Failed to resolve category ID', e);
      }
    })();
  }, [category]);

  // ── Load subcategories from DB (only database, no hardcoded) ──
  useEffect(() => {
    if (!category || !project) return;
    (async () => {
      try {
        const params: Record<string, any> = {
          category: categoryId,
          project: project
        };

        const res = await getSubCategories(params);
        const rows: Array<{ id: number; name: string; icon_name?: string; color?: string }> =
          res.data.results ?? res.data;
        
        // Ensure unique keys by using a Map (case-insensitive)
        const uniqueMap = new Map<string, typeof rows[0]>();
        rows.forEach(row => {
          const upperName = row.name.toUpperCase();
          if (!uniqueMap.has(upperName)) {
            uniqueMap.set(upperName, row);
          }
        });
        
        const uniqueRows = Array.from(uniqueMap.values());
        
        const loaded = uniqueRows.map((row, idx) => ({
          id: row.id,
          name: row.name.toUpperCase(),
          Icon: iconMap[row.icon_name ?? ''] ?? Radio,
          color: row.color ?? colorSequence[idx % colorSequence.length],
        }));
        
        setCustomSubcategories(loaded);
        onCustomSubcategoriesChange?.(loaded.map(s => s.name));
      } catch (e) {
        console.error('Failed to load subcategories from database', e);
      }
    })();
  }, [category, project, categoryId, onCustomSubcategoriesChange]);

  // ── Visible chips ──
  const visibleChips = useMemo(() => customSubcategories, [customSubcategories]);

  // ── Click-outside deselect ──
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-subcategory-container]')) {
        setSelectedSubcategories([]);
        onFilterChange?.([]);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [onFilterChange]);

  const handleDoubleClick = (name: string) => {
    setSelectedSubcategories(prev => {
      const next = prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name];
      onFilterChange?.(next);
      return next;
    });
  };

  const handleSingleClick = (name: string) => {
    if (selectedSubcategories.length > 0) {
      setSelectedSubcategories(prev => {
        const next = prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name];
        onFilterChange?.(next);
        return next;
      });
    }
  };

  // ── Open toast ──
  const handleDeleteClick = () => {
    if (selectedSubcategories.length === 0) return;
    setPendingDelete([...selectedSubcategories]);
  };

  // ── Confirmed delete ──
  const handleConfirmedDelete = useCallback(async () => {
    if (!pendingDelete || pendingDelete.length === 0) return;
    setIsDeleting(true);

    try {
      for (const subName of pendingDelete) {
        try {
          await api.post('/subcategories/delete-with-ecus/', {
            sub_category_name: subName,
            category,
            project,
          });
        } catch (err) {
          console.error(`Failed to delete subcategory "${subName}":`, err);
        }

        setCustomSubcategories(prev => {
          const updated = prev.filter(s => s.name.toLowerCase() !== subName.toLowerCase());
          onCustomSubcategoriesChange?.(updated.map(s => s.name));
          return updated;
        });
      }

      setSelectedSubcategories([]);
      onFilterChange?.([]);
      onECUsDeleted?.();
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  }, [pendingDelete, project, category, onFilterChange, onCustomSubcategoriesChange, onECUsDeleted]);

  const handleCancelDelete = () => {
    if (!isDeleting) setPendingDelete(null);
  };

  // ── Add new subcategory — saves to DB first ──
  const handleSaveFromModal = async (data: {
    name: string;
    iconName: string;
    iconFile?: File | null;
    categoryId?: number;
    project?: string;
  }) => {
    if (!data.categoryId) {
      throw new Error('Category ID is missing');
    }

    const upperName = data.name.toUpperCase();

    // ── Save to DB as custom subcategory ──
    const nextColor = colorSequence[customSubcategories.length % colorSequence.length];

    let saved: any;

    try {
      const res = await createSubCategory({
        name: upperName,
        category: data.categoryId,
        project: data.project,
        icon_name: data.iconName,
        color: nextColor,
        is_custom: true,
      });
      saved = res.data;
    } catch (err: any) {
      const isUnique = err?.response?.status === 400 && err?.response?.data?.non_field_errors;
      if (isUnique) {
        try {
          const existing = await import('../services/api').then(m =>
            m.getSubCategories({ category: data.categoryId, project: data.project })
          );
          const rows: any[] = existing.data.results ?? existing.data;
          const match = rows.find(r => r.name.toUpperCase() === upperName);
          if (match) {
            saved = match;
          } else {
            throw new Error(`Subcategory "${upperName}" already exists for this category.`);
          }
        } catch {
          throw new Error(`Subcategory "${upperName}" already exists for this category.`);
        }
      } else {
        throw err;
      }
    }

    // Check if already exists in local state to avoid duplicates
    const alreadyExists = customSubcategories.some(
      s => s.name.toLowerCase() === saved.name.toUpperCase().toLowerCase()
    );
    
    if (!alreadyExists) {
      const newEntry = {
        id: saved.id,
        name: saved.name.toUpperCase(),
        Icon: iconMap[saved.icon_name ?? data.iconName] ?? Radio,
        color: saved.color ?? nextColor,
      };

      setCustomSubcategories(prev => {
        const updated = [...prev, newEntry];
        onCustomSubcategoriesChange?.(updated.map(s => s.name));
        return updated;
      });
    }
  };

  const toastMessage = pendingDelete
    ? pendingDelete.length === 1
      ? `Delete "${pendingDelete[0]}"?`
      : `Delete ${pendingDelete.length} subcategories?`
    : '';

  const toastSubMessage = pendingDelete
    ? `All ECUs in project "${project}" / category "${category}" with ${
        pendingDelete.length === 1
          ? `subcategory "${pendingDelete[0]}"`
          : 'these subcategories'
      } will be permanently deleted.`
    : '';

  return (
    <>
      <div className="mb-6" data-subcategory-container>
        {selectedSubcategories.length > 0 && (
          <div className="flex items-center justify-end mb-2">
            <button
              onClick={handleDeleteClick}
              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-bold uppercase transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete ({selectedSubcategories.length})</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-6 gap-3 mb-4">
          {visibleChips.map((sub) => {
            const IconComponent = sub.Icon;
            const isSelected = selectedSubcategories.includes(sub.name);
            // Use id as key if available, otherwise use name with index fallback
            const uniqueKey = sub.id ? `sub-${sub.id}` : `sub-${sub.name}`;
            return (
              <div
                key={uniqueKey}
                onDoubleClick={() => handleDoubleClick(sub.name)}
                onClick={() => handleSingleClick(sub.name)}
                className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all select-none ${
                  isSelected
                    ? 'bg-[#2563EB] text-white border-none ring-2 ring-[#2563EB]/30'
                    : 'bg-[#F1F5F9] border border-[#E2E8F0] text-[#475569] hover:bg-[#E2E8F0]'
                }`}
              >
                <IconComponent
                  className="w-4 h-4"
                  style={{ color: isSelected ? 'white' : sub.color } as React.CSSProperties}
                />
                <span className={`font-semibold text-xs ${isSelected ? 'text-white' : 'text-[#475569]'}`}>
                  {sub.name}
                </span>
              </div>
            );
          })}

          <div
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer bg-gray-100 hover:bg-gray-200 transition-all border border-dashed border-gray-300"
          >
            <Plus className="w-4 h-4 text-[#557486]" />
            <span className="text-[#557486] font-semibold text-xs">Add New</span>
          </div>
        </div>

        <AddSubcategoryModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSave={handleSaveFromModal}
          nextColorIndex={customSubcategories.length}
          category={category}
          categoryId={categoryId ?? undefined}
          project={project}
        />
      </div>

      <AnimatePresence>
        {pendingDelete && (
          <ToastConfirm
            message={toastMessage}
            subMessage={toastSubMessage}
            onConfirm={handleConfirmedDelete}
            onCancel={handleCancelDelete}
            isDeleting={isDeleting}
          />
        )}
      </AnimatePresence>
    </>
  );
}