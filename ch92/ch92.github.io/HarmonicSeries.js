// HarmonicSeries.js

// Expanded CONFIG object with new settings
const CONFIG = {
    noteLength: 400, // length of each note in milliseconds
    density: 3, // number of concurrent notes
    tempo: 120, // beats per minute
    // ... other existing settings
};

// Function to set note length
function setNoteLength(length) {
    CONFIG.noteLength = length;
}

// Function to set density
function setDensity(concurrentNotes) {
    CONFIG.density = concurrentNotes;
}

// Function to set tempo
function setTempo(bpm) {
    CONFIG.tempo = bpm;
}

// Modified harmonic loop to use new parameters
function startHarmonicLoop() {
    const interval = 60000 / CONFIG.tempo; // calculate interval from tempo
    // Logic for starting harmonic notes using CONFIG.noteLength, CONFIG.density, and interval for frequency
    //... implement the looping and playing logic based on the new CONFIG values
}

// ... rest of the harmonic system logic