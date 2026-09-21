import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, PhoneOff, User, Radio } from 'lucide-react';
import { UserProfile } from '../types';

interface ActiveCallBarProps {
  remoteUser: UserProfile;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  startTime: number;
  onHangup: () => void;
}

export const ActiveCallBar: React.FC<ActiveCallBarProps> = ({
  remoteUser,
  remoteStream,
  localStream,
  startTime,
  onHangup,
}) => {
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Bind remote stream to audio element
  useEffect(() => {
    if (audioRef.current && remoteStream) {
      audioRef.current.srcObject = remoteStream;
      audioRef.current.play().catch(err => {
        console.warn('AutoPlay of remote audio stream was blocked by browser:', err);
      });
    }
  }, [remoteStream]);

  // Duration Timer
  useEffect(() => {
    const updateDuration = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setDurationSeconds(Math.max(0, elapsed));
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  // Mute / Unmute local microphone
  const toggleMute = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isMuted; // Toggle: if currently muted, enable it
      });
      setIsMuted(!isMuted);
    }
  };

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Hidden audio element for remote stream */}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      {/* Floating Active Call Bar */}
      <div 
        id="active-call-floating-bar"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-lg bg-slate-900/95 backdrop-blur-xl text-white rounded-3xl p-3 sm:p-4 shadow-2xl border border-white/15 flex items-center justify-between gap-3 sm:gap-4 animate-in slide-in-from-bottom-6 duration-300 ring-1 ring-black/40"
      >
        {/* Remote User Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Avatar with live pulsing green badge */}
          <div className="relative shrink-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl overflow-hidden ring-2 ring-emerald-400/80 bg-slate-800 flex items-center justify-center shadow-md">
              {remoteUser.avatar_url ? (
                <img
                  src={remoteUser.avatar_url}
                  alt={remoteUser.full_name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#112354] to-[#1B357B] text-white font-bold text-base flex items-center justify-center">
                  {remoteUser.full_name ? remoteUser.full_name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                </div>
              )}
            </div>
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
          </div>

          {/* Texts & Timer */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-xs sm:text-sm text-white truncate max-w-[130px] sm:max-w-[180px]">
                {remoteUser.full_name}
              </h4>
              <span className="text-[10px] bg-white/10 text-slate-300 px-2 py-0.5 rounded-full font-medium shrink-0 hidden xs:inline-block">
                {remoteUser.sector}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-xs sm:text-sm font-bold tracking-wider">
                <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
                <span>{formatTimer(durationSeconds)}</span>
              </div>
              <span className="text-[10px] text-slate-400 hidden sm:inline">• Ramal MVRJ</span>
            </div>
          </div>
        </div>

        {/* Call Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mute Button */}
          <button
            type="button"
            onClick={toggleMute}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
              isMuted
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
            }`}
            title={isMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
          >
            {isMuted ? (
              <MicOff className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            ) : (
              <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            )}
          </button>

          {/* End Call Button */}
          <button
            type="button"
            onClick={onHangup}
            className="h-10 sm:h-11 px-3 sm:px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all cursor-pointer active:scale-95 shrink-0"
            title="Encerrar Chamada"
          >
            <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Encerrar</span>
          </button>
        </div>

      </div>
    </>
  );
};
