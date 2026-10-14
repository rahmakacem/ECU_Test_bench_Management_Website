import { X, Truck, Loader2, CheckCircle, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { getSuppliers, createSupplier, deleteSupplier } from '../services/api';

interface ReturnToSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (supplierName: string) => Promise<void>;
  selectedCount: number;
  selectedSerials: string[];
  currentProject?: string;
}

interface Supplier {
  id: number;
  name: string;
  country: string;
  description?: string;
  applicable_projects?: string;
}

export function ReturnToSupplierModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  selectedCount,
  selectedSerials,
  currentProject
}: ReturnToSupplierModalProps) {
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', country: '', applicable_projects: '' });
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [deletingSupplierId, setDeletingSupplierId] = useState<number | null>(null);

  const fetchSuppliers = async () => {
    setLoadingSuppliers(true);
    try {
      const params: any = {};
      if (currentProject) {
        params.project = currentProject;
      }
      const response = await getSuppliers(params);
      const data = response.data;
      const supplierList = (Array.isArray(data) ? data : data.results || []) as Supplier[];
      setSuppliers(supplierList);
      if (supplierList.length > 0 && !selectedSupplier) {
        setSelectedSupplier(supplierList[0].name);
      }
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
      // Fallback suppliers if API fails
      setSuppliers([
        { id: 1, name: 'LEAR', country: 'Germany', applicable_projects: 'BCP-21,IPB-25' },
        { id: 2, name: 'NISTEON', country: 'Germany', applicable_projects: 'BCP-21,BDC-18' },
        { id: 3, name: 'Bosch Automotive', country: 'Germany', applicable_projects: null },
        { id: 4, name: 'Continental AG', country: 'Germany', applicable_projects: null },
        { id: 5, name: 'Denso Corporation', country: 'Japan', applicable_projects: null },
      ]);
      if (!selectedSupplier) setSelectedSupplier('LEAR');
    } finally {
      setLoadingSuppliers(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSuppliers();
    }
  }, [isOpen, currentProject]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedSupplier('');
      setShowAddSupplier(false);
      setNewSupplier({ name: '', country: '', applicable_projects: '' });
      setDeletingSupplierId(null);
    }
  }, [isOpen]);

  const handleAddSupplier = async () => {
    if (!newSupplier.name.trim()) {
      alert('Please enter a supplier name');
      return;
    }
    setIsAddingSupplier(true);
    try {
      await createSupplier({
        name: newSupplier.name.trim(),
        country: newSupplier.country.trim() || null,
        applicable_projects: newSupplier.applicable_projects.trim() || null,
      });
      await fetchSuppliers();
      setSelectedSupplier(newSupplier.name.trim());
      setShowAddSupplier(false);
      setNewSupplier({ name: '', country: '', applicable_projects: '' });
    } catch (error: any) {
      console.error('Failed to add supplier:', error);
      if (error.response?.data?.name?.[0]) {
        alert(error.response.data.name[0]);
      } else {
        alert('Failed to add supplier. It may already exist.');
      }
    } finally {
      setIsAddingSupplier(false);
    }
  };

  const handleDeleteSupplier = async (supplier: Supplier) => {
    if (confirm(`Delete supplier "${supplier.name}"? This action cannot be undone.`)) {
      setDeletingSupplierId(supplier.id);
      try {
        await deleteSupplier(supplier.id);
        await fetchSuppliers();
        if (selectedSupplier === supplier.name) {
          setSelectedSupplier(suppliers.filter(s => s.id !== supplier.id)[0]?.name || '');
        }
      } catch (error) {
        console.error('Failed to delete supplier:', error);
        alert('Failed to delete supplier.');
      } finally {
        setDeletingSupplierId(null);
      }
    }
  };

  const handleConfirm = async () => {
    if (!selectedSupplier) {
      alert('Please select a supplier');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onConfirm(selectedSupplier);
      onClose();
      setSelectedSupplier('');
    } catch (error) {
      console.error('Failed to return to supplier:', error);
      alert('Failed to return ECUs to supplier. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedSupplier('');
    onClose();
  };

  const isBulk = selectedCount > 1;

  // Check if supplier is applicable to current project
  const isSupplierApplicable = (supplier: Supplier): boolean => {
    if (!currentProject) return true;
    if (!supplier.applicable_projects) return true;
    return supplier.applicable_projects.includes(currentProject);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-50 w-full max-w-md overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4" style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      Return to Supplier
                    </h2>
                    <p className="text-xs text-white/70 mt-0.5">
                      {isBulk
                        ? `${selectedCount} ECUs selected for return`
                        : 'Return 1 ECU to supplier'}
                    </p>
                  </div>
                </div>
                <button onClick={handleClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* ECU Serial Numbers */}
              <div>
                <label className="block text-xs font-bold text-[#354D6F] mb-2 uppercase tracking-wide">
                  ECU Serial Number{isBulk ? 's' : ''}
                </label>
                <div className="min-h-[48px] px-3 py-2.5 bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-xl">
                  {selectedSerials.length === 0 ? (
                    <span className="text-xs text-[#94A3B8]">No ECUs selected</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                      {selectedSerials.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#7C3AED] text-white rounded-lg text-xs font-semibold"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-[#94A3B8] mt-1.5">
                  {selectedCount} ECU{selectedCount !== 1 ? 's' : ''} will be returned to supplier
                </p>
              </div>

              {/* Supplier Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-[#354D6F] uppercase tracking-wide">
                    Select Supplier <span className="text-red-500">*</span>
                  </label>
                  <button
                    onClick={() => setShowAddSupplier(!showAddSupplier)}
                    className="flex items-center gap-1 text-xs text-[#7C3AED] hover:text-[#6D28D9] font-semibold transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add New
                  </button>
                </div>

                {/* Add Supplier Form */}
                {showAddSupplier && (
                  <div className="mb-3 p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-2">
                    <input
                      type="text"
                      value={newSupplier.name}
                      onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                      placeholder="Supplier Name *"
                      className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={newSupplier.country}
                      onChange={(e) => setNewSupplier({ ...newSupplier, country: e.target.value })}
                      placeholder="Country (e.g., Germany, Japan, USA)"
                      className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]"
                    />
                    <input
                      type="text"
                      value={newSupplier.applicable_projects}
                      onChange={(e) => setNewSupplier({ ...newSupplier, applicable_projects: e.target.value })}
                      placeholder="Applicable Projects (e.g., BCP-21,IPB-25)"
                      className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddSupplier}
                        disabled={isAddingSupplier || !newSupplier.name.trim()}
                        className="flex-1 px-3 py-2 bg-[#7C3AED] text-white rounded-lg text-sm font-semibold hover:bg-[#6D28D9] disabled:opacity-50 transition-colors"
                      >
                        {isAddingSupplier ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Add Supplier'}
                      </button>
                      <button
                        onClick={() => setShowAddSupplier(false)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Suppliers List */}
                {loadingSuppliers ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-[#7C3AED]" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                    {suppliers.map((supplier) => {
                      const isSelected = selectedSupplier === supplier.name;
                      const isApplicable = isSupplierApplicable(supplier);
                      const isDeleting = deletingSupplierId === supplier.id;
                      
                      return (
                        <button
                          key={supplier.id}
                          type="button"
                          onClick={() => isApplicable && !isDeleting && setSelectedSupplier(supplier.name)}
                          disabled={!isApplicable || isDeleting}
                          className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all group ${
                            isSelected
                              ? 'border-[#7C3AED] bg-[#7C3AED]/10'
                              : !isApplicable
                              ? 'border-[#E2E8F0] bg-gray-100 opacity-60 cursor-not-allowed'
                              : 'border-[#E2E8F0] bg-white hover:border-[#7C3AED] hover:bg-[#7C3AED]/5'
                          } ${isDeleting ? 'opacity-50' : ''}`}
                        >
                          <div className="flex flex-col items-start flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`font-semibold text-sm ${isSelected ? 'text-[#7C3AED]' : 'text-[#334155]'}`}>
                                {supplier.name}
                              </span>
                              {!isApplicable && (
                                <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                                  Not for {currentProject}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-[#94A3B8]">{supplier.country || 'Unknown location'}</span>
                            {supplier.applicable_projects && (
                              <span className="text-[10px] text-[#94A3B8] mt-0.5">
                                For: {supplier.applicable_projects}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {isSelected && (
                              <CheckCircle className="w-5 h-5 text-[#7C3AED]" />
                            )}
                            {!isSelected && isApplicable && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSupplier(supplier);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-100 rounded-lg"
                                disabled={isDeleting}
                              >
                                {isDeleting ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                                ) : (
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                )}
                              </button>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {suppliers.length === 0 && !loadingSuppliers && (
                  <div className="text-center py-6 text-[#94A3B8]">
                    <p className="text-sm">No suppliers available</p>
                    <button
                      onClick={() => setShowAddSupplier(true)}
                      className="mt-2 text-xs text-[#7C3AED] hover:text-[#6D28D9] font-semibold"
                    >
                      + Add your first supplier
                    </button>
                  </div>
                )}
              </div>

              {/* Project Info */}
              {currentProject && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5">
                  <p className="text-xs text-blue-700">
                    <span className="font-bold">Current Project:</span> {currentProject}
                  </p>
                  <p className="text-[10px] text-blue-600 mt-0.5">
                    Some suppliers are only available for specific projects.
                  </p>
                </div>
              )}

              {/* Warning Message */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-700">
                      ⚠️ Permanent Action
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      This action will permanently remove the selected ECU(s) from the database.
                      This cannot be undone. A history record will be created for audit purposes.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC]">
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 border-2 border-[#E2E8F0] text-[#475569] rounded-xl font-bold text-sm hover:bg-white hover:border-[#CBD5E1] transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selectedSupplier || isSubmitting}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[180px] justify-center"
                style={{
                  background: !selectedSupplier || isSubmitting
                    ? '#94a3b8'
                    : 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4" />
                    <span>
                      {isBulk ? `Return ${selectedCount} ECUs` : 'Return to Supplier'}
                    </span>
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