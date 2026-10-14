import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Upload, Radio, Gauge, SquareStack, Wind, Disc, Tag, AlertTriangle, Lock, ScanFace, Sun, Power, Zap, Lightbulb, SquareDashedMousePointer, ArrowUpDown, Square, LightbulbOff, Waves, Atom, Music2, Settings2, ToggleLeft, Wrench, Car, Cpu, Box, Wallet, Wifi, MessageSquare, UserCircle, Camera, Heart, Star, Shield, Battery, Signal, Volume2, Bell, Clock } from 'lucide-react';

const availableIcons = [
  { name: 'Radio', Icon: Radio },
  { name: 'Gauge', Icon: Gauge },
  { name: 'SquareStack', Icon: SquareStack },
  { name: 'Wind', Icon: Wind },
  { name: 'Disc', Icon: Disc },
  { name: 'Tag', Icon: Tag },
  { name: 'AlertTriangle', Icon: AlertTriangle },
  { name: 'Lock', Icon: Lock },
  { name: 'ScanFace', Icon: ScanFace },
  { name: 'Sun', Icon: Sun },
  { name: 'Power', Icon: Power },
  { name: 'Zap', Icon: Zap },
  { name: 'Lightbulb', Icon: Lightbulb },
  { name: 'SquareDashedMousePointer', Icon: SquareDashedMousePointer },
  { name: 'ArrowUpDown', Icon: ArrowUpDown },
  { name: 'Square', Icon: Square },
  { name: 'LightbulbOff', Icon: LightbulbOff },
  { name: 'Waves', Icon: Waves },
  { name: 'Atom', Icon: Atom },
  { name: 'Music2', Icon: Music2 },
  { name: 'Settings2', Icon: Settings2 },
  { name: 'ToggleLeft', Icon: ToggleLeft },
  { name: 'Wrench', Icon: Wrench },
  { name: 'Car', Icon: Car },
  { name: 'Cpu', Icon: Cpu },
  { name: 'Box', Icon: Box },
  { name: 'Wallet', Icon: Wallet },
  { name: 'Wifi', Icon: Wifi },
  { name: 'MessageSquare', Icon: MessageSquare },
  { name: 'UserCircle', Icon: UserCircle },
  { name: 'Camera', Icon: Camera },
  { name: 'Heart', Icon: Heart },
  { name: 'Star', Icon: Star },
  { name: 'Shield', Icon: Shield },
  { name: 'Battery', Icon: Battery },
  { name: 'Signal', Icon: Signal },
  { name: 'Volume2', Icon: Volume2 },
  { name: 'Bell', Icon: Bell },
  { name: 'Clock', Icon: Clock },
];

// Color sequence that repeats
const colorSequence = ['#557486', '#6B8396', '#7594A4', '#95A4AE', '#936363', '#A8BAC3'];

interface AddSubcategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { 
    name: string; 
    iconName: string; 
    iconFile?: File | null;
    categoryId?: number;
    project?: string;
  }) => Promise<void> | void;
  nextColorIndex: number;
  category?: string;      // Category name for display
  categoryId?: number;    // Category ID for API
  project?: string;       // Project name for API
}

