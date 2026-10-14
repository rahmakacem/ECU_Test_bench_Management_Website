import { Plus, ArrowRightLeft, CheckCircle, XCircle, Edit, Trash2, FileText, Upload, Download, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { forwardRef } from 'react';

interface Notification {
  id: string;
  type: 'add' | 'transfer-request' | 'transfer-approved' | 'transfer-declined' | 'update' | 'delete';
  userName: string;
  ecuSerial: string;
  subCategory: string;
  fromLocation?: string;
  toLocation?: string;
  timestamp: string;
  read: boolean;
}

interface NotificationPanelProps {
  isOpen: boolean;
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

export const NotificationPanel = forwardRef<HTMLDivElement, NotificationPanelProps>(
  ({ isOpen, notifications, onMarkAsRead, onMarkAllAsRead }, ref) => {
    if (!isOpen) return null;

    const getNotificationIcon = (type: string) => {
      switch (type) {
        case 'add':
          return <Plus className="w-4 h-4" />;
        case 'transfer-request':
          return <ArrowRightLeft className="w-4 h-4" />;
        case 'transfer-approved':
          return <CheckCircle className="w-4 h-4" />;
        case 'transfer-declined':
          return <XCircle className="w-4 h-4" />;
        case 'update':
          return <Edit className="w-4 h-4" />;
        case 'delete':
          return <Trash2 className="w-4 h-4" />;
        default:
          return <FileText className="w-4 h-4" />;
      }
    };

    const getNotificationColor = (type: string) => {
      switch (type) {
        case 'add':
          return { bg: 'bg-[#E8F6F0]', text: 'text-[#2F8F6B]', border: 'border-[#2F8F6B]' };
        case 'transfer-request':
          return { bg: 'bg-[#FFF9E6]', text: 'text-[#D97706]', border: 'border-[#D97706]' };
        case 'transfer-approved':
          return { bg: 'bg-[#E8F6F0]', text: 'text-[#2F8F6B]', border: 'border-[#2F8F6B]' };
        case 'transfer-declined':
          return { bg: 'bg-[#FCEAEA]', text: 'text-[#B54747]', border: 'border-[#B54747]' };
        case 'update':
          return { bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]', border: 'border-[#2563EB]' };
        case 'delete':
          return { bg: 'bg-[#FCEAEA]', text: 'text-[#B54747]', border: 'border-[#B54747]' };
        default:
          return { bg: 'bg-[#F1F5F9]', text: 'text-[#64748B]', border: 'border-[#64748B]' };
      }
    };

    const getNotificationText = (notification: Notification) => {
      const { type, userName, ecuSerial, subCategory, fromLocation, toLocation } = notification;

      switch (type) {
        case 'add':
          return (
            <>
              <span className="font-bold text-[#354D6F]">{userName}</span> added a new ECU{' '}
              <span className="font-semibold text-[#557486]">{ecuSerial}</span>{' '}
              <span className="text-xs px-2 py-0.5 bg-[#E8F6F0] text-[#2F8F6B] rounded-full">
                {subCategory}
              </span>
            </>
          );
        case 'transfer-request':
          return (
            <>
              <span className="font-bold text-[#354D6F]">{userName}</span> requested a transfer of ECU{' '}
              <span className="font-semibold text-[#557486]">{ecuSerial}</span>{' '}
              <span className="text-xs px-2 py-0.5 bg-[#E8F6F0] text-[#2F8F6B] rounded-full">
                {subCategory}
              </span>{' '}
              from <span className="font-semibold text-[#936363]">{fromLocation}</span> →{' '}
              <span className="font-semibold text-[#7594A4]">{toLocation}</span>
            </>
          );
        case 'transfer-approved':
          return (
            <>
              <span className="font-bold text-[#354D6F]">{userName}</span> approved the transfer request of ECU{' '}
              <span className="font-semibold text-[#557486]">{ecuSerial}</span>{' '}
              <span className="text-xs px-2 py-0.5 bg-[#E8F6F0] text-[#2F8F6B] rounded-full">
                {subCategory}
              </span>{' '}
              from <span className="font-semibold text-[#936363]">{fromLocation}</span> →{' '}
              <span className="font-semibold text-[#7594A4]">{toLocation}</span>
            </>
          );
        case 'transfer-declined':
          return (
            <>
              <span className="font-bold text-[#354D6F]">{userName}</span> declined the transfer request of ECU{' '}
              <span className="font-semibold text-[#557486]">{ecuSerial}</span>{' '}
              <span className="text-xs px-2 py-0.5 bg-[#E8F6F0] text-[#2F8F6B] rounded-full">
                {subCategory}
              </span>{' '}
              from <span className="font-semibold text-[#936363]">{fromLocation}</span> →{' '}
              <span className="font-semibold text-[#7594A4]">{toLocation}</span>
            </>
          );
        case 'update':
          return (
            <>
              <span className="font-bold text-[#354D6F]">{userName}</span> updated ECU{' '}
              <span className="font-semibold text-[#557486]">{ecuSerial}</span>{' '}
              <span className="text-xs px-2 py-0.5 bg-[#E8F6F0] text-[#2F8F6B] rounded-full">
                {subCategory}
              </span>
            </>
          );
        case 'delete':
          return (
            <>
              <span className="font-bold text-[#354D6F]">{userName}</span> deleted ECU{' '}
              <span className="font-semibold text-[#557486]">{ecuSerial}</span>{' '}
              <span className="text-xs px-2 py-0.5 bg-[#E8F6F0] text-[#2F8F6B] rounded-full">
                {subCategory}
              </span>
            </>
          );
        default:
          return null;
      }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="absolute top-full left-0 mt-2 w-[210px] bg-white rounded-xl shadow-2xl border border-[#BAC8D1] z-[100] overflow-hidden"
        style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.15)' }}
      >
        {/* Pointer Arrow */}
        <div className="absolute -top-2 left-6 w-3 h-3 bg-white rotate-45 border-l border-t border-[#BAC8D1]"></div>

        {/* Header */}
        <div 
          className="px-4 py-3 border-b border-[#BAC8D1]"
          style={{ background: 'linear-gradient(135deg, #354D6F, #1A365B)' }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="text-xs font-semibold text-white/80 hover:text-white transition-colors underline"
              >
                Mark all as read
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-[240px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-[#F5F0E8] rounded-full flex items-center justify-center mx-auto mb-2">
                <FileText className="w-6 h-6 text-[#95A4AE]" />
              </div>
              <p className="text-xs text-[#64748B]">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {notifications.map((notification) => {
                const colors = getNotificationColor(notification.type);
                const isUnread = !notification.read;

                return (
                  <div
                    key={notification.id}
                    onClick={() => onMarkAsRead(notification.id)}
                    className={`p-3 hover:bg-[#F5F0E8]/30 transition-colors cursor-pointer ${
                      isUnread ? 'bg-[#EFF6FF]/30' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-7 h-7 ${colors.bg} ${colors.text} rounded-full flex items-center justify-center border ${colors.border}`}>
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-[#475569] leading-relaxed mb-1">
                          {getNotificationText(notification)}
                        </div>

                        {/* Timestamp */}
                        <div className="flex items-center gap-1 text-[10px] text-[#94A3B8]">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{notification.timestamp}</span>
                        </div>
                      </div>

                      {/* Unread Indicator */}
                      {isUnread && (
                        <div className="flex-shrink-0 w-1.5 h-1.5 bg-[#2563EB] rounded-full mt-1"></div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="px-4 py-2.5 bg-[#F8FAFC] border-t border-[#E2E8F0]">
            <button className="w-full text-xs font-bold text-[#557486] hover:text-[#354D6F] transition-colors uppercase tracking-wide">
              View All Notifications
            </button>
          </div>
        )}
      </motion.div>
    );
  }
);

NotificationPanel.displayName = 'NotificationPanel';