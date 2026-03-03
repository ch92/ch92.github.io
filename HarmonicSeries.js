// Configuration
const CONFIG = {
  fundamentalFrequency: 130.81, // C3
  fundamentalNote: 'C3',
  numPartials: 12, // Number of harmonics to use (can be changed via UI)
  maxPartials: 100, // Maximum available partials
  attackTime: 3, // Fade in time for fundamental
  releaseTime: 2, // Fade out time for harmonics
  sustainVolume: -22, // dB for fundamental
  harmonicMinVolume: -50, // dB for quietest harmonics
  harmonicMaxVolume: -16, // dB for loudest harmonics
  noteLengthMin: 4, // Minimum note duration in seconds
  noteLengthMax: 20, // Maximum note duration in seconds
  density: 3, // Target number of concurrent notes (1-12)
  tempo: 120, // Beats per minute (controls note trigger frequency)
};

// State
let state = {
  isPlaying: false,
  activeNotes: new Map(), // Map of partial index -> {synth, gain, fadeOutTime}
};

/**
 * Calculate frequency from harmonic series
 * @param {number} fundamentalHz - Base frequency in Hz
 * @param {number} partial - Which harmonic (1 = fundamental, 2 = octave, 3 = 5th + octave, etc)
 * @returns {number} Frequency in Hz
 */
function getHarmonicFrequency(fundamentalHz, partial) {
  return fundamentalHz * partial;
}

/**
 * Convert frequency to nearest MIDI note name
 * @param {number} frequency - Frequency in Hz
 * @returns {string} Note name (e.g., "C4")
 */
function frequencyToNote(frequency) {
  const A4 = 440;
  const C0 = A4 * Math.pow(2, -4.75);
  const semitones = 12 * Math.log2(frequency / C0);
  const noteIndex = Math.round(semitones);
  
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(noteIndex / 12);
  const note = notes[noteIndex % 12];
  
  return `${note}${octave}`;
}

/**
 * Get volume decay based on harmonic number
 * Higher partials are quieter to simulate natural harmonic decay
 * @param {number} partial - Which harmonic
 * @returns {number} Volume in dB
 */
function getHarmonicVolume(partial) {
  // Linear decay: fundamental is loudest, higher partials are quieter
  const normalized = (partial - 1) / (CONFIG.numPartials - 1);
  const volumeRange = CONFIG.harmonicMaxVolume - CONFIG.harmonicMinVolume;
  return CONFIG.harmonicMaxVolume - (normalized * volumeRange);
}

/**
 * Create a synth voice for a single note
 * @returns {Tone.PolySynth}
 */
function createVoice() {
  return new Tone.PolySynth(Tone.Synth, {
    oscillator: {
      type: 'sine'
    },
    envelope: {
      attack: 0.1,
      decay: 0.2,
      sustain: 0.8,
      release: 0.5
    }
  }).toDestination();
}

/**
 * Create the fundamental bass note with custom envelope
 * @returns {Object} {synth, gainNode}
 */
function createFundamental() {
  const synth = new Tone.Synth({
    oscillator: {
      type: 'sine'
    },
    envelope: {
      attack: CONFIG.attackTime,
      decay: 0.5,
      sustain: 0.9,
      release: 1
    }
  }).toDestination();

  return { synth };
}

/**
 * Start the continuous fundamental note
 */
function startFundamental() {
  const { synth } = createFundamental();
  synth.triggerAttack(CONFIG.fundamentalNote);
  
  // Store for later reference
  state.fundamentalSynth = synth;
  
  console.log(`🔊 Fundamental started: ${CONFIG.fundamentalNote} (${CONFIG.fundamentalFrequency}Hz)`);
}

/**
 * Randomly select a harmonic to fade in
 * Uses the current CONFIG.numPartials value
 */
function selectRandomHarmonic() {
  // Get available partials (skip the fundamental itself - start from 2)
  const availablePartials = [];
  for (let i = 2; i <= CONFIG.numPartials; i++) {
    if (!state.activeNotes.has(i)) {
      availablePartials.push(i);
    }
  }
  
  // If no partials available, try again later
  if (availablePartials.length === 0) {
    return null;
  }
  
  // Pick a random one from available
  const randomIndex = Math.floor(Math.random() * availablePartials.length);
  return availablePartials[randomIndex];
}

/**
 * Fade in a harmonic note
 * @param {number} partial - Which harmonic to play
 */
function fadeInHarmonic(partial) {
  if (!state.isPlaying) return;
  
  const frequency = getHarmonicFrequency(CONFIG.fundamentalFrequency, partial);
  const noteName = frequencyToNote(frequency);
  const targetVolume = getHarmonicVolume(partial);
  
  // Create synth with fade-in
  const synth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: {
      attack: 2, // Slow fade in
      decay: 0.5,
      sustain: 0.85,
      release: CONFIG.releaseTime
    }
  }).toDestination();

  synth.volume.value = -80; // Start silent
  synth.triggerAttack(noteName);
  
  // Fade in to target volume
  synth.volume.linearRampTo(targetVolume, 2);
  
  // Store in active notes
  state.activeNotes.set(partial, {
    synth,
    noteName,
    frequency,
    targetVolume,
    partial,
    startTime: Tone.now()
  });
  
  console.log(`✨ Harmonic ${partial}: ${noteName} (${frequency.toFixed(2)}Hz) fading in to ${targetVolume.toFixed(1)}dB`);
}

