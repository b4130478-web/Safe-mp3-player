import React, { useState, useRef, useEffect } from 'react';

export default function App() {
  const [tracks, setTracks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  
  // New state for Bass Booster
  const [isBassBoost, setIsBassBoost] = useState(false);

  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  // Persistent ref for the Bass Equalizer Node
  const bassFilterRef = useRef(null);

  const handleFolderUpload = (e) => {
    const files = Array.from(e.target.files);
    const audioFiles = files.filter(file => file.type.startsWith('audio/'));
    
    const formattedTracks = audioFiles.map(file => ({
      name: file.name.replace(/\.[^/.]+$/, ""),
      url: URL.createObjectURL(file)
    }));

    if (formattedTracks.length > 0) {
      setTracks(formattedTracks);
      setCurrentIndex(0);
      setIsPlaying(false);
    }
  };

  // Setup Web Audio API with a Low-Shelf Bass Filter
  useEffect(() => {
    if (!audioRef.current) return;

    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      
      // 1. Create the Audio Nodes
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64; 

      const bassFilter = ctx.createBiquadFilter();
      bassFilter.type = 'lowshelf';
      bassFilter.frequency.setValueAtTime(80, ctx.currentTime); // target sub-bass frequencies
      bassFilter.gain.setValueAtTime(isBassBoost ? 12 : 0, ctx.currentTime); // initial state

      // 2. Wire the Pipeline: Source -> Bass Filter -> Analyser -> Speakers
      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(bassFilter);
      bassFilter.connect(analyser);
      analyser.connect(ctx.destination);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      bassFilterRef.current = bassFilter;
    }
  }, [tracks]);

  // Handle Dynamic Toggling of Bass Boost values on the fly
  useEffect(() => {
    if (bassFilterRef.current && audioContextRef.current) {
      // 12dB boost if active, 0dB (flat standard sound) if inactive
      const targetGain = isBassBoost ? 12 : 0;
      bassFilterRef.current.gain.setValueAtTime(targetGain, audioContextRef.current.currentTime);
    }
  }, [isBassBoost]);

  useEffect(() => {
    if (!audioRef.current || tracks.length === 0) return;
    
    if (isPlaying) {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      audioRef.current.play().catch(() => setIsPlaying(false));
      startVisualizerLoop();
    } else {
      audioRef.current.pause();
      cancelAnimationFrame(animationFrameRef.current);
    }

    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isPlaying, currentIndex, tracks]);

  const startVisualizerLoop = () => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = '#1a1a1e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 1.4;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2.2;

        const red = Math.floor((i / bufferLength) * 255);
        const green = Math.floor(255 - (i / bufferLength) * 255);
        const blue = Math.floor(Math.sin((i / bufferLength) * Math.PI) * 255);

        ctx.fillStyle = `rgb(${red}, ${Math.max(green, 100)}, ${Math.max(blue, 150)})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 4, barHeight);

        x += barWidth;
      }
    };
    draw();
  };

  const handleTimeUpdate = () => {
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    setDuration(audioRef.current.duration);
  };

  const handleSliderChange = (e) => {
    const newTime = parseFloat(e.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const togglePlay = () => tracks.length && setIsPlaying(!isPlaying);
  
  const nextTrack = () => {
    if (tracks.length === 0) return;
    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * tracks.length);
      setCurrentIndex(randomIndex);
    } else {
      setCurrentIndex((prev) => (prev + 1) % tracks.length);
    }
    setCurrentTime(0);
  };

  const prevTrack = () => {
    if (tracks.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
    setCurrentTime(0);
  };

  const handleTrackEnd = () => {
    if (isRepeat) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    } else {
      nextTrack();
    }
  };

  const formatTime = (time) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🎧 Termux MP3 Player</h2>
      
      <div style={styles.uploadBox}>
        <label style={styles.uploadLabel}>
          📂 Select Music Files
          <input type="file" accept="audio/*" multiple onChange={handleFolderUpload} style={{ display: 'none' }} />
        </label>
        <p style={styles.subtext}>{tracks.length} tracks loaded</p>
      </div>

      <div style={styles.playerCard}>
        <canvas ref={canvasRef} width="340" height="80" style={styles.canvas} />

        <h3 style={styles.trackName}>
          {tracks.length > 0 ? tracks[currentIndex].name : "No Track Loaded"}
        </h3>

        {tracks.length > 0 && (
          <audio
            ref={audioRef}
            src={tracks[currentIndex].url}
            crossOrigin="anonymous"
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleTrackEnd}
          />
        )}

        <div style={styles.sliderContainer}>
          <span>{formatTime(currentTime)}</span>
          <input type="range" min="0" max={duration || 100} value={currentTime} onChange={handleSliderChange} disabled={tracks.length === 0} style={styles.slider} />
          <span>{formatTime(duration)}</span>
        </div>

        <div style={styles.controls}>
          <button onClick={() => setIsShuffle(!isShuffle)} style={{...styles.modeBtn, color: isShuffle ? '#00ff66' : '#888'}}>🔀</button>
          <button onClick={prevTrack} style={styles.btn}>⏮️</button>
          <button onClick={togglePlay} style={styles.playBtn}>{isPlaying ? '⏸️' : '▶️'}</button>
          <button onClick={nextTrack} style={styles.btn}>⏭️</button>
          <button onClick={() => setIsRepeat(!isRepeat)} style={{...styles.modeBtn, color: isRepeat ? '#00ff66' : '#888'}}>🔁</button>
        </div>

        {/* 🚀 New Bass Boost Controls Container */}
        <div style={styles.boostContainer}>
          <button 
            onClick={() => setIsBassBoost(!isBassBoost)}
            style={{
              ...styles.boostBtn,
              backgroundColor: isBassBoost ? '#00ff66' : '#222',
              color: isBassBoost ? '#000' : '#888',
              border: isBassBoost ? '1px solid #00ff66' : '1px solid #444'
            }}
          >
            🔥 BASS BOOST {isBassBoost ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {tracks.length > 0 && (
        <div style={styles.playlistContainer}>
          <h4 style={styles.playlistTitle}>📋 Track Queue</h4>
          <div style={styles.playlistScroll}>
            {tracks.map((track, index) => (
              <div 
                key={index} 
                onClick={() => { setCurrentIndex(index); setIsPlaying(true); }}
                style={{
                  ...styles.playlistItem,
                  backgroundColor: index === currentIndex ? '#1a3a22' : 'transparent',
                  color: index === currentIndex ? '#00ff66' : '#e1e1e6'
                }}
              >
                <span style={styles.trackIndex}>{index + 1}.</span>
                <span style={styles.playlistName}>{track.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { backgroundColor: '#121214', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', padding: '20px' },
  title: { color: '#00ff66', marginBottom: '20px' },
  uploadBox: { marginBottom: '30px', textAlign: 'center' },
  uploadLabel: { backgroundColor: '#00ff66', color: '#000', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  subtext: { color: '#888', marginTop: '10px', fontSize: '12px' },
  playerCard: { backgroundColor: '#1a1a1e', border: '1px solid #333', padding: '20px', borderRadius: '8px', width: '90%', maxWidth: '400px', textAlign: 'center' },
  canvas: { width: '100%', height: '80px', backgroundColor: '#16161a', borderRadius: '6px', marginBottom: '15px' },

};
