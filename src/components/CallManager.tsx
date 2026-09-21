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
  const queuedCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const currentPartnerIdRef = useRef<string | null>(null);

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

  // Supabase Realtime Signaling & Presence Channel
  useEffect(() => {
    if (!currentUser) return;

    const supabase = getSupabase();
    if (!supabase) return;

    const channel = supabase.channel('internal-calls', {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    });

    channelRef.current = channel;

    // Presence Handlers
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineIds = new Set<string>();
        Object.keys(state).forEach(key => {
          onlineIds.add(key);
        });
        setOnlineUserIds(onlineIds);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineUserIds(prev => new Set(prev).add(key));
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUserIds(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      });

    // Broadcast Signaling Events
    channel
      .on('broadcast', { event: 'call-invite' }, async ({ payload }) => {
        if (!payload || payload.toId !== currentUser.id) return;

        // If already in a call, notify caller that user is busy
        if (activeCall || incomingCall || outgoingCall) {
          channel.send({
            type: 'broadcast',
            event: 'call-busy',
            payload: {
              fromId: currentUser.id,
              toId: payload.from.id,
            },
          });
          return;
        }

        currentPartnerIdRef.current = payload.from.id;
        setIncomingCall({
          from: payload.from,
          sdpOffer: payload.sdpOffer,
        });
      })
      .on('broadcast', { event: 'call-accept' }, async ({ payload }) => {
        if (!payload || payload.toId !== currentUser.id) return;

        stopCallSounds();
        playConnectedTone();

        const pc = peerConnectionRef.current;
        if (pc && payload.sdpAnswer) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdpAnswer));

            // Process queued candidates
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
      })
      .on('broadcast', { event: 'call-reject' }, ({ payload }) => {
        if (!payload || payload.toId !== currentUser.id) return;
        playEndCallTone();
        alert(`${payload.from?.full_name || 'O usuário'} recusou a chamada.`);
        cleanupCall();
      })
      .on('broadcast', { event: 'call-busy' }, ({ payload }) => {
        if (!payload || payload.toId !== currentUser.id) return;
        playEndCallTone();
        alert('O colaborador está em outra chamada no momento.');
        cleanupCall();
      })
      .on('broadcast', { event: 'call-hangup' }, ({ payload }) => {
        if (!payload || payload.toId !== currentUser.id) return;
        playEndCallTone();
        cleanupCall();
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (!payload || payload.toId !== currentUser.id) return;

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
      });

    // Subscribe and Track Presence
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          id: currentUser.id,
          full_name: currentUser.full_name,
          email: currentUser.email,
          sector: currentUser.sector,
          role: currentUser.role,
          avatar_url: currentUser.avatar_url,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      cleanupCall();
    };
  }, [currentUser, cleanupCall, activeCall, incomingCall, outgoingCall]);

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
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            fromId: currentUser.id,
            toId: targetUser.id,
            candidate: event.candidate.toJSON(),
          },
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

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'call-invite',
          payload: {
            from: currentUser,
            toId: targetUser.id,
            sdpOffer: offer,
          },
        });
      }
    } catch (e) {
      console.error('Erro ao iniciar oferta WebRTC:', e);
      cleanupCall();
    }
  }, [currentUser, activeCall, incomingCall, outgoingCall, getLocalAudioStream, cleanupCall]);

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
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            fromId: currentUser.id,
            toId: caller.id,
            candidate: event.candidate.toJSON(),
          },
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

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'call-accept',
          payload: {
            from: currentUser,
            toId: caller.id,
            sdpAnswer: answer,
          },
        });
      }

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
  }, [currentUser, incomingCall, getLocalAudioStream, cleanupCall]);

  // REJECT CALL
  const handleRejectCall = useCallback(() => {
    if (incomingCall && channelRef.current && currentUser) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'call-reject',
        payload: {
          from: currentUser,
          toId: incomingCall.from.id,
        },
      });
    }
    cleanupCall();
  }, [incomingCall, currentUser, cleanupCall]);

  // CANCEL OUTGOING CALL
  const handleCancelOutgoingCall = useCallback(() => {
    if (outgoingCall && channelRef.current && currentUser) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'call-hangup',
        payload: {
          fromId: currentUser.id,
          toId: outgoingCall.targetUser.id,
        },
      });
    }
    cleanupCall();
  }, [outgoingCall, currentUser, cleanupCall]);

  // HANGUP ACTIVE CALL
  const handleHangupCall = useCallback(() => {
    const partnerId = activeCall?.remoteUser?.id || currentPartnerIdRef.current;
    if (partnerId && channelRef.current && currentUser) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'call-hangup',
        payload: {
          fromId: currentUser.id,
          toId: partnerId,
        },
      });
    }
    playEndCallTone();
    cleanupCall();
  }, [activeCall, currentUser, cleanupCall]);

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