export function AddSubcategoryModal({ 
  isOpen, 
  onClose, 
  onSave, 
  nextColorIndex, 
  category, 
  categoryId,
  project 
}: AddSubcategoryModalProps) {
  const [name, setName] = useState('');
  const [selectedIconName, setSelectedIconName] = useState<string>('Radio');
  const [uploadedIcon, setUploadedIcon] = useState<File | null>(null);
  const [uploadedIconPreview, setUploadedIconPreview] = useState<string | null>(null);
  const [useUploadedIcon, setUseUploadedIcon] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentColor = colorSequence[nextColorIndex % colorSequence.length];

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a subcategory name');
      return;
    }

    if (!categoryId) {
      alert('Category ID is missing. Please try again.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onSave({
        name: name.toUpperCase(),
        iconName: selectedIconName,
        iconFile: useUploadedIcon ? uploadedIcon : null,
        categoryId: categoryId,     // Pass the category ID
        project: project,           // Pass the project name
      });

      // Reset form
      setName('');
      setSelectedIconName('Radio');
      setUploadedIcon(null);
      setUploadedIconPreview(null);
      setUseUploadedIcon(false);
      onClose();
    } catch (error) {
      console.error('Failed to save subcategory:', error);
      alert('Failed to save subcategory. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('File size too large. Maximum 2MB.');
        return;
      }
      
      setUploadedIcon(file);
      const previewUrl = URL.createObjectURL(file);
      setUploadedIconPreview(previewUrl);
      setUseUploadedIcon(true);
    }
  };

  const handleRemoveCustomIcon = () => {
    setUploadedIcon(null);
    setUploadedIconPreview(null);
    setUseUploadedIcon(false);
  };

  const handleCancel = () => {
    // Reset form
    setName('');
    setSelectedIconName('Radio');
    setUploadedIcon(null);
    setUploadedIconPreview(null);
    setUseUploadedIcon(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={handleCancel}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-[#354D6F] to-[#1A365B] text-white px-5 py-4 rounded-t-xl flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold uppercase tracking-wide">Add New Subcategory</h2>
              {category && project && (
                <p className="text-xs text-white/70 mt-1">
                  Adding to: {category} / {project}
                </p>
              )}
            </div>
            <button
              onClick={handleCancel}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-5">
            {/* Category and Project Info (Read-only) */}
            {(category || project) && (
              <div className="bg-[#F5F0E8] rounded-lg p-3 border border-[#BAC8D1]">
                <div className="text-xs text-[#64748B] mb-1.5 uppercase tracking-wide font-bold">Adding to:</div>
                <div className="flex gap-3 text-sm">
                  {category && (
                    <span className="px-2 py-1 bg-[#557486] text-white rounded-md text-xs font-bold">
                      Category: {category}
                    </span>
                  )}
                  {project && (
                    <span className="px-2 py-1 bg-[#7594A4] text-white rounded-md text-xs font-bold">
                      Project: {project}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Name Input */}
            <div>
              <label className="block text-xs font-bold text-[#354D6F] mb-1.5 uppercase tracking-wide">
                Subcategory Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter name (e.g., ANTENNA)"
                className="w-full px-4 py-2.5 border-2 border-[#BAC8D1] rounded-lg focus:outline-none focus:border-[#557486] focus:ring-2 focus:ring-[#557486]/20 uppercase text-sm transition-all"
              />
            </div>

            {/* Icon Selection */}
            <div>
              <label className="block text-xs font-bold text-[#354D6F] mb-1.5 uppercase tracking-wide">
                Select Icon
              </label>
              <div className="grid grid-cols-8 gap-2 max-h-48 overflow-y-auto p-2 border-2 border-[#BAC8D1] rounded-lg bg-gray-50">
                {availableIcons.map((icon) => {
                  const IconComponent = icon.Icon;
                  return (
                    <button
                      key={icon.name}
                      onClick={() => {
                        setSelectedIconName(icon.name);
                        setUseUploadedIcon(false);
                      }}
                      className={`p-2 rounded-lg transition-all hover:scale-105 ${
                        selectedIconName === icon.name && !useUploadedIcon
                          ? 'bg-[#354D6F] text-white ring-2 ring-[#557486] shadow-md'
                          : 'bg-white text-[#354D6F] hover:bg-gray-100 border border-gray-200'
                      }`}
                      title={icon.name}
                    >
                      <IconComponent className="w-4 h-4 mx-auto" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Upload Custom Icon */}
            <div>
              <label className="block text-xs font-bold text-[#354D6F] mb-1.5 uppercase tracking-wide">
                Custom Icon (Optional)
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => document.getElementById('icon-upload')?.click()}
                  className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-[#BAC8D1] rounded-lg hover:border-[#557486] hover:bg-[#F5F0E8] transition-all"
                >
                  <Upload className="w-4 h-4 text-[#557486]" />
                  <span className="text-xs text-[#557486] font-medium">Upload Icon</span>
                </button>
                <input
                  id="icon-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {uploadedIcon && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                      ✓ Custom icon selected
                    </span>
                    <button
                      onClick={handleRemoveCustomIcon}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">
                PNG, JPG, SVG up to 2MB
              </p>
            </div>

            {/* Preview */}
            <div>
              <label className="block text-xs font-bold text-[#354D6F] mb-1.5 uppercase tracking-wide">
                Preview
              </label>
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm"
                style={{ backgroundColor: currentColor }}
              >
                {useUploadedIcon && uploadedIconPreview ? (
                  <img 
                    src={uploadedIconPreview} 
                    alt="Custom icon" 
                    className="w-5 h-5 object-contain"
                  />
                ) : (
                  (() => {
                    const PreviewIcon = availableIcons.find((i) => i.name === selectedIconName)?.Icon;
                    return PreviewIcon ? <PreviewIcon className="w-4 h-4 text-white" /> : null;
                  })()
                )}
                <span className="text-white font-semibold text-sm uppercase tracking-wide">
                  {name || 'SUBCATEGORY NAME'}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 bg-[#F5F0E8] rounded-b-xl flex items-center justify-end gap-3">
            <button
              onClick={handleCancel}
              disabled={isSubmitting}
              className="px-5 py-2 border-2 border-[#BAC8D1] text-[#354D6F] rounded-lg font-bold uppercase text-sm hover:bg-white hover:border-[#557486] transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || isSubmitting}
              className={`px-5 py-2 rounded-lg font-bold uppercase text-sm transition-all flex items-center gap-2 ${
                name.trim() && !isSubmitting
                  ? 'bg-gradient-to-r from-[#354D6F] to-[#1A365B] text-white hover:shadow-lg hover:-translate-y-0.5'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>ADDING...</span>
                </>
              ) : (
                <span>ADD SUBCATEGORY</span>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}