import { X, Clock, AlertCircle, CheckCircle, Info, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

const notifications = [
  { id: 1, type: 'info', title: 'New ECU Added', message: 'ECU #177218209170 has been added to TestBench1', time: '5 min ago', user: 'Admin Sameh', read: false },
  { id: 2, type: 'success', title: 'Transfer Approved', message: 'Transfer request for ECU #9999999 has been approved', time: '1 hour ago', user: 'Jihon Walter', read: false },
  { id: 3, type: 'warning', title: 'Low Battery', message: 'ECU #177261165018 battery voltage below threshold', time: '2 hours ago', user: 'Amin KLM', read: true },
  { id: 4, type: 'info', title: 'Maintenance Due', message: 'Scheduled maintenance for TestBench2 due tomorrow', time: '1 day ago', user: 'Admin Sameh', read: true },
];

export function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
  const handleClearAll = () => {
    if (confirm('Clear all notifications?')) {
      alert('All notifications cleared');
      onClose();
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-[#7594A4]" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-[#936363]" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-[#936363]" />;
      default:
        return <Info className="w-5 h-5 text-[#557486]" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop - transparent, just for click-outside */}
          <div
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{ background: 'transparent' }}
          />

          {/* Dropdown Panel */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 bg-white rounded-lg overflow-hidden border border-[#E2E8F0]"
            style={{
              top: '48px',
              right: '-8px',
              width: '320px',
              maxHeight: '420px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)'
            }}
          >
            {/* Arrow pointer */}
            <div 
              className="absolute -top-2 right-4 w-4 h-4 bg-white border-l border-t border-[#E2E8F0] transform rotate-45"
              style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
            ></div>

            {/* Header - Fixed */}
            <div className="px-4 py-3 bg-white flex items-center justify-between border-b border-[#E5E7EB]">
              <h3 className="font-bold text-[#354D6F] text-sm">Notifications</h3>
              <button
                onClick={handleClearAll}
                className="text-xs text-[#557486] hover:text-[#354D6F] font-semibold transition-colors"
              >
                Clear All
              </button>
            </div>

            {/* Notification List - Scrollable */}
            <div className="overflow-y-auto" style={{ maxHeight: '320px' }}>
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Clock className="w-10 h-10 text-[#BAC8D1] mx-auto mb-2" />
                  <p className="text-[#7594A4] text-xs">No notifications</p>
                </div>
              ) : (
                notifications.map((notification, index) => (
                  <div
                    key={notification.id}
                    className={`px-3 py-2.5 transition-colors cursor-pointer hover:bg-[#F8FAFC] border-b border-[#F1F5F9] last:border-b-0 ${
                      !notification.read ? 'bg-[#F0F9FF]' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {/* Icon */}
                      <div className="flex-shrink-0 mt-0.5">
                        {getIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-0.5">
                          <h4 className="font-semibold text-[#354D6F] text-xs leading-tight">
                            {notification.title}
                          </h4>
                          {!notification.read && (
                            <span className="w-1.5 h-1.5 bg-[#2563EB] rounded-full flex-shrink-0 mt-1"></span>
                          )}
                        </div>
                        <p className="text-xs text-[#64748B] leading-snug mb-1.5">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                          <span>{notification.time}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}