import { useState } from 'react';
import { User, Lock, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onLogin: (username: string, password: string) => Promise<void>;
  loginError?: string;
}

export function Login({ onLogin, loginError }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await onLogin(username, password);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#E8EDF2] via-[#F0F4F8] to-[#E5EBF1]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md px-6"
      >
        {/* Icon */}
        <div className="flex justify-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
            className="w-24 h-24 bg-gradient-to-br from-[#2A4D6F] to-[#1A365B] rounded-3xl flex items-center justify-center shadow-2xl"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-12 h-12 text-white" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <circle cx="8" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="16" cy="12" r="1.5" fill="currentColor" />
              <path d="M6 6V4M10 6V4M14 6V4M18 6V4M6 18v2M10 18v2M14 18v2M18 18v2" strokeLinecap="round" />
            </svg>
          </motion.div>
        </div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center text-2xl font-bold text-[#1A365B] mb-8 uppercase tracking-wide"
        >
          Login to Your Account
        </motion.h1>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-[#6B88A3] to-[#7FA4C4] rounded-3xl shadow-2xl p-8"
          style={{ boxShadow: '0 20px 60px rgba(26, 54, 91, 0.25), 0 10px 20px rgba(0, 0, 0, 0.1)' }}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error message */}
            {loginError && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 bg-red-100 border border-red-300 text-red-700 rounded-xl px-4 py-3 text-sm font-medium"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {loginError}
              </motion.div>
            )}

            {/* Username Field */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#354D6F]">
                <User className="w-5 h-5" />
              </div>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-[#D6E4F0] rounded-xl border-none outline-none text-[#1A365B] placeholder-[#557486] font-medium focus:ring-2 focus:ring-[#354D6F] transition-all"
                required
              />
            </div>

            {/* Password Field */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#354D6F]">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-[#D6E4F0] rounded-xl border-none outline-none text-[#1A365B] placeholder-[#557486] font-medium focus:ring-2 focus:ring-[#354D6F] transition-all"
                required
              />
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-[#2A4D6F] to-[#1A365B] text-white font-bold text-lg uppercase tracking-wider rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading...
                </span>
              ) : (
                'LOGIN'
              )}
            </button>
          </form>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-6 text-sm text-[#557486]"
        >
          ECU Laboratory Test Bench Management System
        </motion.p>
      </motion.div>
    </div>
  );
}
