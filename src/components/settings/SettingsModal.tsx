'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AudioSettings {
  outputDeviceId: string;
  inputDeviceId: string;
  inputVolume: number;
  videoQuality: 'low' | 'medium' | 'high';
}

const SETTINGS_KEY = 'iluminode_audio_settings';

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { outputDeviceId: 'default', inputDeviceId: 'default', inputVolume: 100, videoQuality: 'medium' as const };
}

function saveSettings(s: AudioSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [section, setSection] = useState<'voice' | 'appearance' | 'about'>('voice');
  const [settings, setSettings] = useState<AudioSettings>(loadSettings);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [micLevel, setMicLevel] = useState(0);
  const [testingMic, setTestingMic] = useState(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!isOpen) return;
    async function enumerate() {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tempStream.getTracks().forEach(t => t.stop());
        const devices = await navigator.mediaDevices.enumerateDevices();
        setOutputDevices(devices.filter(d => d.kind === 'audiooutput'));
        setInputDevices(devices.filter(d => d.kind === 'audioinput'));
      } catch {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setOutputDevices(devices.filter(d => d.kind === 'audiooutput'));
        setInputDevices(devices.filter(d => d.kind === 'audioinput'));
      }
    }
    enumerate();
    return () => { stopMicTest(); };
  }, [isOpen]);

  function stopMicTest() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    analyserRef.current = null;
    setTestingMic(false);
    setMicLevel(0);
  }

  async function startMicTest() {
    if (testingMic) { stopMicTest(); return; }
    try {
      const constraints: MediaStreamConstraints = { audio: settings.inputDeviceId !== 'default' ? { deviceId: { exact: settings.inputDeviceId } } : true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      setTestingMic(true);
      const data = new Uint8Array(analyser.frequencyBinCount);
      function tick() {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setMicLevel(Math.min(100, Math.round(avg * 2)));
        rafRef.current = requestAnimationFrame(tick);
      }
      tick();
    } catch (err) {
      console.error('Mic test error:', err);
    }
  }

  function updateSetting<K extends keyof AudioSettings>(key: K, value: AudioSettings[K]) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings(next);
  }

  const sections = [
    { id: 'voice' as const, label: 'Voz y Audio', icon: '[m]' },
    { id: 'appearance' as const, label: 'Apariencia', icon: '[~]' },
    { id: 'about' as const, label: 'Acerca de', icon: '[i]' },
  ];

  const selectStyle = {
    background: 'rgba(0,0,0,.3)',
    border: '2px solid rgba(255,255,255,.15)',
    color: '#fff',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,10,20,.8)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
          <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-2xl rounded-2xl overflow-hidden flex max-h-[85vh]"
            style={{ background: 'linear-gradient(to bottom, rgba(30,60,90,.95) 0%, rgba(20,40,60,.95) 100%)', border: '2px solid rgba(255,255,255,.2)', boxShadow: '0 20px 60px rgba(0,0,0,.5), 0 0 60px rgba(100,180,255,.1)' }}
            onClick={e => e.stopPropagation()}>
            {/* Sidebar */}
            <div className="w-48 flex-shrink-0 flex flex-col" style={{ borderRight: '1px solid rgba(255,255,255,.1)' }}>
              <div className="p-4" style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>
                <h2 className="text-lg font-bold text-white">Ajustes</h2>
              </div>
              <div className="flex-1 p-2 space-y-0.5 overflow-y-auto">
                {sections.map(s => (
                  <button key={s.id} onClick={() => setSection(s.id)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-all duration-200"
                    style={{
                      background: section === s.id ? 'rgba(109,213,250,.15)' : 'transparent',
                      color: section === s.id ? '#6dd5fa' : 'rgba(255,255,255,.7)',
                      boxShadow: section === s.id ? '0 0 12px rgba(100,180,255,.2)' : 'none',
                    }}
                    onMouseEnter={e => { if (section !== s.id) { e.currentTarget.style.background = 'rgba(255,255,255,.08)'; e.currentTarget.style.color = '#fff'; } }}
                    onMouseLeave={e => { if (section !== s.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,.7)'; } }}>
                    <span>{s.icon}</span>{s.label}
                  </button>
                ))}
              </div>
              <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,.1)' }}>
                <button onClick={onClose} className="w-full px-3 py-2 rounded-lg text-sm transition-colors text-left"
                  style={{ color: '#ffa694' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,100,80,.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>[X] Cerrar</button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {section === 'voice' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-white">Voz y Audio</h3>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,.7)' }}>Configura tus dispositivos de audio para las llamadas.</p>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,.7)' }}>Dispositivo de salida (altavoces)</label>
                    <select value={settings.outputDeviceId} onChange={e => updateSetting('outputDeviceId', e.target.value)}
                      className="an-input w-full rounded-lg px-4 py-2.5 outline-none transition-all" style={selectStyle}>
                      <option value="default" style={{ background: '#0a2540' }}>Predeterminado del sistema</option>
                      {outputDevices.map(d => <option key={d.deviceId} value={d.deviceId} style={{ background: '#0a2540' }}>{d.label || `Dispositivo ${d.deviceId.slice(0, 8)}`}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,.7)' }}>Dispositivo de entrada (micrófono)</label>
                    <select value={settings.inputDeviceId} onChange={e => updateSetting('inputDeviceId', e.target.value)}
                      className="an-input w-full rounded-lg px-4 py-2.5 outline-none transition-all" style={selectStyle}>
                      <option value="default" style={{ background: '#0a2540' }}>Predeterminado del sistema</option>
                      {inputDevices.map(d => <option key={d.deviceId} value={d.deviceId} style={{ background: '#0a2540' }}>{d.label || `Dispositivo ${d.deviceId.slice(0, 8)}`}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,.7)' }}>Volumen de entrada: {settings.inputVolume}%</label>
                    <input type="range" min={0} max={200} value={settings.inputVolume} onChange={e => updateSetting('inputVolume', parseInt(e.target.value))}
                      className="w-full" style={{ accentColor: '#6dd5fa' }} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,.7)' }}>Calidad de video</label>
                    <div className="flex gap-3">
                      {([['low', 'Baja (320×240, 15fps)'], ['medium', 'Media (640×480, 24fps)'], ['high', 'Alta (1280×720, 30fps)']] as const).map(([value, label]) => (
                        <button key={value} onClick={() => updateSetting('videoQuality', value)}
                          className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                          style={{
                            background: settings.videoQuality === value ? 'linear-gradient(to bottom, #6dd5fa, #2980b9)' : 'rgba(0,0,0,.2)',
                            color: settings.videoQuality === value ? '#fff' : 'rgba(255,255,255,.7)',
                            border: settings.videoQuality === value ? '2px solid rgba(255,255,255,.3)' : '2px solid rgba(255,255,255,.1)',
                            boxShadow: settings.videoQuality === value ? '0 0 12px rgba(100,180,255,.3)' : 'none',
                          }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,.7)' }}>Probar micrófono</label>
                    <div className="flex items-center gap-4">
                      <button onClick={startMicTest}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        style={{
                          background: testingMic ? 'rgba(255,100,80,.2)' : 'linear-gradient(to bottom, #6dd5fa, #2980b9)',
                          color: testingMic ? '#ffa694' : '#fff',
                          border: testingMic ? '1px solid rgba(255,100,80,.3)' : '2px solid rgba(255,255,255,.3)',
                        }}>
                        {testingMic ? '[x] Detener prueba' : '[m] Iniciar prueba'}
                      </button>
                      <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.1)' }}>
                        <div className="h-full transition-all duration-75" style={{ width: `${micLevel}%`, background: 'linear-gradient(to right, #8fd95f, #ffd97a, #ffa694)' }} />
                      </div>
                    </div>
                    <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,.4)' }}>Habla para ver el nivel de entrada. Ajusta el volumen si la barra no se mueve o llega al rojo constantemente.</p>
                  </div>
                </div>
              )}

              {section === 'appearance' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-white">Apariencia</h3>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,.7)' }}>Personaliza cómo se ve iluminode.</p>
                  <div className="p-4 rounded-xl" style={{ background: 'rgba(0,0,0,.2)', border: '1px solid rgba(255,255,255,.1)' }}>
                    <p style={{ color: 'rgba(255,255,255,.8)' }} className="text-sm">Tema: <span className="font-medium" style={{ color: '#6dd5fa' }}>AeroNight (Oscuro)</span></p>
                    <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,.4)' }}>Inspirado en el menú de la Wii. Más temas disponibles próximamente.</p>
                  </div>
                </div>
              )}

              {section === 'about' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-white">Acerca de</h3>
                  <div className="p-4 rounded-xl space-y-2" style={{ background: 'rgba(0,0,0,.2)', border: '1px solid rgba(255,255,255,.1)' }}>
                    <p className="font-medium text-white">A.N.O.T.H.E.R. Private</p>
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,.7)' }}>iluminode v0.3.0 — Fase 3</p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,.4)' }}>Plataforma privada de comunicación en tiempo real.</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function getAudioSettings(): AudioSettings {
  return loadSettings();
}