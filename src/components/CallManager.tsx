import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getSupabaseAsync } from '../lib/supabase';
import { UserProfile } from '../types';
import { IncomingCallModal } from './IncomingCallModal';
import { OutgoingCallModal } from './OutgoingCallModal';
import { ActiveCallBar } from './ActiveCallBar';
import { IntercomDrawer } from './IntercomDrawer';
import { playEndCallTone, playConnectedTone, stopCallSounds } from '../lib/call-sound';

export interface CallContextType {
  onlineUserIds: Set<string>;
  onlineEmails: Set<string>;
  isUserOnline: (user: UserProfile) => boolean;
  startCall: (targetUser: UserProfile) => Promise<void>;
  activeCallUserId: string | null;
  isIntercomOpen: boolean;
  setIsIntercomOpen: (open: boolean) => void;
  toggleIntercom: () => void;
  onlineCount: number;
  testMode: boolean;
  setTestMode: (enabled: boolean | ((prev: boolean) => boolean)) => void;
}

const CallContext = createContext<CallContextType>({
  onlineUserIds: new Set(),
  onlineEmails: new Set(),
  isUserOnline: () => true,
  startCall: async () => {},
  activeCallUserId: null,
  isIntercomOpen: false,
  setIsIntercomOpen: () => {},
  toggleIntercom: () => {},
  onlineCount: 0,
  testMode: false,
  setTestMode: () => {},
});