/**
 * Fade out a harmonic note
 * @param {number} partial - Which harmonic to fade out
 */
function fadeOutHarmonic(partial) {
  const noteData = state.activeNotes.get(partial);
  if (!noteData) return;
  
  const { synth, noteName } = noteData;
  
  // Fade out
  synth.volume.linearRampTo(-80, CONFIG.releaseTime);
  
  // Release after fade
  setTimeout(() => {
    synth.triggerRelease();
    state.activeNotes.delete(partial);
    console.log(`🔕 Harmonic ${partial}: ${noteName} faded out`);
  }, CONFIG.releaseTime * 1000);
}

/**
 * Main loop: randomly select harmonics to fade in/out based on density and tempo
 */
function startHarmonicLoop() {
  // Calculate interval between note triggers based on tempo
  const intervalBetweenNotes = (60 / CONFIG.tempo) * 1000; // Convert BPM to milliseconds
  
  const loop = () => {
    if (!state.isPlaying) return;
    
    // Check density: only trigger new notes if below target density
    if (state.activeNotes.size < CONFIG.density) {
      const partial = selectRandomHarmonic();
      if (partial !== null) {
        fadeInHarmonic(partial);
        
        // Schedule fade out based on note length configuration
        const duration = CONFIG.noteLengthMin + Math.random() * (CONFIG.noteLengthMax - CONFIG.noteLengthMin);
        setTimeout(() => {
          if (state.activeNotes.has(partial)) {
            fadeOutHarmonic(partial);
          }
        }, duration * 1000);
      }
    }
    
    // Schedule next check
    setTimeout(loop, intervalBetweenNotes);
  };
  
  loop();
}

/**
 * Start the music piece
 */
function play() {
  if (state.isPlaying) return;
  
  state.isPlaying = true;
  Tone.start();
  
  startFundamental();
  startHarmonicLoop();
  
  console.log('🎵 Music started');
}

/**
 * Stop the music piece
 */
function stop() {
  state.isPlaying = false;
  
  if (state.fundamentalSynth) {
    state.fundamentalSynth.triggerRelease();
  }
  
  state.activeNotes.forEach((noteData, partial) => {
    fadeOutHarmonic(partial);
  });
  
  console.log('⏹️ Music stopped');
}

/**
 * Update the number of partials to draw from
 * @param {number} numPartials - New number of partials (2-100)
 */
function setNumPartials(numPartials) {
  const newValue = Math.max(2, Math.min(numPartials, CONFIG.maxPartials));
  CONFIG.numPartials = newValue;
  console.log(`📊 Partials updated to: ${CONFIG.numPartials}`);
}

/**
 * Update the fundamental frequency
 * @param {number} frequency - Frequency in Hz
 * @param {string} noteName - Optional note name for display
 */
function setFundamental(frequency, noteName) {
  CONFIG.fundamentalFrequency = frequency;
  CONFIG.fundamentalNote = noteName || frequencyToNote(frequency);
  
  // Restart if already playing
  if (state.isPlaying) {
    stop();
    setTimeout(play, 500);
  }
  
  console.log(`🎵 Fundamental updated to: ${CONFIG.fundamentalNote} (${frequency}Hz)`);
}

/**
 * Update volume settings for harmonics
 * @param {number} minVolume - Minimum volume in dB (for highest partials)
 * @param {number} maxVolume - Maximum volume in dB (for lowest partials)
 */
function setHarmonicVolumeRange(minVolume, maxVolume) {
  CONFIG.harmonicMinVolume = minVolume;
  CONFIG.harmonicMaxVolume = maxVolume;
  console.log(`🔊 Volume range updated: ${minVolume}dB to ${maxVolume}dB`);
}

/**
 * Update note length range
 * @param {number} minLength - Minimum note length in seconds
 * @param {number} maxLength - Maximum note length in seconds
 */
function setNoteLength(minLength, maxLength) {
  CONFIG.noteLengthMin = minLength;
  CONFIG.noteLengthMax = maxLength;
  console.log(`⏱️ Note length range updated to: ${minLength}s - ${maxLength}s`);
}

/**
 * Update density (target number of concurrent notes)
 * @param {number} newDensity - Target number of notes (1-12)
 */
function setDensity(newDensity) {
  CONFIG.density = Math.max(1, Math.min(newDensity, 12));
  console.log(`📈 Density updated to: ${CONFIG.density} concurrent notes`);
}

/**
 * Update tempo
 * @param {number} bpm - Beats per minute (40-200)
 */
function setTempo(bpm) {
  CONFIG.tempo = Math.max(40, Math.min(bpm, 200));
  console.log(`🎼 Tempo updated to: ${CONFIG.tempo} BPM`);
}

// Export functions for use in HTML
window.harmonicMusic = {
  play,
  stop,
  setNumPartials,
  setFundamental,
  setHarmonicVolumeRange,
  setNoteLength,
  setDensity,
  setTempo,
  CONFIG
};
