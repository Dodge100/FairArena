import { ExternalLink, Globe, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

export const FrontendMismatch = ({ expectedUrl }: { expectedUrl: string }) => {
  const currentUrl = window.location.origin;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-[128px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full relative z-10 bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl"
      >
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full" />
            <div className="relative bg-gradient-to-br from-red-500/20 to-orange-500/20 p-4 rounded-2xl border border-red-500/30">
              <ShieldAlert className="w-10 h-10 text-red-500" />
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center mb-2 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
          Unidentified Instance
        </h1>

        <p className="text-zinc-400 text-center mb-8 leading-relaxed">
          This frontend instance is running on an unrecognized domain. For your security, please
          access the application through the official specific URL.
        </p>

        <div className="space-y-3 mb-8">
          <div className="bg-black/40 rounded-lg p-3 border border-white/5 flex items-center justify-between group">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 rounded-md bg-zinc-900 border border-white/10 shrink-0">
                <Globe className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-zinc-500 font-medium">Current Domain</span>
                <span className="text-sm text-zinc-300 truncate font-mono">{currentUrl}</span>
              </div>
            </div>
            <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 mx-2 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
          </div>

          <div className="bg-black/40 rounded-lg p-3 border border-white/5 flex items-center justify-between group">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 rounded-md bg-zinc-900 border border-white/10 shrink-0">
                <ShieldAlert className="w-4 h-4 text-emerald-500 group-hover:text-emerald-400 transition-colors" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-zinc-500 font-medium">Official Domain</span>
                <span className="text-sm text-emerald-400 truncate font-mono">{expectedUrl}</span>
              </div>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mx-2 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          </div>
        </div>

        <motion.a
          href={expectedUrl}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center justify-center gap-2 w-full bg-white text-black font-semibold py-3 px-4 rounded-xl hover:bg-zinc-200 transition-colors group"
        >
          <span>Visit Official Site</span>
          <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </motion.a>
      </motion.div>

      <div className="mt-8 text-zinc-600 text-xs text-center font-mono">
        Security Check By FairArena
      </div>
    </div>
  );
};
