// HarmonicSeries.js

let noteLength = 1; // Duration of each note in seconds
let density = 1; // Number of concurrent notes
let tempo = 120; // Beats per minute

function updateNoteLength(newLength) {
    noteLength = newLength;
}

function updateDensity(newDensity) {
    density = newDensity;
}

function updateTempo(newTempo) {
    tempo = newTempo;
}

function getConfigurations() {
    return {
        noteLength,
        density,
        tempo
    };
}

// Initial configuration
console.log(getConfigurations());
