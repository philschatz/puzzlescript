const {RNG} = require('./rng')
const {MakeRiff, FastBase64_Encode} = require('./riffwave')
const {StreamAudioContext: AudioContext} = require('@descript/web-audio-js')

let Speaker = null
if (!process.env.CONTINUOUS_INTEGRATION && !process.env.CI) {
    try {
        Speaker = require('speaker')
    } catch (err) {
        // it's ok, we just won't use the speaker
    }
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

var SOUND_VOL = 0.25;
var SAMPLE_RATE = 5512;
var BIT_DEPTH = 8;

var SQUARE = 0;
var SAWTOOTH = 1;
var SINE = 2;
var NOISE = 3;
var TRIANGLE = 4;
var BREAKER = 5;

var SHAPES = [
  'square', 'sawtooth', 'sine', 'noise', 'triangle', 'breaker'
];

let AUDIO_CONTEXT = new AudioContext()

// see https://github.com/audiojs/web-audio-api/issues/59
// The samplerate is hardcoded to be 44100 for some reason
// and an exception is thrown if this does not match the buffer that is being played
AUDIO_CONTEXT.sampleRate = SAMPLE_RATE //5512

function checkAudioContextExists(){
    if (AUDIO_CONTEXT==null){
      if (typeof AudioContext != 'undefined') {
        const context = new AudioContext()
        AUDIO_CONTEXT = context
      } else {
        throw new Error('Audio not supported!')
      }
    }
}

checkAudioContextExists();

// Playback volume
var masterVolume = 1.0;

// Sound generation parameters are on [0,1] unless noted SIGNED, & thus [-1,1]
function Params() {
  var result={};
  // Wave shape
  result.wave_type = SQUARE;

  // Envelope
  result.p_env_attack = 0.0;   // Attack time
  result.p_env_sustain = 0.3;  // Sustain time
  result.p_env_punch = 0.0;    // Sustain punch
  result.p_env_decay = 0.4;    // Decay time

  // Tone
  result.p_base_freq = 0.3;    // Start frequency
  result.p_freq_limit = 0.0;   // Min frequency cutoff
  result.p_freq_ramp = 0.0;    // Slide (SIGNED)
  result.p_freq_dramp = 0.0;   // Delta slide (SIGNED)
  // Vibrato
  result.p_vib_strength = 0.0; // Vibrato depth
  result.p_vib_speed = 0.0;    // Vibrato speed

  // Tonal change
  result.p_arp_mod = 0.0;      // Change amount (SIGNED)
  result.p_arp_speed = 0.0;    // Change speed

  // Duty (wat's that?)
  result.p_duty = 0.0;         // Square duty
  result.p_duty_ramp = 0.0;    // Duty sweep (SIGNED)

  // Repeat
  result.p_repeat_speed = 0.0; // Repeat speed

  // Phaser
  result.p_pha_offset = 0.0;   // Phaser offset (SIGNED)
  result.p_pha_ramp = 0.0;     // Phaser sweep (SIGNED)

  // Low-pass filter
  result.p_lpf_freq = 1.0;     // Low-pass filter cutoff
  result.p_lpf_ramp = 0.0;     // Low-pass filter cutoff sweep (SIGNED)
  result.p_lpf_resonance = 0.0;// Low-pass filter resonance
  // High-pass filter
  result.p_hpf_freq = 0.0;     // High-pass filter cutoff
  result.p_hpf_ramp = 0.0;     // High-pass filter cutoff sweep (SIGNED)

  // Sample parameters
  result.sound_vol = 0.5;
  result.sample_rate = 44100;
  result.bit_depth = 8;
  return result;
}

var rng;
var seeded = false;
function frnd(range) {
  if (seeded) {
    return rng.uniform() * range;
  } else {
    return Math.random() * range;
  }
}


function rnd(max) {
  if (seeded) {
  return Math.floor(rng.uniform() * (max + 1));
  } else {
    return Math.floor(Math.random() * (max + 1));
  }
}


function pickupCoin() {
  var result=Params();
  result.wave_type = Math.floor(frnd(SHAPES.length));
  if (result.wave_type === 3) {
    result.wave_type = 0;
  }
  result.p_base_freq = 0.4 + frnd(0.5);
  result.p_env_attack = 0.0;
  result.p_env_sustain = frnd(0.1);
  result.p_env_decay = 0.1 + frnd(0.4);
  result.p_env_punch = 0.3 + frnd(0.3);
  if (rnd(1)) {
    result.p_arp_speed = 0.5 + frnd(0.2);
    var num = (frnd(7) | 1) + 1;
    var den = num + (frnd(7) | 1) + 2;
    result.p_arp_mod = (+num) / (+den); //0.2 + frnd(0.4);
  }
  return result;
}


function laserShoot() {
  var result=Params();
  result.wave_type = rnd(2);
  if (result.wave_type === SINE && rnd(1))
    result.wave_type = rnd(1);
  result.wave_type = Math.floor(frnd(SHAPES.length));

  if (result.wave_type === 3) {
    result.wave_type = SQUARE;
  }

  result.p_base_freq = 0.5 + frnd(0.5);
  result.p_freq_limit = result.p_base_freq - 0.2 - frnd(0.6);
  if (result.p_freq_limit < 0.2) result.p_freq_limit = 0.2;
  result.p_freq_ramp = -0.15 - frnd(0.2);
  if (rnd(2) === 0)
  {
    result.p_base_freq = 0.3 + frnd(0.6);
    result.p_freq_limit = frnd(0.1);
    result.p_freq_ramp = -0.35 - frnd(0.3);
  }
  if (rnd(1))
  {
    result.p_duty = frnd(0.5);
    result.p_duty_ramp = frnd(0.2);
  }
  else
  {
    result.p_duty = 0.4 + frnd(0.5);
    result.p_duty_ramp = -frnd(0.7);
  }
  result.p_env_attack = 0.0;
  result.p_env_sustain = 0.1 + frnd(0.2);
  result.p_env_decay = frnd(0.4);
  if (rnd(1))
    result.p_env_punch = frnd(0.3);
  if (rnd(2) === 0)
  {
    result.p_pha_offset = frnd(0.2);
    result.p_pha_ramp = -frnd(0.2);
  }
  if (rnd(1))
    result.p_hpf_freq = frnd(0.3);

  return result;
}

function explosion() {
  var result=Params();

  if (rnd(1)) {
    result.p_base_freq = 0.1 + frnd(0.4);
    result.p_freq_ramp = -0.1 + frnd(0.4);
  } else {
    result.p_base_freq = 0.2 + frnd(0.7);
    result.p_freq_ramp = -0.2 - frnd(0.2);
  }
  result.p_base_freq *= result.p_base_freq;
  if (rnd(4) === 0)
    result.p_freq_ramp = 0.0;
  if (rnd(2) === 0)
    result.p_repeat_speed = 0.3 + frnd(0.5);
  result.p_env_attack = 0.0;
  result.p_env_sustain = 0.1 + frnd(0.3);
  result.p_env_decay = frnd(0.5);
  if (rnd(1) === 0) {
    result.p_pha_offset = -0.3 + frnd(0.9);
    result.p_pha_ramp = -frnd(0.3);
  }
  result.p_env_punch = 0.2 + frnd(0.6);
  if (rnd(1)) {
    result.p_vib_strength = frnd(0.7);
    result.p_vib_speed = frnd(0.6);
  }
  if (rnd(2) === 0) {
    result.p_arp_speed = 0.6 + frnd(0.3);
    result.p_arp_mod = 0.8 - frnd(1.6);
  }

  return result;
}
//9675111
function birdSound() {
  var result=Params();

if (frnd(10) < 1) {
    result.wave_type = Math.floor(frnd(SHAPES.length));
    if (result.wave_type === 3) {
      result.wave_type = SQUARE;
    }
result.p_env_attack = 0.4304400932967592 + frnd(0.2) - 0.1;
result.p_env_sustain = 0.15739346034252394 + frnd(0.2) - 0.1;
result.p_env_punch = 0.004488201744871758 + frnd(0.2) - 0.1;
result.p_env_decay = 0.07478075528212291 + frnd(0.2) - 0.1;
result.p_base_freq = 0.9865265720147687 + frnd(0.2) - 0.1;
result.p_freq_limit = 0 + frnd(0.2) - 0.1;
result.p_freq_ramp = -0.2995018224359539 + frnd(0.2) - 0.1;
if (frnd(1.0) < 0.5) {
  result.p_freq_ramp = 0.1 + frnd(0.15);
}
result.p_freq_dramp = 0.004598608156964473 + frnd(0.1) - 0.05;
result.p_vib_strength = -0.2202799497929496 + frnd(0.2) - 0.1;
result.p_vib_speed = 0.8084998703158364 + frnd(0.2) - 0.1;
result.p_arp_mod = 0;//-0.46410459213693644+frnd(0.2)-0.1;
result.p_arp_speed = 0;//-0.10955361249587248+frnd(0.2)-0.1;
result.p_duty = -0.9031808754347107 + frnd(0.2) - 0.1;
result.p_duty_ramp = -0.8128699999808343 + frnd(0.2) - 0.1;
result.p_repeat_speed = 0.6014860189319991 + frnd(0.2) - 0.1;
result.p_pha_offset = -0.9424902314367765 + frnd(0.2) - 0.1;
result.p_pha_ramp = -0.1055482222272056 + frnd(0.2) - 0.1;
result.p_lpf_freq = 0.9989765717851521 + frnd(0.2) - 0.1;
result.p_lpf_ramp = -0.25051720626043017 + frnd(0.2) - 0.1;
result.p_lpf_resonance = 0.32777871505494693 + frnd(0.2) - 0.1;
result.p_hpf_freq = 0.0023548750981756753 + frnd(0.2) - 0.1;
result.p_hpf_ramp = -0.002375673204842568 + frnd(0.2) - 0.1;
return result;
}

if (frnd(10) < 1) {
    result.wave_type = Math.floor(frnd(SHAPES.length));
    if (result.wave_type === 3) {
      result.wave_type = SQUARE;
    }
result.p_env_attack = 0.5277795946672003 + frnd(0.2) - 0.1;
result.p_env_sustain = 0.18243733568468432 + frnd(0.2) - 0.1;
result.p_env_punch = -0.020159754546840117 + frnd(0.2) - 0.1;
result.p_env_decay = 0.1561353422051903 + frnd(0.2) - 0.1;
result.p_base_freq = 0.9028855606533718 + frnd(0.2) - 0.1;
result.p_freq_limit = -0.008842787837148716;
result.p_freq_ramp = -0.1;
result.p_freq_dramp = -0.012891241489551925;
result.p_vib_strength = -0.17923136138403065 + frnd(0.2) - 0.1;
result.p_vib_speed = 0.908263385610142 + frnd(0.2) - 0.1;
result.p_arp_mod = 0.41690153355414894 + frnd(0.2) - 0.1;
result.p_arp_speed = 0.0010766233195860703 + frnd(0.2) - 0.1;
result.p_duty = -0.8735363011184684 + frnd(0.2) - 0.1;
result.p_duty_ramp = -0.7397985366747507 + frnd(0.2) - 0.1;
result.p_repeat_speed = 0.0591789344172107 + frnd(0.2) - 0.1;
result.p_pha_offset = -0.9961184222777699 + frnd(0.2) - 0.1;
result.p_pha_ramp = -0.08234769395850523 + frnd(0.2) - 0.1;
result.p_lpf_freq = 0.9412475115697335 + frnd(0.2) - 0.1;
result.p_lpf_ramp = -0.18261358925834958 + frnd(0.2) - 0.1;
result.p_lpf_resonance = 0.24541438107389477 + frnd(0.2) - 0.1;
result.p_hpf_freq = -0.01831940280978611 + frnd(0.2) - 0.1;
result.p_hpf_ramp = -0.03857383633171346 + frnd(0.2) - 0.1;
return result;

}
  if (frnd(10) < 1) {
//result.wave_type = 4;
    result.wave_type = Math.floor(frnd(SHAPES.length));

    if (result.wave_type === 3) {
      result.wave_type = SQUARE;
    }
result.p_env_attack = 0.4304400932967592 + frnd(0.2) - 0.1;
result.p_env_sustain = 0.15739346034252394 + frnd(0.2) - 0.1;
result.p_env_punch = 0.004488201744871758 + frnd(0.2) - 0.1;
result.p_env_decay = 0.07478075528212291 + frnd(0.2) - 0.1;
result.p_base_freq = 0.9865265720147687 + frnd(0.2) - 0.1;
result.p_freq_limit = 0 + frnd(0.2) - 0.1;
result.p_freq_ramp = -0.2995018224359539 + frnd(0.2) - 0.1;
result.p_freq_dramp = 0.004598608156964473 + frnd(0.2) - 0.1;
result.p_vib_strength = -0.2202799497929496 + frnd(0.2) - 0.1;
result.p_vib_speed = 0.8084998703158364 + frnd(0.2) - 0.1;
result.p_arp_mod = -0.46410459213693644 + frnd(0.2) - 0.1;
result.p_arp_speed = -0.10955361249587248 + frnd(0.2) - 0.1;
result.p_duty = -0.9031808754347107 + frnd(0.2) - 0.1;
result.p_duty_ramp = -0.8128699999808343 + frnd(0.2) - 0.1;
result.p_repeat_speed = 0.7014860189319991 + frnd(0.2) - 0.1;
result.p_pha_offset = -0.9424902314367765 + frnd(0.2) - 0.1;
result.p_pha_ramp = -0.1055482222272056 + frnd(0.2) - 0.1;
result.p_lpf_freq = 0.9989765717851521 + frnd(0.2) - 0.1;
result.p_lpf_ramp = -0.25051720626043017 + frnd(0.2) - 0.1;
result.p_lpf_resonance = 0.32777871505494693 + frnd(0.2) - 0.1;
result.p_hpf_freq = 0.0023548750981756753 + frnd(0.2) - 0.1;
result.p_hpf_ramp = -0.002375673204842568 + frnd(0.2) - 0.1;
return result;
}
  if (frnd(5) > 1) {
    result.wave_type = Math.floor(frnd(SHAPES.length));

    if (result.wave_type === 3) {
      result.wave_type = SQUARE;
    }
    if (rnd(1)) {
      result.p_arp_mod = 0.2697849293151393 + frnd(0.2) - 0.1;
      result.p_arp_speed = -0.3131172257760948 + frnd(0.2) - 0.1;
      result.p_base_freq = 0.8090588299313949 + frnd(0.2) - 0.1;
      result.p_duty = -0.6210022920964955 + frnd(0.2) - 0.1;
      result.p_duty_ramp = -0.00043441813553182567 + frnd(0.2) - 0.1;
      result.p_env_attack = 0.004321877246874195 + frnd(0.2) - 0.1;
      result.p_env_decay = 0.1 + frnd(0.2) - 0.1;
      result.p_env_punch = 0.061737781504416146 + frnd(0.2) - 0.1;
      result.p_env_sustain = 0.4987252564798832 + frnd(0.2) - 0.1;
      result.p_freq_dramp = 0.31700340314222614 + frnd(0.2) - 0.1;
      result.p_freq_limit = 0 + frnd(0.2) - 0.1;
      result.p_freq_ramp = -0.163380391341416 + frnd(0.2) - 0.1;
      result.p_hpf_freq = 0.4709005021145149 + frnd(0.2) - 0.1;
      result.p_hpf_ramp = 0.6924667290539194 + frnd(0.2) - 0.1;
      result.p_lpf_freq = 0.8351398631384511 + frnd(0.2) - 0.1;
      result.p_lpf_ramp = 0.36616557192873134 + frnd(0.2) - 0.1;
      result.p_lpf_resonance = -0.08685777111664439 + frnd(0.2) - 0.1;
      result.p_pha_offset = -0.036084571580025544 + frnd(0.2) - 0.1;
      result.p_pha_ramp = -0.014806445085568108 + frnd(0.2) - 0.1;
      result.p_repeat_speed = -0.8094368475518489 + frnd(0.2) - 0.1;
      result.p_vib_speed = 0.4496665457171294 + frnd(0.2) - 0.1;
      result.p_vib_strength = 0.23413762515532424 + frnd(0.2) - 0.1;
    } else {
      result.p_arp_mod = -0.35697118026766184 + frnd(0.2) - 0.1;
      result.p_arp_speed = 0.3581140690559588 + frnd(0.2) - 0.1;
      result.p_base_freq = 1.3260897696157528 + frnd(0.2) - 0.1;
      result.p_duty = -0.30984900436710694 + frnd(0.2) - 0.1;
      result.p_duty_ramp = -0.0014374759133411626 + frnd(0.2) - 0.1;
      result.p_env_attack = 0.3160357835682254 + frnd(0.2) - 0.1;
      result.p_env_decay = 0.1 + frnd(0.2) - 0.1;
      result.p_env_punch = 0.24323114016870148 + frnd(0.2) - 0.1;
      result.p_env_sustain = 0.4 + frnd(0.2) - 0.1;
      result.p_freq_dramp = 0.2866475886237244 + frnd(0.2) - 0.1;
      result.p_freq_limit = 0 + frnd(0.2) - 0.1;
      result.p_freq_ramp = -0.10956352368742976 + frnd(0.2) - 0.1;
      result.p_hpf_freq = 0.20772718017889846 + frnd(0.2) - 0.1;
      result.p_hpf_ramp = 0.1564090637378835 + frnd(0.2) - 0.1;
      result.p_lpf_freq = 0.6021372770637031 + frnd(0.2) - 0.1;
      result.p_lpf_ramp = 0.24016227139979027 + frnd(0.2) - 0.1;
      result.p_lpf_resonance = -0.08787383821160144 + frnd(0.2) - 0.1;
      result.p_pha_offset = -0.381597686151701 + frnd(0.2) - 0.1;
      result.p_pha_ramp = -0.0002481687661373495 + frnd(0.2) - 0.1;
      result.p_repeat_speed = 0.07812112809425686 + frnd(0.2) - 0.1;
      result.p_vib_speed = -0.13648848579133943 + frnd(0.2) - 0.1;
      result.p_vib_strength = 0.0018874158972302657 + frnd(0.2) - 0.1;
    }
    return result;

  }

  result.wave_type = Math.floor(frnd(SHAPES.length));//TRIANGLE;
  if (result.wave_type === 1 || result.wave_type === 3) {
    result.wave_type = 2;
  }
  //new
  result.p_base_freq = 0.85 + frnd(0.15);
  result.p_freq_ramp = 0.3 + frnd(0.15);
//  result.p_freq_dramp = 0.3+frnd(2.0);

  result.p_env_attack = 0 + frnd(0.09);
  result.p_env_sustain = 0.2 + frnd(0.3);
  result.p_env_decay = 0 + frnd(0.1);

  result.p_duty = frnd(2.0) - 1.0;
  result.p_duty_ramp = Math.pow(frnd(2.0) - 1.0, 3.0);


  result.p_repeat_speed = 0.5 + frnd(0.1);

  result.p_pha_offset = -0.3 + frnd(0.9);
  result.p_pha_ramp = -frnd(0.3);

  result.p_arp_speed = 0.4 + frnd(0.6);
  result.p_arp_mod = 0.8 + frnd(0.1);


  result.p_lpf_resonance = frnd(2.0) - 1.0;
  result.p_lpf_freq = 1.0 - Math.pow(frnd(1.0), 3.0);
  result.p_lpf_ramp = Math.pow(frnd(2.0) - 1.0, 3.0);
  if (result.p_lpf_freq < 0.1 && result.p_lpf_ramp < -0.05)
    result.p_lpf_ramp = -result.p_lpf_ramp;
  result.p_hpf_freq = Math.pow(frnd(1.0), 5.0);
  result.p_hpf_ramp = Math.pow(frnd(2.0) - 1.0, 5.0);

  return result;
}


function pushSound() {
  var result=Params();
  result.wave_type = Math.floor(frnd(SHAPES.length));//TRIANGLE;
  if (result.wave_type === 2) {
    result.wave_type++;
  }
  if (result.wave_type === 0) {
    result.wave_type = NOISE;
  }
  //new
  result.p_base_freq = 0.1 + frnd(0.4);
  result.p_freq_ramp = 0.05 + frnd(0.2);

  result.p_env_attack = 0.01 + frnd(0.09);
  result.p_env_sustain = 0.01 + frnd(0.09);
  result.p_env_decay = 0.01 + frnd(0.09);

  result.p_repeat_speed = 0.3 + frnd(0.5);
  result.p_pha_offset = -0.3 + frnd(0.9);
  result.p_pha_ramp = -frnd(0.3);
  result.p_arp_speed = 0.6 + frnd(0.3);
  result.p_arp_mod = 0.8 - frnd(1.6);

  return result;
}



function powerUp() {
  var result=Params();
  if (rnd(1))
    result.wave_type = SAWTOOTH;
  else
    result.p_duty = frnd(0.6);
  result.wave_type = Math.floor(frnd(SHAPES.length));
  if (result.wave_type === 3) {
    result.wave_type = SQUARE;
  }
  if (rnd(1))
  {
    result.p_base_freq = 0.2 + frnd(0.3);
    result.p_freq_ramp = 0.1 + frnd(0.4);
    result.p_repeat_speed = 0.4 + frnd(0.4);
  }
  else
  {
    result.p_base_freq = 0.2 + frnd(0.3);
    result.p_freq_ramp = 0.05 + frnd(0.2);
    if (rnd(1))
    {
      result.p_vib_strength = frnd(0.7);
      result.p_vib_speed = frnd(0.6);
    }
  }
  result.p_env_attack = 0.0;
  result.p_env_sustain = frnd(0.4);
  result.p_env_decay = 0.1 + frnd(0.4);

  return result;
}

function hitHurt() {
  result = Params();
  result.wave_type = rnd(2);
  if (result.wave_type === SINE)
    result.wave_type = NOISE;
  if (result.wave_type === SQUARE)
    result.p_duty = frnd(0.6);
  result.wave_type = Math.floor(frnd(SHAPES.length));
  result.p_base_freq = 0.2 + frnd(0.6);
  result.p_freq_ramp = -0.3 - frnd(0.4);
  result.p_env_attack = 0.0;
  result.p_env_sustain = frnd(0.1);
  result.p_env_decay = 0.1 + frnd(0.2);
  if (rnd(1))
    result.p_hpf_freq = frnd(0.3);
  return result;
}


function jump() {
  result = Params();
  result.wave_type = SQUARE;
  result.wave_type = Math.floor(frnd(SHAPES.length));
  if (result.wave_type === 3) {
    result.wave_type = SQUARE;
  }
  result.p_duty = frnd(0.6);
  result.p_base_freq = 0.3 + frnd(0.3);
  result.p_freq_ramp = 0.1 + frnd(0.2);
  result.p_env_attack = 0.0;
  result.p_env_sustain = 0.1 + frnd(0.3);
  result.p_env_decay = 0.1 + frnd(0.2);
  if (rnd(1))
    result.p_hpf_freq = frnd(0.3);
  if (rnd(1))
    result.p_lpf_freq = 1.0 - frnd(0.6);
  return result;
}

function blipSelect() {
  result = Params();
  result.wave_type = rnd(1);
  result.wave_type = Math.floor(frnd(SHAPES.length));
  if (result.wave_type === 3) {
    result.wave_type = rnd(1);
  }
  if (result.wave_type === SQUARE)
    result.p_duty = frnd(0.6);
  result.p_base_freq = 0.2 + frnd(0.4);
  result.p_env_attack = 0.0;
  result.p_env_sustain = 0.1 + frnd(0.1);
  result.p_env_decay = frnd(0.2);
  result.p_hpf_freq = 0.1;
  return result;
}

function random() {
  result = Params();
  result.wave_type = Math.floor(frnd(SHAPES.length));
  result.p_base_freq = Math.pow(frnd(2.0) - 1.0, 2.0);
  if (rnd(1))
    result.p_base_freq = Math.pow(frnd(2.0) - 1.0, 3.0) + 0.5;
  result.p_freq_limit = 0.0;
  result.p_freq_ramp = Math.pow(frnd(2.0) - 1.0, 5.0);
  if (result.p_base_freq > 0.7 && result.p_freq_ramp > 0.2)
    result.p_freq_ramp = -result.p_freq_ramp;
  if (result.p_base_freq < 0.2 && result.p_freq_ramp < -0.05)
    result.p_freq_ramp = -result.p_freq_ramp;
  result.p_freq_dramp = Math.pow(frnd(2.0) - 1.0, 3.0);
  result.p_duty = frnd(2.0) - 1.0;
  result.p_duty_ramp = Math.pow(frnd(2.0) - 1.0, 3.0);
  result.p_vib_strength = Math.pow(frnd(2.0) - 1.0, 3.0);
  result.p_vib_speed = frnd(2.0) - 1.0;
  result.p_env_attack = Math.pow(frnd(2.0) - 1.0, 3.0);
  result.p_env_sustain = Math.pow(frnd(2.0) - 1.0, 2.0);
  result.p_env_decay = frnd(2.0) - 1.0;
  result.p_env_punch = Math.pow(frnd(0.8), 2.0);
  if (result.p_env_attack + result.p_env_sustain + result.p_env_decay < 0.2) {
    result.p_env_sustain += 0.2 + frnd(0.3);
    result.p_env_decay += 0.2 + frnd(0.3);
  }
  result.p_lpf_resonance = frnd(2.0) - 1.0;
  result.p_lpf_freq = 1.0 - Math.pow(frnd(1.0), 3.0);
  result.p_lpf_ramp = Math.pow(frnd(2.0) - 1.0, 3.0);
  if (result.p_lpf_freq < 0.1 && result.p_lpf_ramp < -0.05)
    result.p_lpf_ramp = -result.p_lpf_ramp;
  result.p_hpf_freq = Math.pow(frnd(1.0), 5.0);
  result.p_hpf_ramp = Math.pow(frnd(2.0) - 1.0, 5.0);
  result.p_pha_offset = Math.pow(frnd(2.0) - 1.0, 3.0);
  result.p_pha_ramp = Math.pow(frnd(2.0) - 1.0, 3.0);
  result.p_repeat_speed = frnd(2.0) - 1.0;
  result.p_arp_speed = frnd(2.0) - 1.0;
  result.p_arp_mod = frnd(2.0) - 1.0;
  return result;
}

var generators = [
pickupCoin,
laserShoot,
explosion,
powerUp,
hitHurt,
jump,
blipSelect,
pushSound,
random,
birdSound
];

var generatorNames = [
'pickupCoin',
'laserShoot',
'explosion',
'powerUp',
'hitHurt',
'jump',
'blipSelect',
'pushSound',
'random',
'birdSound'
];

/*
i like 9675111
*/
function generateFromSeed(seed) {
  rng = new RNG((seed / 100) | 0);
  var generatorindex = seed % 100;
  var soundGenerator = generators[generatorindex % generators.length];
  seeded = true;
  var result = soundGenerator();
  result.seed = seed;
  seeded = false;
  return result;
}

// function SoundEffect(length, sample_rate) {
//   this._buffer = AUDIO_CONTEXT.createBuffer(1, length, sample_rate);
// }

// SoundEffect.prototype.getBuffer = function() {
//   return this._buffer.getChannelData(0);
// };


// SoundEffect.prototype.play = function() {
//     debugger
//   var source = AUDIO_CONTEXT.createBufferSource();
// https://github.com/audiojs/audio-biquad
// //   var filter1 = AUDIO_CONTEXT.createBiquadFilter();
// //   var filter2 = AUDIO_CONTEXT.createBiquadFilter();
// //   var filter3 = AUDIO_CONTEXT.createBiquadFilter();
//     // const filter1 = biquad.allpass({frequency: 1600}) // https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode/type
//     // const filter2 = biquad.allpass({frequency: 1600})
//     // const filter3 = biquad.allpass({frequency: 1600})

//   source.buffer = this._buffer;
// //   source.connect(filter1);

// //   filter1.frequency.value = 1600;
// //   filter2.frequency.value = 1600;
// //   filter3.frequency.value = 1600;

// //   filter1.connect(filter2);
// //   filter2.connect(filter3);
// //   filter3.connect(AUDIO_CONTEXT.destination);

// source.connect(AUDIO_CONTEXT.destination)

//   var t = AUDIO_CONTEXT.currentTime;
//   if (typeof source.start != 'undefined') {
//     source.start(t);
//   } else {
//     source.noteOn(t);
//   }
// //   source.onended = function() {
// //     filter3.disconnect()
// //   }
// };

// let CURERNT_SILENTBUFFER = null

// if (typeof AUDIO_CONTEXT == 'undefined') {
  var SoundEffect = function SoundEffect(length, sample_rate) {
    this._sample_rate = sample_rate;
    this._buffer = new Array(length);
    this._audioElement = null;
    this._decodedBuffer = null
  };

  SoundEffect.MIN_SAMPLE_RATE = 22050;

  SoundEffect.prototype.getBuffer = function() {
    this._audioElement = null;
    return this._buffer;
  };

  SoundEffect.prototype.cacheDecodedBuffer = function() {
    for (var i = 0; i < this._buffer.length; i++) {
        // bit_depth is always 8, rescale [-1.0, 1.0) to [0, 256)
        this._buffer[i] = 255 & Math.floor(128 * Math.max(0, Math.min(this._buffer[i] + 1, 2)));
      }
      var wav = MakeRiff(this._sample_rate, BIT_DEPTH, this._buffer);


    const b64string = FastBase64_Encode(wav.wav)
    this._decodedBuffer = Buffer.from(b64string, 'base64')
  }

  // Disable speaker for Travis
  if (Speaker) {
    AUDIO_CONTEXT.pipe(new Speaker({
        channels: AUDIO_CONTEXT.format.channels,
        bitDepth: AUDIO_CONTEXT.format.bitDepth,
        sampleRate: AUDIO_CONTEXT.sampleRate
    }))
  }

  SoundEffect.prototype.play = async function() {


    // from https://mdn.github.io/webaudio-examples/audio-buffer/
    // which is from https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer
    function makeSilence() {
        var channels = 2;
        // Create an empty two second stereo buffer at the
        // sample rate of the AudioContext
        var frameCount = AUDIO_CONTEXT.sampleRate * 2.0;

        var myArrayBuffer = AUDIO_CONTEXT.createBuffer(channels, frameCount, AUDIO_CONTEXT.sampleRate);


        // Fill the buffer with white noise;
        //just random values between -1.0 and 1.0
        for (var channel = 0; channel < channels; channel++) {
            // This gives us the actual array that contains the data
            var nowBuffering = myArrayBuffer.getChannelData(channel);
            for (var i = 0; i < frameCount; i++) {
                // Math.random() is in [0; 1.0]
                // audio needs to be in [-1.0; 1.0]
                nowBuffering[i] = 0;
            }
        }

        // // Get an AudioBufferSourceNode.
        // // This is the AudioNode to use when we want to play an AudioBuffer
        // var source = AUDIO_CONTEXT.createBufferSource();
        // // set the buffer in the AudioBufferSourceNode
        // source.buffer = myArrayBuffer;
        // // connect the AudioBufferSourceNode to the
        // // destination so we can hear the sound
        // source.connect(AUDIO_CONTEXT.destination);
        // // start the source playing
        // source.start();

        return myArrayBuffer
    }

    return new Promise((resolve, reject) => {
        AUDIO_CONTEXT.decodeAudioData(this._decodedBuffer, (audioBuffer) => {

            var bufferNode = AUDIO_CONTEXT.createBufferSource()
            bufferNode.connect(AUDIO_CONTEXT.destination)
            bufferNode.buffer = audioBuffer
            bufferNode.loop = false
            bufferNode.start(0)
            AUDIO_CONTEXT.resume()

            // if (CURERNT_SILENTBUFFER) {
            //     CURERNT_SILENTBUFFER.stop(0)
            // }
            // CURERNT_SILENTBUFFER = AUDIO_CONTEXT.createBufferSource()
            // CURERNT_SILENTBUFFER.connect(AUDIO_CONTEXT.destination)
            // CURERNT_SILENTBUFFER.buffer = makeSilence()
            // CURERNT_SILENTBUFFER.loop = true
            // CURERNT_SILENTBUFFER.start(0)

            bufferNode.onended = async () => {
                // bufferNode.stop(0)

                // const x = await sleep(10000)

                // Play silence
                // CURERNT_SILENTBUFFER = AUDIO_CONTEXT.createBufferSource()
                // CURERNT_SILENTBUFFER.buffer = [0] // silence
                // CURERNT_SILENTBUFFER.loop = true
                // CURERNT_SILENTBUFFER.connect(AUDIO_CONTEXT.destination)
                // CURERNT_SILENTBUFFER.start(0)

                // AUDIO_CONTEXT.outStream._flush()
                // AUDIO_CONTEXT.outStream.end()

                // AUDIO_CONTEXT.outStream._flush() // End the speaker
                // AUDIO_CONTEXT._playing = false // So we do not continue outputing sound (since onended did not actually work) ... maybe we should do bufferNode.on('kill', ...)
                // AUDIO_CONTEXT._kill()
                // // AUDIO_CONTEXT.outStream.end()
                // // AUDIO_CONTEXT.outStream.close()
                // AUDIO_CONTEXT = new AudioContext() // after ._kill() is called, we need to create a new context
                // AUDIO_CONTEXT.sampleRate = SAMPLE_RATE
                resolve('SOUND_EFFECT_FINISHED_PLAYING')
            }
        })

    })

  };

  SoundEffect.MIN_SAMPLE_RATE = 1;
// }

SoundEffect.generate = function(ps) {
/*  window.console.log(ps.wave_type + "\t" + ps.seed);

  var psstring="";
  for (var n in ps) {
    if (ps.hasOwnProperty(n)) {
      psstring = psstring +"result." + n+" = " + ps[n] + ";\n";
    }
  }
window.console.log(ps);
window.console.log(psstring);*/
  function repeat() {
    rep_time = 0;

    fperiod = 100.0 / (ps.p_base_freq * ps.p_base_freq + 0.001);
    period = Math.floor(fperiod);
    fmaxperiod = 100.0 / (ps.p_freq_limit * ps.p_freq_limit + 0.001);

    fslide = 1.0 - Math.pow(ps.p_freq_ramp, 3.0) * 0.01;
    fdslide = -Math.pow(ps.p_freq_dramp, 3.0) * 0.000001;

    square_duty = 0.5 - ps.p_duty * 0.5;
    square_slide = -ps.p_duty_ramp * 0.00005;

    if (ps.p_arp_mod >= 0.0)
      arp_mod = 1.0 - Math.pow(ps.p_arp_mod, 2.0) * 0.9;
    else
      arp_mod = 1.0 + Math.pow(ps.p_arp_mod, 2.0) * 10.0;
    arp_time = 0;
    arp_limit = Math.floor(Math.pow(1.0 - ps.p_arp_speed, 2.0) * 20000 + 32);
    if (ps.p_arp_speed == 1.0)
      arp_limit = 0;
  }

  var rep_time;
  var fperiod, period, fmaxperiod;
  var fslide, fdslide;
  var square_duty, square_slide;
  var arp_mod, arp_time, arp_limit;
  repeat();  // First time through, this is a bit of a misnomer

  // Filter
  var fltp = 0.0;
  var fltdp = 0.0;
  var fltw = Math.pow(ps.p_lpf_freq, 3.0) * 0.1;
  var fltw_d = 1.0 + ps.p_lpf_ramp * 0.0001;
  var fltdmp = 5.0 / (1.0 + Math.pow(ps.p_lpf_resonance, 2.0) * 20.0) *
    (0.01 + fltw);
  if (fltdmp > 0.8) fltdmp = 0.8;
  var fltphp = 0.0;
  var flthp = Math.pow(ps.p_hpf_freq, 2.0) * 0.1;
  var flthp_d = 1.0 + ps.p_hpf_ramp * 0.0003;

  // Vibrato
  var vib_phase = 0.0;
  var vib_speed = Math.pow(ps.p_vib_speed, 2.0) * 0.01;
  var vib_amp = ps.p_vib_strength * 0.5;

  // Envelope
  var env_vol = 0.0;
  var env_stage = 0;
  var env_time = 0;
  var env_length = [
    Math.floor(ps.p_env_attack * ps.p_env_attack * 100000.0),
    Math.floor(ps.p_env_sustain * ps.p_env_sustain * 100000.0),
    Math.floor(ps.p_env_decay * ps.p_env_decay * 100000.0)
  ];
  var env_total_length = env_length[0] + env_length[1] + env_length[2];

  // Phaser
  var phase = 0;
  var fphase = Math.pow(ps.p_pha_offset, 2.0) * 1020.0;
  if (ps.p_pha_offset < 0.0) fphase = -fphase;
  var fdphase = Math.pow(ps.p_pha_ramp, 2.0) * 1.0;
  if (ps.p_pha_ramp < 0.0) fdphase = -fdphase;
  var iphase = Math.abs(Math.floor(fphase));
  var ipp = 0;
  var phaser_buffer = [];
  for (var i = 0; i < 1024; ++i)
    phaser_buffer[i] = 0.0;

  // Noise
  var noise_buffer = [];
  for (var i = 0; i < 32; ++i)
    noise_buffer[i] = Math.random() * 2.0 - 1.0;

  // Repeat
  var rep_limit = Math.floor(Math.pow(1.0 - ps.p_repeat_speed, 2.0) * 20000
                             + 32);
  if (ps.p_repeat_speed == 0.0)
    rep_limit = 0;

  //var gain = 2.0 * Math.log(1 + (Math.E - 1) * ps.sound_vol);
  var gain = 2.0 * ps.sound_vol;
  var gain = Math.exp(ps.sound_vol) - 1;

  var num_clipped = 0;

  // ...end of initialization. Generate samples.

  var sample_sum = 0;
  var num_summed = 0;
  var summands = Math.floor(44100 / ps.sample_rate);

  var buffer_i = 0;
  var buffer_length = Math.ceil(env_total_length / summands);
  var buffer_complete = false;

  var sound;
  if (ps.sample_rate < SoundEffect.MIN_SAMPLE_RATE) {
    // Assume 4x gets close enough to MIN_SAMPLE_RATE
    sound = new SoundEffect(4 * buffer_length, SoundEffect.MIN_SAMPLE_RATE);
  } else {
    sound = new SoundEffect(buffer_length, ps.sample_rate)
  }
  var buffer = sound.getBuffer();

  for (var t = 0;; ++t) {

    // Repeats
    if (rep_limit != 0 && ++rep_time >= rep_limit)
      repeat();

    // Arpeggio (single)
    if (arp_limit != 0 && t >= arp_limit) {
      arp_limit = 0;
      fperiod *= arp_mod;
    }

    // Frequency slide, and frequency slide slide!
    fslide += fdslide;
    fperiod *= fslide;
    if (fperiod > fmaxperiod) {
      fperiod = fmaxperiod;
      if (ps.p_freq_limit > 0.0)
        buffer_complete = true;
    }

    // Vibrato
    var rfperiod = fperiod;
    if (vib_amp > 0.0) {
      vib_phase += vib_speed;
      rfperiod = fperiod * (1.0 + Math.sin(vib_phase) * vib_amp);
    }
    period = Math.floor(rfperiod);
    if (period < 8) period = 8;

    square_duty += square_slide;
    if (square_duty < 0.0) square_duty = 0.0;
    if (square_duty > 0.5) square_duty = 0.5;

    // Volume envelope
    env_time++;
    if (env_time > env_length[env_stage]) {
      env_time = 1;
      env_stage++;
      while (env_stage < 3 && env_length[env_stage] === 0)
	env_stage++;
      if (env_stage === 3)
        break;
    }
    if (env_stage === 0)
      env_vol = env_time / env_length[0];
    else if (env_stage === 1)
      env_vol = 1.0 + Math.pow(1.0 - env_time / env_length[1],
                               1.0) * 2.0 * ps.p_env_punch;
    else  // env_stage == 2
      env_vol = 1.0 - env_time / env_length[2];

    // Phaser step
    fphase += fdphase;
    iphase = Math.abs(Math.floor(fphase));
    if (iphase > 1023) iphase = 1023;

    if (flthp_d != 0.0) {
      flthp *= flthp_d;
      if (flthp < 0.00001)
        flthp = 0.00001;
      if (flthp > 0.1)
        flthp = 0.1;
    }

    // 8x supersampling
    var sample = 0.0;
    for (var si = 0; si < 8; ++si) {
      var sub_sample = 0.0;
      phase++;
      if (phase >= period) {
        phase %= period;
        if (ps.wave_type === NOISE)
          for (var i = 0; i < 32; ++i)
            noise_buffer[i] = Math.random() * 2.0 - 1.0;
      }

      // Base waveform
      var fp = phase / period;
      if (ps.wave_type === SQUARE) {
        if (fp < square_duty)
          sub_sample = 0.5;
        else
          sub_sample = -0.5;
      } else if (ps.wave_type === SAWTOOTH) {
        sub_sample = 1.0 - fp * 2;
      } else if (ps.wave_type === SINE) {
        sub_sample = Math.sin(fp * 2 * Math.PI);
      } else if (ps.wave_type === NOISE) {
        sub_sample = noise_buffer[Math.floor(phase * 32 / period)];
      } else if (ps.wave_type === TRIANGLE) {
        sub_sample = Math.abs(1 - fp * 2) - 1;
      } else if (ps.wave_type === BREAKER) {
        sub_sample = Math.abs(1 - fp * fp * 2) - 1;
      } else {
        throw new Exception('bad wave type! ' + ps.wave_type);
      }

      // Low-pass filter
      var pp = fltp;
      fltw *= fltw_d;
      if (fltw < 0.0) fltw = 0.0;
      if (fltw > 0.1) fltw = 0.1;
      if (ps.p_lpf_freq != 1.0) {
        fltdp += (sub_sample - fltp) * fltw;
        fltdp -= fltdp * fltdmp;
      } else {
        fltp = sub_sample;
        fltdp = 0.0;
      }
      fltp += fltdp;

      // High-pass filter
      fltphp += fltp - pp;
      fltphp -= fltphp * flthp;
      sub_sample = fltphp;

      // Phaser
      phaser_buffer[ipp & 1023] = sub_sample;
      sub_sample += phaser_buffer[(ipp - iphase + 1024) & 1023];
      ipp = (ipp + 1) & 1023;

      // final accumulation and envelope application
      sample += sub_sample * env_vol;
    }

    // Accumulate samples appropriately for sample rate
    sample_sum += sample;
    if (++num_summed >= summands) {
      num_summed = 0;
      sample = sample_sum / summands;
      sample_sum = 0;
    } else {
      continue;
    }

    sample = sample / 8 * masterVolume;
    sample *= gain;

    buffer[buffer_i++] = sample;

    if (ps.sample_rate < SoundEffect.MIN_SAMPLE_RATE) {
      buffer[buffer_i++] = sample;
      buffer[buffer_i++] = sample;
      buffer[buffer_i++] = sample;
    }
  }

  if (summands > 0) {
    sample = sample_sum / summands;

    sample = sample / 8 * masterVolume;
    sample *= gain;

    buffer[buffer_i++] = sample;

    if (ps.sample_rate < SoundEffect.MIN_SAMPLE_RATE) {
      buffer[buffer_i++] = sample;
      buffer[buffer_i++] = sample;
      buffer[buffer_i++] = sample;
    }
  }

  sound.cacheDecodedBuffer()

  return sound;
};

// if (typeof exports != 'undefined') {
//   // For node.js
//   var RIFFWAVE = require('./riffwave').RIFFWAVE;
//   exports.Params = Params;
//   exports.generate = generate;
// }

var sfxCache = {};
var cachedSeeds = [];
var CACHE_MAX = 50;

function cacheSeed(seed){
  if (seed in sfxCache) {
    return sfxCache[seed];
  }

  var params = generateFromSeed(seed);
  params.sound_vol = SOUND_VOL;
  params.sample_rate = SAMPLE_RATE;
  params.bit_depth = BIT_DEPTH;

  var sound = SoundEffect.generate(params);
  sfxCache[seed] = sound;
  cachedSeeds.push(seed);

  while (cachedSeeds.length>CACHE_MAX) {
    var toRemove=cachedSeeds[0];
    cachedSeeds = cachedSeeds.slice(1);
    delete sfxCache[toRemove];
  }

  return sound;
}

function playSound(seed) {
  // Disable speaker for Travis
  if (!Speaker) {
    process.stdout.write('\u0007') // BELL character
    return Promise.resolve('SOUND_EFFECT_DID_NOT_PLAY_BECAUSE_CI')
  }

  checkAudioContextExists();
//   if (unitTesting) return;
  var sound = cacheSeed(seed);
  return sound.play();
}

function closeSounds() {
    // Disable speaker for Travis
    if (!Speaker) {
        return
    }

    AUDIO_CONTEXT._stream._flush() // End the speaker
    AUDIO_CONTEXT._playing = false // So we do not continue outputing sound (since onended did not actually work) ... maybe we should do bufferNode.on('kill', ...)
    AUDIO_CONTEXT._kill()
}

module.exports = {
    playSound,
    closeSounds
}