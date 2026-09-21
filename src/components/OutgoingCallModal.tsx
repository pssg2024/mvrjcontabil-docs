import React, { useEffect } from 'react';
import { PhoneOff, Loader2, User } from 'lucide-react';
import { UserProfile } from '../types';
import { startOutgoingDialTone, stopCallSounds } from '../lib/call-sound';

interface OutgoingCallModalProps {
  targetUser: UserProfile;
  onCancel: () => void;
}

export const OutgoingCallModal: React.FC<OutgoingCallModalProps> = ({
  targetUser,
  onCancel,
}) => {
  useEffect(() => {
    startOutgoingDialTone();
    return () => {
      stopCallSounds();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-[92%] max-w-sm bg-white rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-6 border border-slate-100 relative animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Background ambient lighting */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-[#1B357B]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Dialing Indicator */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1B357B]" />
          <span>A chamar colega...</span>
        </div>

        {/* Target Avatar with Pulse */}
        <div className="relative flex items-center justify-center my-2">
          <div className="absolute w-28 h-28 rounded-full bg-blue-500/20 animate-ping opacity-75" />
          <div className="absolute w-24 h-24 rounded-full bg-blue-500/30 animate-pulse" />
          <div className="relative w-20 h-20 rounded-2xl overflow-hidden ring-4 ring-white shadow-xl border-2 border-blue-600 bg-slate-900 flex items-center justify-center">
            {targetUser.avatar_url ? (
              <img
                src={targetUser.avatar_url}
                alt={targetUser.full_name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#0F1E42] to-[#1B357B] text-white font-bold text-2xl flex items-center justify-center">
                {targetUser.full_name ? targetUser.full_name.charAt(0).toUpperCase() : <User className="w-8 h-8" />}
              </div>
            )}
          </div>
        </div>

        {/* Target Info */}
        <div className="text-center space-y-1 w-full">
          <h3 className="text-lg font-extrabold text-slate-900 truncate px-2">
            {targetUser.full_name}
          </h3>
          <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5 flex-wrap">
            <span className="font-semibold text-slate-700">{targetUser.sector}</span>
            <span className="text-slate-300">•</span>
            <span className="capitalize font-medium text-slate-600">{targetUser.role}</span>
          </p>
          <p className="text-[11px] text-slate-400">
            Aguardando atendimento no ramal interno...
          </p>
        </div>

        {/* Cancel Button */}
        <button
          type="button"
          onClick={onCancel}
          className="w-full h-12 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 transition-all cursor-pointer active:scale-95"
          title="Cancelar chamada"
        >
          <PhoneOff className="w-4 h-4" />
          <span>Cancelar Chamada</span>
        </button>

      </div>
    </div>
  );
};
