let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let audioLoopSeconds = 4;
let audioFrames = 1 * audioCtx.sampleRate / 2;
let audioChannels = 2;
let audioBuffer = audioCtx.createBuffer(audioChannels, audioFrames, audioCtx.sampleRate);

function startAudio() {
    
    // Get an AudioBufferSourceNode.
    // This is the AudioNode to use when we want to play an AudioBuffer
    let source = audioCtx.createBufferSource();
    // set the buffer in the AudioBufferSourceNode
    source.buffer = audioBuffer;
    // connect the AudioBufferSourceNode to the
    // destination so we can hear the sound
    source.connect(audioCtx.destination);
    source.loop = true;
    source.playbackRate.value = 1/audioLoopSeconds / 2;
    // start the source playing
    //source.start();
}
  