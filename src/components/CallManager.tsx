import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getSupabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { IncomingCallModal } from './IncomingCallModal';
import { OutgoingCallModal } from './OutgoingCallModal';
import { ActiveCallBar } from './ActiveCallBar';
import { IntercomDrawer } from './IntercomDrawer';
import { playEndCallTone, playConnectedTone, stopCallSounds } from '../lib/call-sound';

export interface CallContextType {
  onlineUserIds: Set<string>;
  startCall: (targetUser: UserProfile) => Promise<void>;
  activeCallUserId: string | null;
  isIntercomOpen: boolean;
  setIsIntercomOpen: (open: boolean) => void;
  toggleIntercom: () => void;
  onlineCount: number;
}

const CallContext = createContext<CallContextType>({
  onlineUserIds: new Set(),
  startCall: async () => {},
  activeCallUserId: null,
  isIntercomOpen: false,
  setIsIntercomOpen: () => {},
  toggleIntercom: () => {},
  onlineCount: 0,
});

export const useCall = () => useContext(CallContext);

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface CallManagerProps {
  currentUser: UserProfile | null;
  profiles: UserProfile[];
  children?: React.ReactNode;
}

export const CallManager: React.FC<CallManagerProps> = ({
  currentUser,
  profiles,
  children,
}) => {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [isIntercomOpen, setIsIntercomOpen] = useState(false);

  // Call states
  const [incomingCall, setIncomingCall] = useState<{
    from: UserProfile;
    sdpOffer: RTCSessionDescriptionInit;
  } | null>(null);

  const [outgoingCall, setOutgoingCall] = useState<{
    targetUser: UserProfile;
  } | null>(null);

  const [activeCall, setActiveCall] = useState<{
    remoteUser: UserProfile;
    startTime: number;
    remoteStream: MediaStream | null;
  } | null>(null);

  // References
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const queuedCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const currentPartnerIdRef = useRef<string | null>(null);

  // Send message across Supabase Realtime and local BroadcastChannel for total resilience
  const sendSignal = useCallback((event: string, payload: any) => {
    // 1. Supabase Realtime broadcast
    if (channelRef.current) {
      try {
        channelRef.current.send({
          type: 'broadcast',
          event,
          payload,
        });
      } catch (err) {
        console.warn('Erro ao enviar sinal via Supabase:', err);
      }
    }

    // 2. Browser BroadcastChannel
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          event,
          payload,
        });
      } catch (err) {
        console.warn('Erro ao enviar sinal via BroadcastChannel:', err);
      }
    }
  }, []);

  // Stop local microphone tracks
  const stopLocalTracks = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {}
      });
      localStreamRef.current = null;
    }
  }, []);

  // Teardown Peer Connection
  const cleanupCall = useCallback(() => {
    stopCallSounds();
    stopLocalTracks();

    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.close();
      } catch {}
      peerConnectionRef.current = null;
    }

    queuedCandidatesRef.current = [];
    currentPartnerIdRef.current = null;
    setIncomingCall(null);
    setOutgoingCall(null);
    setActiveCall(null);
  }, [stopLocalTracks]);

  // Request Local Audio Stream
  const getLocalAudioStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error('Erro ao acessar microfone:', err);
      alert('Não foi possível acessar o microfone. Verifique as permissões de áudio do seu navegador.');
      return null;
    }
  }, []);

  // SIGNAL HANDLERS
  const handleIncomingInvite = useCallback(async (payload: any) => {
    if (!currentUser || !payload || payload.toId !== currentUser.id) return;

    // Se já estiver em chamada, notifica ocupado
    if (activeCall || incomingCall || outgoingCall) {
      sendSignal('call-busy', {
        fromId: currentUser.id,
        toId: payload.from.id,
      });
      return;
    }

    currentPartnerIdRef.current = payload.from.id;
    setIncomingCall({
      from: payload.from,
      sdpOffer: payload.sdpOffer,
    });
  }, [currentUser, activeCall, incomingCall, outgoingCall, sendSignal]);

  const handleIncomingAccept = useCallback(async (payload: any) => {
    if (!currentUser || !payload || payload.toId !== currentUser.id) return;

    stopCallSounds();
    playConnectedTone();

    const pc = peerConnectionRef.current;
    if (pc && payload.sdpAnswer) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdpAnswer));

        while (queuedCandidatesRef.current.length > 0) {
          const cand = queuedCandidatesRef.current.shift();
          if (cand) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
        }

        setOutgoingCall(null);
        setActiveCall(prev => ({
          remoteUser: payload.from,
          startTime: Date.now(),
          remoteStream: prev?.remoteStream || null,
        }));
      } catch (e) {
        console.error('Erro ao aplicar SDP answer:', e);
      }
    }
  }, [currentUser]);

  const handleIncomingReject = useCallback((payload: any) => {
    if (!currentUser || !payload || payload.toId !== currentUser.id) return;
    playEndCallTone();
    alert(`${payload.from?.full_name || 'O usuário'} recusou a chamada.`);
    cleanupCall();
  }, [currentUser, cleanupCall]);

  const handleIncomingBusy = useCallback((payload: any) => {
    if (!currentUser || !payload || payload.toId !== currentUser.id) return;
    playEndCallTone();
    alert('O colaborador está em outra chamada no momento.');
    cleanupCall();
  }, [currentUser, cleanupCall]);

  const handleIncomingHangup = useCallback((payload: any) => {
    if (!currentUser || !payload || payload.toId !== currentUser.id) return;
    playEndCallTone();
    cleanupCall();
  }, [currentUser, cleanupCall]);

  const handleIncomingIceCandidate = useCallback(async (payload: any) => {
    if (!currentUser || !payload || payload.toId !== currentUser.id) return;

    const pc = peerConnectionRef.current;
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (e) {
        console.warn('Falha ao adicionar candidato ICE:', e);
      }
    } else {
      queuedCandidatesRef.current.push(payload.candidate);
    }
  }, [currentUser]);

  // Supabase Realtime & BroadcastChannel Setup
  useEffect(() => {
    if (!currentUser) return;

    // Inicializa BroadcastChannel local para suporte instantâneo entre abas/janelas
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('mvrj_internal_calls_channel');
      broadcastChannelRef.current = bc;

      bc.onmessage = (e) => {
        const { event, payload } = e.data || {};
        if (!event || !payload) return;

        if (event === 'presence-ping') {
          // Responder com nosso ping
          if (bc && currentUser) {
            bc.postMessage({
              event: 'presence-pong',
              payload: {
                userId: currentUser.id,
                id: currentUser.id,
                nome: currentUser.full_name,
                full_name: currentUser.full_name,
                email: currentUser.email,
                setor: currentUser.sector,
                onlineAt: new Date().toISOString(),
              },
            });
          }
          if (payload.userId || payload.id) {
            setOnlineUserIds(prev => new Set(prev).add(payload.userId || payload.id));
          }
        } else if (event === 'presence-pong') {
          if (payload.userId || payload.id) {
            setOnlineUserIds(prev => new Set(prev).add(payload.userId || payload.id));
          }
        } else if (event === 'call-invite') {
          handleIncomingInvite(payload);
        } else if (event === 'call-accept') {
          handleIncomingAccept(payload);
        } else if (event === 'call-reject') {
          handleIncomingReject(payload);
        } else if (event === 'call-busy') {
          handleIncomingBusy(payload);
        } else if (event === 'call-hangup') {
          handleIncomingHangup(payload);
        } else if (event === 'ice-candidate') {
          handleIncomingIceCandidate(payload);
        }
      };

      // Dispara ping de presença
      bc.postMessage({
        event: 'presence-ping',
        payload: {
          userId: currentUser.id,
          id: currentUser.id,
        },
      });
    } catch (err) {
      console.warn('BroadcastChannel não suportado no navegador:', err);
    }

    // Inicializa canal Supabase Realtime
    const supabase = getSupabase();
    let supabaseChannel: any = null;

    if (supabase) {
      const channel = supabase.channel('internal-calls', {
        config: {
          presence: {
            key: currentUser.id,
          },
        },
      });

      channelRef.current = channel;
      supabaseChannel = channel;

      // Sincronização robusta de presença
      const syncPresenceState = () => {
        try {
          const state = channel.presenceState();
          const onlineIds = new Set<string>();

          // 1. Mapeia chaves de presença
          Object.keys(state).forEach(key => {
            if (key && key !== 'undefined' && key !== 'null') {
              onlineIds.add(key);
            }
          });

          // 2. Mapeia todos os userIds ativos nos objetos de presença
          Object.values(state).forEach((presences: any) => {
            if (Array.isArray(presences)) {
              presences.forEach((p: any) => {
                const uid = p.userId || p.id || p.user_id;
                if (uid) {
                  onlineIds.add(uid);
                }
              });
            }
          });

          // Garante que o próprio usuário autenticado esteja online
          if (currentUser?.id) {
            onlineIds.add(currentUser.id);
          }

          setOnlineUserIds(onlineIds);
        } catch (err) {
          console.error('Erro ao sincronizar estado de presença:', err);
        }
      };

      channel
        .on('presence', { event: 'sync' }, () => {
          syncPresenceState();
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          if (key) setOnlineUserIds(prev => new Set(prev).add(key));
          if (Array.isArray(newPresences)) {
            newPresences.forEach((p: any) => {
              const uid = p.userId || p.id || p.user_id;
              if (uid) setOnlineUserIds(prev => new Set(prev).add(uid));
            });
          }
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          syncPresenceState();
        })
        .on('broadcast', { event: 'call-invite' }, ({ payload }) => {
          handleIncomingInvite(payload);
        })
        .on('broadcast', { event: 'call-accept' }, ({ payload }) => {
          handleIncomingAccept(payload);
        })
        .on('broadcast', { event: 'call-reject' }, ({ payload }) => {
          handleIncomingReject(payload);
        })
        .on('broadcast', { event: 'call-busy' }, ({ payload }) => {
          handleIncomingBusy(payload);
        })
        .on('broadcast', { event: 'call-hangup' }, ({ payload }) => {
          handleIncomingHangup(payload);
        })
        .on('broadcast', { event: 'ice-candidate' }, ({ payload }) => {
          handleIncomingIceCandidate(payload);
        });

      // Subscrição e registo (apenas após confirmação 'SUBSCRIBED')
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await channel.track({
              userId: currentUser.id,
              id: currentUser.id,
              user_id: currentUser.id,
              nome: currentUser.full_name,
              full_name: currentUser.full_name,
              email: currentUser.email,
              setor: currentUser.sector,
              sector: currentUser.sector,
              role: currentUser.role,
              avatar_url: currentUser.avatar_url,
              onlineAt: new Date().toISOString(),
            });
            syncPresenceState();
          } catch (trackErr) {
            console.error('Erro ao registar presença no Supabase:', trackErr);
          }
        }
      });
    } else {
      // Se o Supabase não estiver configurado, garante pelo menos o próprio usuário online
      setOnlineUserIds(prev => new Set(prev).add(currentUser.id));
    }

    // Intervalo de batimento cardíaco (Heartbeat) para manter presença viva
    const heartbeatInterval = setInterval(() => {
      if (currentUser) {
        setOnlineUserIds(prev => new Set(prev).add(currentUser.id));
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({
            event: 'presence-ping',
            payload: { userId: currentUser.id, id: currentUser.id },
          });
        }
      }
    }, 15000);

    return () => {
      clearInterval(heartbeatInterval);
      if (bc) {
        bc.close();
        broadcastChannelRef.current = null;
      }
      if (supabase && supabaseChannel) {
        supabaseChannel.unsubscribe();
        supabase.removeChannel(supabaseChannel);
      }
      cleanupCall();
    };
  }, [
    currentUser, 
    cleanupCall, 
    handleIncomingInvite, 
    handleIncomingAccept, 
    handleIncomingReject, 
    handleIncomingBusy, 
    handleIncomingHangup, 
    handleIncomingIceCandidate
  ]);

  // INITIATE CALL (Outbound)
  const startCall = useCallback(async (targetUser: UserProfile) => {
    if (!currentUser) return;
    if (activeCall || incomingCall || outgoingCall) {
      alert('Você já possui uma chamada em andamento.');
      return;
    }

    const localStream = await getLocalAudioStream();
    if (!localStream) return;

    currentPartnerIdRef.current = targetUser.id;
    setOutgoingCall({ targetUser });

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionRef.current = pc;

    // Attach local audio track
    localStream.getAudioTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

    // Handle ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal('ice-candidate', {
          fromId: currentUser.id,
          toId: targetUser.id,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Handle Remote Stream
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setActiveCall(prev => ({
          remoteUser: prev?.remoteUser || targetUser,
          startTime: prev?.startTime || Date.now(),
          remoteStream: event.streams[0],
        }));
      }
    };

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);

      sendSignal('call-invite', {
        from: currentUser,
        toId: targetUser.id,
        sdpOffer: offer,
      });
    } catch (e) {
      console.error('Erro ao iniciar oferta WebRTC:', e);
      cleanupCall();
    }
  }, [currentUser, activeCall, incomingCall, outgoingCall, getLocalAudioStream, sendSignal, cleanupCall]);

  // ACCEPT CALL (Inbound)
  const handleAcceptCall = useCallback(async () => {
    if (!currentUser || !incomingCall) return;

    stopCallSounds();
    const caller = incomingCall.from;
    const sdpOffer = incomingCall.sdpOffer;

    const localStream = await getLocalAudioStream();
    if (!localStream) {
      handleRejectCall();
      return;
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionRef.current = pc;

    localStream.getAudioTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal('ice-candidate', {
          fromId: currentUser.id,
          toId: caller.id,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setActiveCall(prev => ({
          remoteUser: prev?.remoteUser || caller,
          startTime: prev?.startTime || Date.now(),
          remoteStream: event.streams[0],
        }));
      }
    };

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdpOffer));

      // Process queued candidates
      while (queuedCandidatesRef.current.length > 0) {
        const cand = queuedCandidatesRef.current.shift();
        if (cand) {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendSignal('call-accept', {
        from: currentUser,
        toId: caller.id,
        sdpAnswer: answer,
      });

      setIncomingCall(null);
      setActiveCall({
        remoteUser: caller,
        startTime: Date.now(),
        remoteStream: null,
      });

      playConnectedTone();
    } catch (e) {
      console.error('Erro ao aceitar chamada:', e);
      cleanupCall();
    }
  }, [currentUser, incomingCall, getLocalAudioStream, sendSignal, cleanupCall]);

  // REJECT CALL
  const handleRejectCall = useCallback(() => {
    if (incomingCall && currentUser) {
      sendSignal('call-reject', {
        from: currentUser,
        toId: incomingCall.from.id,
      });
    }
    cleanupCall();
  }, [incomingCall, currentUser, sendSignal, cleanupCall]);

  // CANCEL OUTGOING CALL
  const handleCancelOutgoingCall = useCallback(() => {
    if (outgoingCall && currentUser) {
      sendSignal('call-hangup', {
        fromId: currentUser.id,
        toId: outgoingCall.targetUser.id,
      });
    }
    cleanupCall();
  }, [outgoingCall, currentUser, sendSignal, cleanupCall]);

  // HANGUP ACTIVE CALL
  const handleHangupCall = useCallback(() => {
    const partnerId = activeCall?.remoteUser?.id || currentPartnerIdRef.current;
    if (partnerId && currentUser) {
      sendSignal('call-hangup', {
        fromId: currentUser.id,
        toId: partnerId,
      });
    }
    playEndCallTone();
    cleanupCall();
  }, [activeCall, currentUser, sendSignal, cleanupCall]);

  const toggleIntercom = useCallback(() => {
    setIsIntercomOpen(prev => !prev);
  }, []);

  const activeCallUserId = activeCall?.remoteUser?.id || outgoingCall?.targetUser?.id || null;

  const otherOnlineCount = profiles.filter(p => p.id !== currentUser?.id && onlineUserIds.has(p.id)).length;

  return (
    <CallContext.Provider
      value={{
        onlineUserIds,
        startCall,
        activeCallUserId,
        isIntercomOpen,
        setIsIntercomOpen,
        toggleIntercom,
        onlineCount: otherOnlineCount,
      }}
    >
      {children}

      {/* Incoming Call Modal */}
      {incomingCall && (
        <IncomingCallModal
          caller={incomingCall.from}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}

      {/* Outgoing Call Modal */}
      {outgoingCall && (
        <OutgoingCallModal
          targetUser={outgoingCall.targetUser}
          onCancel={handleCancelOutgoingCall}
        />
      )}

      {/* Active Floating Call Bar */}
      {activeCall && (
        <ActiveCallBar
          remoteUser={activeCall.remoteUser}
          remoteStream={activeCall.remoteStream}
          localStream={localStreamRef.current}
          startTime={activeCall.startTime}
          onHangup={handleHangupCall}
        />
      )}

      {/* Intercom Drawer */}
      {currentUser && (
        <IntercomDrawer
          isOpen={isIntercomOpen}
          onClose={() => setIsIntercomOpen(false)}
          currentUser={currentUser}
          profiles={profiles}
          onlineUserIds={onlineUserIds}
          onStartCall={(target) => {
            setIsIntercomOpen(false);
            startCall(target);
          }}
          activeCallUserId={activeCallUserId}
        />
      )}
    </CallContext.Provider>
  );
};