export const useCall = () => useContext(CallContext);

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.syncthing.net:3478' },
  ],
  iceCandidatePoolSize: 10,
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
  const [onlineEmails, setOnlineEmails] = useState<Set<string>>(new Set());
  const [isIntercomOpen, setIsIntercomOpen] = useState(false);
  const [testMode, setTestMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mvrj_intercom_test_mode') === 'true';
    } catch {
      return false;
    }
  });

  const handleSetTestMode = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
    setTestMode(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      try {
        localStorage.setItem('mvrj_intercom_test_mode', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Check if a given user is online
  const isUserOnline = useCallback((user: UserProfile): boolean => {
    if (!user) return false;
    if (testMode) return true;

    const uid = String(user.id || '').trim().toLowerCase();
    const uEmail = String(user.email || '').trim().toLowerCase();
    const authId = String((user as any).auth_id || (user as any).user_id || '').trim().toLowerCase();

    if (uid && onlineUserIds.has(uid)) return true;
    if (uEmail && onlineEmails.has(uEmail)) return true;
    if (authId && onlineUserIds.has(authId)) return true;

    // Se estiver em modo padrão, por cortesia mantém verde para que o usuário sempre possa testar discagem
    return true;
  }, [onlineUserIds, onlineEmails, testMode]);

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
  const sseClientIdRef = useRef<string | null>(null);
  const queuedCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const currentPartnerRef = useRef<{ id: string; email: string } | null>(null);
  const inviteIntervalRef = useRef<any>(null);

  // Helper to test if a signal is addressed to the currently logged in user
  const isTargetForMe = useCallback((payload: any) => {
    if (!currentUser || !payload) return false;

    const myId = String(currentUser.id || '').trim().toLowerCase();
    const myEmail = String(currentUser.email || '').trim().toLowerCase();
    const myAuthId = String((currentUser as any).auth_id || (currentUser as any).user_id || '').trim().toLowerCase();

    // 1. Verificação de Origem: Ignorar se enviado pela MESMA aba/instância (evita eco infinito)
    if (payload.senderClientId && sseClientIdRef.current && payload.senderClientId === sseClientIdRef.current) {
      return false;
    }

    const fromId = String(payload.fromId || payload.from?.id || '').trim().toLowerCase();
    const fromEmail = String(payload.fromEmail || payload.from?.email || '').trim().toLowerCase();

    // 2. Verificação de Destino: É para mim?
    const toId = String(payload.toId || payload.targetId || '').trim().toLowerCase();
    const toEmail = String(payload.toEmail || payload.targetEmail || '').trim().toLowerCase();
    const toUser = payload.toUser;
    const toUserId = toUser ? String(toUser.id || toUser.user_id || toUser.auth_id || '').trim().toLowerCase() : '';
    const toUserEmail = toUser ? String(toUser.email || '').trim().toLowerCase() : '';

    const isMatch = (
      (toId && (toId === myId || (myAuthId && toId === myAuthId) || toId === myEmail)) ||
      (toEmail && (toEmail === myEmail || toEmail === myId)) ||
      (toUserId && (toUserId === myId || (myAuthId && toUserId === myAuthId) || toUserId === myEmail)) ||
      (toUserEmail && (toUserEmail === myEmail || toUserEmail === myId))
    );

    if (isMatch) {
      console.log('[isTargetForMe] Match detectado!', { event: payload.event, from: fromEmail || fromId });
    }

    return isMatch;
  }, [currentUser]);

  // Send message across Server SSE Bus, Supabase Realtime, and Browser BroadcastChannel
  const sendSignal = useCallback((event: string, payload: any) => {
    const enhancedPayload = {
      ...payload,
      fromId: currentUser?.id,
      fromEmail: currentUser?.email,
      from: currentUser,
      senderClientId: sseClientIdRef.current,
    };

    console.log(`[Call Signal SEND: ${event}]`, enhancedPayload);

    // 1. Post to Server Signaling Bus (cross-device/cross-network instant relay)
    fetch('/api/calls/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        payload: enhancedPayload,
        senderClientId: sseClientIdRef.current,
      }),
    }).catch(err => {
      console.warn('Erro ao enviar sinal para /api/calls/signal:', err);
    });

    // 2. Supabase Realtime broadcast (if connected)
    if (channelRef.current) {
      try {
        channelRef.current.send({
          type: 'broadcast',
          event,
          payload: enhancedPayload,
        });
      } catch (err) {
        console.warn('Erro ao enviar sinal via Supabase:', err);
      }
    }

    // 3. Browser BroadcastChannel (same-browser tabs)
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          event,
          payload: enhancedPayload,
        });
      } catch (err) {
        console.warn('Erro ao enviar sinal via BroadcastChannel:', err);
      }
    }
  }, [currentUser]);

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

    if (inviteIntervalRef.current) {
      clearInterval(inviteIntervalRef.current);
      inviteIntervalRef.current = null;
    }

    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.close();
      } catch {}
      peerConnectionRef.current = null;
    }

    queuedCandidatesRef.current = [];
    currentPartnerRef.current = null;
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
    if (!isTargetForMe(payload)) return;

    console.log('[Call RECV: call-invite]', payload);

    // Se já estiver em chamada, notifica ocupado
    if (activeCall || incomingCall || outgoingCall) {
      sendSignal('call-busy', {
        toId: payload.from?.id,
        toEmail: payload.from?.email,
        toUser: payload.from,
      });
      return;
    }

    currentPartnerRef.current = {
      id: payload.from?.id,
      email: payload.from?.email,
    };

    setIncomingCall({
      from: payload.from,
      sdpOffer: payload.sdpOffer,
    });
  }, [isTargetForMe, activeCall, incomingCall, outgoingCall, sendSignal]);

  const handleIncomingAccept = useCallback(async (payload: any) => {
    if (!isTargetForMe(payload)) return;

    console.log('[Call RECV: call-accept]', payload);
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
  }, [isTargetForMe]);

  const handleIncomingReject = useCallback((payload: any) => {
    if (!isTargetForMe(payload)) return;
    console.log('[Call RECV: call-reject]', payload);
    playEndCallTone();
    alert(`${payload.from?.full_name || 'O usuário'} recusou a chamada.`);
    cleanupCall();
  }, [isTargetForMe, cleanupCall]);

  const handleIncomingBusy = useCallback((payload: any) => {
    if (!isTargetForMe(payload)) return;
    console.log('[Call RECV: call-busy]', payload);
    playEndCallTone();
    alert('O colaborador está em outra chamada no momento.');
    cleanupCall();
  }, [isTargetForMe, cleanupCall]);

  const handleIncomingHangup = useCallback((payload: any) => {
    if (!isTargetForMe(payload)) return;
    console.log('[Call RECV: call-hangup]', payload);
    playEndCallTone();
    cleanupCall();
  }, [isTargetForMe, cleanupCall]);

  const handleIncomingIceCandidate = useCallback(async (payload: any) => {
    if (!isTargetForMe(payload)) return;

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
  }, [isTargetForMe]);

  // Dispatch incoming signal from any transport
  const handleIncomingSignal = useCallback((event: string, payload: any) => {
    if (event === 'call-invite') {
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
  }, [
    handleIncomingInvite,
    handleIncomingAccept,
    handleIncomingReject,
    handleIncomingBusy,
    handleIncomingHangup,
    handleIncomingIceCandidate,
  ]);

  // Setup SSE Listener, Server Presence Polling, BroadcastChannel, and Supabase Realtime
  useEffect(() => {
    if (!currentUser) return;

    let isMounted = true;

    // 1. Setup Server-Sent Events (SSE) for instant cross-device delivery
    let eventSource: EventSource | null = null;
    try {
      const sseUrl = `/api/calls/events?userId=${encodeURIComponent(currentUser.id)}&userEmail=${encodeURIComponent(currentUser.email)}&userName=${encodeURIComponent(currentUser.full_name)}&sector=${encodeURIComponent(currentUser.sector || '')}`;
      eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (!data || !data.event) return;
          if (data.event === 'connected') {
            sseClientIdRef.current = data.clientId;
            console.log('[SSE Connected]:', data.clientId);
            return;
          }
          handleIncomingSignal(data.event, data.payload);
        } catch {}
      };

      eventSource.onerror = () => {
        // EventSource will auto-reconnect
      };
    } catch (sseErr) {
      console.warn('SSE não suportado:', sseErr);
    }

    // 2. Setup Local BroadcastChannel for instant cross-tab delivery
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('mvrj_internal_calls_channel');
      broadcastChannelRef.current = bc;

      bc.onmessage = (e) => {
        const { event, payload } = e.data || {};
        if (!event || !payload) return;
        handleIncomingSignal(event, payload);
      };
    } catch (bcErr) {
      console.warn('BroadcastChannel não suportado:', bcErr);
    }

    // 3. Setup Supabase Realtime Channel
    let supabaseChannel: any = null;
    let supabaseInstance: any = null;

    getSupabaseAsync().then((sb) => {
      if (!isMounted || !sb) return;
      supabaseInstance = sb;

      try {
        const channel = sb.channel('internal-calls', {
          config: {
            broadcast: { self: false },
            presence: { key: currentUser.id || 'user' },
          },
        });

        channelRef.current = channel;
        supabaseChannel = channel;

        channel
          .on('broadcast', { event: 'call-invite' }, ({ payload }) => handleIncomingSignal('call-invite', payload))
          .on('broadcast', { event: 'call-accept' }, ({ payload }) => handleIncomingSignal('call-accept', payload))
          .on('broadcast', { event: 'call-reject' }, ({ payload }) => handleIncomingSignal('call-reject', payload))
          .on('broadcast', { event: 'call-busy' }, ({ payload }) => handleIncomingSignal('call-busy', payload))
          .on('broadcast', { event: 'call-hangup' }, ({ payload }) => handleIncomingSignal('call-hangup', payload))
          .on('broadcast', { event: 'ice-candidate' }, ({ payload }) => handleIncomingSignal('ice-candidate', payload));

        channel.subscribe((status) => {
          console.log('[Supabase Realtime Canal Status]:', status);
          if (status === 'SUBSCRIBED') {
            channel.track({
              userId: currentUser.id,
              email: currentUser.email,
              full_name: currentUser.full_name,
              sector: currentUser.sector,
            }).catch(() => {});
          }
        });
      } catch (err) {
        console.warn('Erro ao configurar canal Supabase Realtime:', err);
      }
    });

    // 4. Presence Heartbeat Function
    const sendPresenceHeartbeat = async () => {
      try {
        const res = await fetch('/api/calls/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            userEmail: currentUser.email,
            userName: currentUser.full_name,
            sector: currentUser.sector,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.onlineIds)) {
            const idSet = new Set<string>();
            const emailSet = new Set<string>();
            data.onlineIds.forEach((val: string) => {
              const str = String(val).trim().toLowerCase();
              if (str.includes('@')) {
                emailSet.add(str);
              } else {
                idSet.add(str);
              }
            });
            idSet.add(String(currentUser.id).trim().toLowerCase());
            if (currentUser.email) {
              emailSet.add(String(currentUser.email).trim().toLowerCase());
            }
            setOnlineUserIds(idSet);
            setOnlineEmails(emailSet);
          }
        }
      } catch {}
    };

    sendPresenceHeartbeat();
    const presenceInterval = setInterval(sendPresenceHeartbeat, 8000);

    return () => {
      isMounted = false;
      clearInterval(presenceInterval);
      if (eventSource) {
        eventSource.close();
      }
      if (bc) {
        bc.close();
        broadcastChannelRef.current = null;
      }
      if (supabaseInstance && supabaseChannel) {
        supabaseChannel.unsubscribe();
        supabaseInstance.removeChannel(supabaseChannel);
      }
      cleanupCall();
    };
  }, [currentUser, handleIncomingSignal, cleanupCall]);

  // INITIATE CALL (Outbound)
  const startCall = useCallback(async (targetUser: UserProfile) => {
    if (!currentUser) return;
    if (activeCall || incomingCall || outgoingCall) {
      alert('Você já possui uma chamada em andamento.');
      return;
    }

    const localStream = await getLocalAudioStream();
    if (!localStream) return;

    currentPartnerRef.current = {
      id: targetUser.id,
      email: targetUser.email,
    };
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
          toId: targetUser.id,
          toEmail: targetUser.email,
          toUser: targetUser,
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

      const sendInvite = () => {
        sendSignal('call-invite', {
          toId: targetUser.id,
          toEmail: targetUser.email,
          toUser: targetUser,
          sdpOffer: offer,
        });
      };

      sendInvite();
      
      // Re-broadcast invite every 4 seconds to ensure it's received
      inviteIntervalRef.current = setInterval(sendInvite, 4000);
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
          toId: caller.id,
          toEmail: caller.email,
          toUser: caller,
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
        toId: caller.id,
        toEmail: caller.email,
        toUser: caller,
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
        toId: incomingCall.from.id,
        toEmail: incomingCall.from.email,
        toUser: incomingCall.from,
      });
    }
    cleanupCall();
  }, [incomingCall, currentUser, sendSignal, cleanupCall]);

  // CANCEL OUTGOING CALL
  const handleCancelOutgoingCall = useCallback(() => {
    if (outgoingCall && currentUser) {
      sendSignal('call-hangup', {
        toId: outgoingCall.targetUser.id,
        toEmail: outgoingCall.targetUser.email,
        toUser: outgoingCall.targetUser,
      });
    }
    cleanupCall();
  }, [outgoingCall, currentUser, sendSignal, cleanupCall]);

  // HANGUP ACTIVE CALL
  const handleHangupCall = useCallback(() => {
    const partner = activeCall?.remoteUser || currentPartnerRef.current;
    if (partner && currentUser) {
      sendSignal('call-hangup', {
        toId: partner.id,
        toEmail: partner.email,
        toUser: partner,
      });
    }
    playEndCallTone();
    cleanupCall();
  }, [activeCall, currentUser, sendSignal, cleanupCall]);

  const toggleIntercom = useCallback(() => {
    setIsIntercomOpen(prev => !prev);
  }, []);

  const activeCallUserId = activeCall?.remoteUser?.id || outgoingCall?.targetUser?.id || null;

  const otherOnlineCount = profiles.filter(p => {
    if (String(p.id).toLowerCase() === String(currentUser?.id || '').toLowerCase()) return false;
    return isUserOnline(p);
  }).length;

  return (
    <CallContext.Provider
      value={{
        onlineUserIds,
        onlineEmails,
        isUserOnline,
        startCall,
        activeCallUserId,
        isIntercomOpen,
        setIsIntercomOpen,
        toggleIntercom,
        onlineCount: otherOnlineCount,
        testMode,
        setTestMode: handleSetTestMode,
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
          isUserOnline={isUserOnline}
          testMode={testMode}
          onToggleTestMode={() => handleSetTestMode(prev => !prev)}
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
