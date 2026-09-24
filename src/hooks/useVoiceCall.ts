'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { getAudioSettings } from '@/components/settings/SettingsModal';

export interface VoiceParticipant {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  stream?: MediaStream;
  screenStream?: MediaStream;
  isSpeaking: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
}

export interface IncomingCall {
  fromUserId: string;
  fromUsername: string;
  fromDisplayName: string;
  dmChannelId: string;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

const VIDEO_QUALITY_MAP = {
  low: { width: 320, height: 240, frameRate: 15 },
  medium: { width: 640, height: 480, frameRate: 24 },
  high: { width: 1280, height: 720, frameRate: 30 },
} as const;

// Sound synthesis helpers using Web Audio API
const soundCtxRef = { current: null as AudioContext | null };
function getSoundCtx(): AudioContext {
  if (!soundCtxRef.current || soundCtxRef.current.state === 'closed') {
    soundCtxRef.current = new AudioContext();
  }
  if (soundCtxRef.current.state === 'suspended') {
    soundCtxRef.current.resume();
  }
  return soundCtxRef.current;
}

function playJoinSound() {
  try {
    const ctx = getSoundCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch {}
}

function playLeaveSound() {
  try {
    const ctx = getSoundCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch {}
}

export function useVoiceCall(socket: React.MutableRefObject<any>, onError?: (msg: string) => void) {
  const [participants, setParticipants] = useState<Map<string, VoiceParticipant>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [currentRoomType, setCurrentRoomType] = useState<'channel' | 'dm' | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [socketReady, setSocketReady] = useState(false);

  // Poll until socket.current is available
  useEffect(() => {
    if (socket.current) { setSocketReady(true); return; }
    const interval = setInterval(() => {
      if (socket.current) { setSocketReady(true); clearInterval(interval); }
    }, 100);
    return () => clearInterval(interval);
  }, [socket]);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const localScreenStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const remoteStreams = useRef<Map<string, { audio: HTMLAudioElement; video?: HTMLVideoElement }>>(new Map());
  const isMutedRef = useRef(false);
  const currentRoomRef = useRef<string | null>(null);
  const currentRoomTypeRef = useRef<'channel' | 'dm' | null>(null);

  // Keep refs in sync with state to avoid stale closures
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { currentRoomRef.current = currentRoom; }, [currentRoom]);
  useEffect(() => { currentRoomTypeRef.current = currentRoomType; }, [currentRoomType]);

  const createPeerConnection = useCallback((remoteUserId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.current?.emit('voice_ice_candidate', { targetUserId: remoteUserId, candidate: event.candidate, room: currentRoom });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;
      setParticipants(prev => {
        const next = new Map(prev);
        const existing = next.get(remoteUserId) || { userId: remoteUserId, username: '', displayName: '', avatarUrl: null, isSpeaking: false, isMuted: false, isVideoOff: true, isScreenSharing: false };
        const hasVideo = event.track.kind === 'video';
        next.set(remoteUserId, { ...existing, stream, isVideoOff: !hasVideo });
        return next;
      });

      // Play audio
      const existingEl = remoteStreams.current.get(remoteUserId);
      if (existingEl?.audio) {
        existingEl.audio.srcObject = stream;
      } else {
        const audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;
        const settings = getAudioSettings();
        if (settings.outputDeviceId !== 'default' && typeof audio.setSinkId === 'function') {
          (audio as any).setSinkId(settings.outputDeviceId).catch(() => {});
        }
        audio.play().catch(() => {});
        remoteStreams.current.set(remoteUserId, { audio });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        pc.close();
        peerConnections.current.delete(remoteUserId);
        setParticipants(prev => { const next = new Map(prev); next.delete(remoteUserId); return next; });
        const el = remoteStreams.current.get(remoteUserId);
        if (el) { el.audio.srcObject = null; remoteStreams.current.delete(remoteUserId); }
      }
    };

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
    }
    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localScreenStreamRef.current!));
    }

    peerConnections.current.set(remoteUserId, pc);
    return pc;
  }, [socket, currentRoom]);

  const startSpeakingDetection = useCallback(() => {
    if (!localStreamRef.current) return;
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(localStreamRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      speakingIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const speaking = avg > 15;
        socket.current?.emit('voice_speaking', { room: currentRoom, isSpeaking: speaking });
      }, 200);
    } catch {}
  }, [socket, currentRoom]);

  const joinVoice = useCallback(async (roomId: string, roomType: 'channel' | 'dm', selfUser: { id: string; username: string; displayName: string; avatarUrl: string | null }) => {
    const settings = getAudioSettings();
    const audioConstraints: MediaTrackConstraints | boolean = settings.inputDeviceId !== 'default' ? { deviceId: { exact: settings.inputDeviceId } } : true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
      localStreamRef.current = stream;
      setLocalStream(stream);

      // Add self to participants
      setParticipants(prev => {
        const next = new Map(prev);
        next.set(selfUser.id, { ...selfUser, userId: selfUser.id, stream, isSpeaking: false, isMuted: false, isVideoOff: true, isScreenSharing: false });
        return next;
      });

      setCurrentRoom(roomId);
      setCurrentRoomType(roomType);
      setIsConnected(true);
      playJoinSound();

      const roomKey = roomType === 'dm' ? `dm:${roomId}` : roomId;
      socket.current?.emit('voice_join', { room: roomKey, roomType });

      startSpeakingDetection();
    } catch (err) {
      console.error('Failed to join voice:', err);
      if (onError) {
        onError('No se pudo acceder al micrófono. Verifica los permisos.');
      }
    }
  }, [socket, startSpeakingDetection]);

  const leaveVoice = useCallback(() => {
    // Close all peer connections
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();

    // Stop local streams
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; setLocalStream(null); }
    if (localScreenStreamRef.current) { localScreenStreamRef.current.getTracks().forEach(t => t.stop()); localScreenStreamRef.current = null; setLocalScreenStream(null); }

    // Stop audio elements
    remoteStreams.current.forEach(el => { el.audio.srcObject = null; });
    remoteStreams.current.clear();

    // Stop speaking detection
    if (speakingIntervalRef.current) clearInterval(speakingIntervalRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    analyserRef.current = null;

    playLeaveSound();

    const roomKey = currentRoomTypeRef.current === 'dm' ? `dm:${currentRoomRef.current}` : currentRoomRef.current;
    socket.current?.emit('voice_leave', { room: roomKey });

    setParticipants(new Map());
    setIsConnected(false);
    setCurrentRoom(null);
    setCurrentRoomType(null);
    setIsMuted(false);
    setIsVideoOff(true);
    setIsScreenSharing(false);
  }, [socket]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTracks = localStreamRef.current.getAudioTracks();
    const newMuted = !isMutedRef.current;
    audioTracks.forEach(t => t.enabled = !newMuted);
    setIsMuted(newMuted);
    const roomKey = currentRoomTypeRef.current === 'dm' ? `dm:${currentRoomRef.current}` : currentRoomRef.current;
    socket.current?.emit('voice_mute', { room: roomKey, isMuted: newMuted });
  }, [socket]);

  const toggleVideo = useCallback(async () => {
    if (isVideoOff) {
      try {
        const settings = getAudioSettings();
        const q = VIDEO_QUALITY_MAP[settings.videoQuality || 'medium'];
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: q.width }, height: { ideal: q.height }, frameRate: { ideal: q.frameRate } },
        });
        const videoTrack = videoStream.getVideoTracks()[0];
        if (localStreamRef.current) {
          localStreamRef.current.addTrack(videoTrack);
        }
        // Send to all peers
        peerConnections.current.forEach(pc => {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          if (videoSender) videoSender.replaceTrack(videoTrack);
          else pc.addTrack(videoTrack, localStreamRef.current!);
        });
        setIsVideoOff(false);
        socket.current?.emit('voice_video', { room: currentRoomType === 'dm' ? `dm:${currentRoom}` : currentRoom, isVideoOff: false });
      } catch (err) {
        console.error('Failed to enable video:', err);
      }
    } else {
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(t => { t.stop(); localStreamRef.current!.removeTrack(t); });
      }
      peerConnections.current.forEach(pc => {
        const senders = pc.getSenders();
        senders.filter(s => s.track?.kind === 'video').forEach(s => s.replaceTrack(null));
      });
      setIsVideoOff(true);
      socket.current?.emit('voice_video', { room: currentRoomType === 'dm' ? `dm:${currentRoom}` : currentRoom, isVideoOff: true });
    }
  }, [isVideoOff, socket, currentRoom, currentRoomType]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      if (localScreenStreamRef.current) {
        localScreenStreamRef.current.getTracks().forEach(t => t.stop());
        localScreenStreamRef.current = null;
        setLocalScreenStream(null);
      }
      peerConnections.current.forEach(pc => {
        const senders = pc.getSenders();
        senders.filter(s => s.track?.kind === 'video' && s.track?.id?.startsWith('screen')).forEach(s => s.replaceTrack(null));
      });
      setIsScreenSharing(false);
      socket.current?.emit('voice_screen', { room: currentRoomType === 'dm' ? `dm:${currentRoom}` : currentRoom, isScreenSharing: false });
    } else {
      try {
        const ssSettings = getAudioSettings();
        const ssQ = VIDEO_QUALITY_MAP[ssSettings.videoQuality || 'medium'];
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: ssQ.frameRate } },
          audio: false,
        });
        localScreenStreamRef.current = screenStream;
        setLocalScreenStream(screenStream);
        const screenTrack = screenStream.getVideoTracks()[0];
        (screenTrack as any)._id = 'screen_' + screenTrack.id;
        peerConnections.current.forEach(pc => {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          if (videoSender) videoSender.replaceTrack(screenTrack);
          else pc.addTrack(screenTrack, screenStream);
        });
        setIsScreenSharing(true);
        socket.current?.emit('voice_screen', { room: currentRoomType === 'dm' ? `dm:${currentRoom}` : currentRoom, isScreenSharing: true });
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          localScreenStreamRef.current = null;
          setLocalScreenStream(null);
          socket.current?.emit('voice_screen', { room: currentRoomType === 'dm' ? `dm:${currentRoom}` : currentRoom, isScreenSharing: false });
        };
      } catch (err) {
        console.error('Screen share failed:', err);
      }
    }
  }, [isScreenSharing, socket, currentRoom, currentRoomType]);

  const callUser = useCallback((targetUserId: string, dmChannelId: string, selfUser: { id: string; username: string; displayName: string; avatarUrl: string | null }) => {
    socket.current?.emit('voice_call', { targetUserId, dmChannelId });
    joinVoice(dmChannelId, 'dm', selfUser);
  }, [socket, joinVoice]);

  const acceptCall = useCallback((fromUserId: string, dmChannelId: string, selfUser: { id: string; username: string; displayName: string; avatarUrl: string | null }) => {
    socket.current?.emit('voice_accept', { targetUserId: fromUserId, dmChannelId });
    setIncomingCall(null);
    joinVoice(dmChannelId, 'dm', selfUser);
  }, [socket, joinVoice]);

  const rejectCall = useCallback((fromUserId: string, dmChannelId: string) => {
    socket.current?.emit('voice_reject', { targetUserId: fromUserId, dmChannelId });
    setIncomingCall(null);
  }, [socket]);

  // Socket event listeners for voice
  useEffect(() => {
    if (!socketReady || !socket.current) return;
    const s = socket.current;
    if (!s || typeof s.on !== 'function') return;

    const onVoiceUserJoined = (data: any) => {
      const { userId, username, displayName, avatarUrl } = data;
      setParticipants(prev => {
        const next = new Map(prev);
        if (!next.has(userId)) {
          next.set(userId, { userId, username, displayName, avatarUrl, isSpeaking: false, isMuted: false, isVideoOff: true, isScreenSharing: false });
        }
        return next;
      });
      playJoinSound();
      // Create peer connection and offer
      const pc = createPeerConnection(userId);
      pc.createOffer().then(offer => pc.setLocalDescription(offer)).then(() => {
        socket.current?.emit('voice_offer', { targetUserId: userId, offer: pc.localDescription, room: currentRoomTypeRef.current === 'dm' ? `dm:${currentRoomRef.current}` : currentRoomRef.current });
      }).catch(console.error);
    };

    const onVoiceUserLeft = (data: any) => {
      const { userId } = data;
      const pc = peerConnections.current.get(userId);
      if (pc) { pc.close(); peerConnections.current.delete(userId); }
      const el = remoteStreams.current.get(userId);
      if (el) { el.audio.srcObject = null; remoteStreams.current.delete(userId); }
      setParticipants(prev => { const next = new Map(prev); next.delete(userId); return next; });
      playLeaveSound();
    };

    const onVoiceOffer = async (data: any) => {
      const { fromUserId, offer } = data;
      const pc = createPeerConnection(fromUserId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.current?.emit('voice_answer', { targetUserId: fromUserId, answer: pc.localDescription, room: currentRoomType === 'dm' ? `dm:${currentRoom}` : currentRoom });
    };

    const onVoiceAnswer = async (data: any) => {
      const { fromUserId, answer } = data;
      const pc = peerConnections.current.get(fromUserId);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const onVoiceIce = async (data: any) => {
      const { fromUserId, candidate } = data;
      const pc = peerConnections.current.get(fromUserId);
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
    };

    const onVoiceSpeaking = (data: any) => {
      const { userId, isSpeaking } = data;
      setParticipants(prev => { const next = new Map(prev); const p = next.get(userId); if (p) next.set(userId, { ...p, isSpeaking }); return next; });
    };

    const onVoiceMute = (data: any) => {
      const { userId, isMuted } = data;
      setParticipants(prev => { const next = new Map(prev); const p = next.get(userId); if (p) next.set(userId, { ...p, isMuted }); return next; });
    };

    const onVoiceIncomingCall = (data: any) => {
      setIncomingCall({ fromUserId: data.fromUserId, fromUsername: data.fromUsername, fromDisplayName: data.fromDisplayName, dmChannelId: data.dmChannelId });
    };

    const onVoiceCallRejected = () => {
      leaveVoice();
    };

    s.on('voice_user_joined', onVoiceUserJoined);
    s.on('voice_user_left', onVoiceUserLeft);
    s.on('voice_offer', onVoiceOffer);
    s.on('voice_answer', onVoiceAnswer);
    s.on('voice_ice_candidate', onVoiceIce);
    s.on('voice_speaking_update', onVoiceSpeaking);
    s.on('voice_mute_update', onVoiceMute);
    s.on('voice_incoming_call', onVoiceIncomingCall);
    s.on('voice_call_rejected', onVoiceCallRejected);

    return () => {
      s.off('voice_user_joined', onVoiceUserJoined);
      s.off('voice_user_left', onVoiceUserLeft);
      s.off('voice_offer', onVoiceOffer);
      s.off('voice_answer', onVoiceAnswer);
      s.off('voice_ice_candidate', onVoiceIce);
      s.off('voice_speaking_update', onVoiceSpeaking);
      s.off('voice_mute_update', onVoiceMute);
      s.off('voice_incoming_call', onVoiceIncomingCall);
      s.off('voice_call_rejected', onVoiceCallRejected);
    };
  }, [socketReady, socket, createPeerConnection, currentRoom, currentRoomType, leaveVoice]);

  return {
    participants, isConnected, currentRoom, currentRoomType,
    isMuted, isVideoOff, isScreenSharing, incomingCall,
    localStream, localScreenStream,
    joinVoice, leaveVoice, toggleMute, toggleVideo, toggleScreenShare,
    callUser, acceptCall, rejectCall,
  };
}