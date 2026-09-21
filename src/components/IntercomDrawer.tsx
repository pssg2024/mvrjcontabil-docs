import React, { useState } from 'react';
import { Phone, Radio, Search, X, User, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../types';

interface IntercomDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  profiles: UserProfile[];
  onlineUserIds: Set<string>;
  onStartCall: (targetUser: UserProfile) => void;
  activeCallUserId?: string | null;
}

export const IntercomDrawer: React.FC<IntercomDrawerProps> = ({
  isOpen,
  onClose,
  currentUser,
  profiles,
  onlineUserIds,
  onStartCall,
  activeCallUserId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');

  if (!isOpen) return null;

  // Filter out the current user and filter by search and sector
  const otherUsers = profiles.filter(p => p.id !== currentUser.id && p.status !== 'pending' && p.status !== 'rejected');
  
  const sectors = ['ALL', ...Array.from(new Set(otherUsers.map(u => u.sector)))];

  const filteredUsers = otherUsers.filter(user => {
    const isSectorMatch = selectedSector === 'ALL' || user.sector === selectedSector;
    const isSearchMatch = 
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.sector.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role.toLowerCase().includes(searchTerm.toLowerCase());

    return isSectorMatch && isSearchMatch;
  });

  // Sort: online users first, then alphabetically
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const aOnline = onlineUserIds.has(a.id) ? 1 : 0;
    const bOnline = onlineUserIds.has(b.id) ? 1 : 0;
    if (bOnline !== aOnline) return bOnline - aOnline;
    return a.full_name.localeCompare(b.full_name);
  });

  const onlineCount = otherUsers.filter(u => onlineUserIds.has(u.id)).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300 relative z-10"
      >
        {/* Top Header */}
        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-[#0F1E42] via-[#112354] to-[#1B357B] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C59B4B]/20 border border-[#C59B4B]/30 flex items-center justify-center text-[#E2C37A] shadow-inner">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-tight">Ramal & Intercomunicador</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  {onlineCount} online
                </span>
              </div>
              <p className="text-xs text-slate-300">Chamadas de voz P2P de alta fidelidade</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar painel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Sector Filters */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 space-y-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar colega por nome, e-mail ou setor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#1B357B] focus:border-transparent outline-hidden transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Sector Pill Badges */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden">
            {sectors.map(sector => (
              <button
                key={sector}
                type="button"
                onClick={() => setSelectedSector(sector)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedSector === sector
                    ? 'bg-[#1B357B] text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                }`}
              >
                {sector === 'ALL' ? 'Todos os Setores' : sector}
              </button>
            ))}
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-slate-100">
          {sortedUsers.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <User className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">Nenhum colaborador encontrado</p>
              <p className="text-xs">Tente ajustar a busca ou o setor selecionado.</p>
            </div>
          ) : (
            sortedUsers.map(user => {
              const isOnline = onlineUserIds.has(user.id);
              const isInCallWithMe = activeCallUserId === user.id;

              return (
                <div
                  key={user.id}
                  className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 p-2.5 rounded-2xl hover:bg-slate-50 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Avatar with live status badge */}
                    <div className="relative shrink-0">
                      <div className="w-11 h-11 rounded-2xl overflow-hidden ring-2 ring-slate-100 bg-slate-100 flex items-center justify-center shadow-xs">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.full_name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-[#112354] to-[#1B357B] text-white font-bold text-sm flex items-center justify-center">
                            {user.full_name ? user.full_name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                          </div>
                        )}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs ${
                          isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                        }`}
                        title={isOnline ? 'Online agora no GED' : 'Offline / Ausente'}
                      />
                    </div>

                    {/* Texts */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {user.full_name}
                        </h4>
                        {user.role === 'admin' && (
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" title="Administrador" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <span className="font-semibold text-slate-700">{user.sector}</span>
                        <span>•</span>
                        <span className={isOnline ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                          {isOnline ? 'Online' : 'Ausente'}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Call Trigger Button */}
                  <div className="shrink-0">
                    <button
                      type="button"
                      disabled={!isOnline || isInCallWithMe}
                      onClick={() => onStartCall(user)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isOnline
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 hover:border-emerald-600 shadow-2xs active:scale-95'
                          : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                      }`}
                      title={
                        isOnline 
                          ? `Ligar para ${user.full_name}` 
                          : 'Usuário ausente / offline no momento'
                      }
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{isOnline ? 'Ligar' : 'Ausente'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Info */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 text-center shrink-0">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            As chamadas de voz utilizam criptografia de ponta a ponta (WebRTC) e operam diretamente entre os navegadores da equipe MVRJ.
          </p>
        </div>

      </div>
    </div>
  );
};
