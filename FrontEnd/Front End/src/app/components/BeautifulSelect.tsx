import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Check } from 'lucide-react';

interface BeautifulSelectProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

export function BeautifulSelect({ value, options, onChange }: BeautifulSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] text-sm text-[#334155] transition-all flex items-center justify-between cursor-pointer focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
      >
        <span>{value}</span>
        <ChevronDown
          className={`w-4 h-4 text-[#94A3B8] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-[200] mt-1 w-full bg-white border border-[#E2E8F0] rounded-[10px] shadow-xl overflow-hidden"
          >
            <div className="max-h-48 overflow-y-auto">
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between transition-colors hover:bg-[#F1F5F9] ${
                    value === option
                      ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold'
                      : 'text-[#334155]'
                  }`}
                >
                  <span>{option}</span>
                  {value === option && <Check className="w-3.5 h-3.5 text-[#2563EB]" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}