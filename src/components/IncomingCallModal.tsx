import React, { useEffect } from 'react';
import { Phone, PhoneOff, Radio, User } from 'lucide-react';
import { UserProfile } from '../types';
import { startIncomingRingtone, stopCallSounds } from '../lib/call-sound';

interface IncomingCallModalProps {
  caller: UserProfile;
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  caller,
  onAccept,
  onReject,
}) => {
  useEffect(() => {
    startIncomingRingtone();
    return () => {
      stopCallSounds();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-[92%] max-w-sm bg-white rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-6 border border-slate-100 relative animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Background ambient lighting */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-[#1B357B]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Pulse indicator */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 animate-pulse">
          <Radio className="w-3.5 h-3.5 animate-spin" />
          <span>Chamada de voz interna...</span>
        </div>

        {/* Caller Avatar with Triple Ring Pulse */}
        <div className="relative flex items-center justify-center my-2">
          <div className="absolute w-28 h-28 rounded-full bg-emerald-500/20 animate-ping opacity-75" />
          <div className="absolute w-24 h-24 rounded-full bg-emerald-500/30 animate-pulse" />
          <div className="relative w-20 h-20 rounded-2xl overflow-hidden ring-4 ring-white shadow-xl border-2 border-emerald-500 bg-slate-900 flex items-center justify-center">
            {caller.avatar_url ? (
              <img
                src={caller.avatar_url}
                alt={caller.full_name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#0F1E42] to-[#1B357B] text-white font-bold text-2xl flex items-center justify-center">
                {caller.full_name ? caller.full_name.charAt(0).toUpperCase() : <User className="w-8 h-8" />}
              </div>
            )}
          </div>
        </div>

        {/* Caller Info */}
        <div className="text-center space-y-1 w-full">
          <h3 className="text-lg font-extrabold text-slate-900 truncate px-2">
            {caller.full_name}
          </h3>
          <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5 flex-wrap">
            <span className="font-semibold text-slate-700">{caller.sector}</span>
            <span className="text-slate-300">•</span>
            <span className="capitalize font-medium text-slate-600">{caller.role}</span>
          </p>
          <p className="text-[11px] text-slate-400 font-mono">
            Ramal Interno MVRJ Contábil
          </p>
        </div>

        {/* Action Buttons: Atender (Verde) e Recusar (Vermelho) */}
        <div className="grid grid-cols-2 gap-3 w-full pt-2">
          <button
            type="button"
            onClick={onReject}
            className="h-12 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 transition-all cursor-pointer active:scale-95"
            title="Recusar chamada"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Recusar</span>
          </button>

          <button
            type="button"
            onClick={onAccept}
            className="h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer active:scale-95 animate-bounce"
            title="Atender chamada"
          >
            <Phone className="w-4 h-4" />
            <span>Atender</span>
          </button>
        </div>

      </div>
    </div>
  );
};
