export interface ICFunction {
    name: string;
    signature: string;
    returnType: string;
    description: string;
    category: string;
    boardSupport?: ('handyboard' | 'sumo11' | 'rcx' | 'ax11')[];
}

export const IC_KEYWORDS = [
    'int', 'long', 'float', 'char', 'void', 'persistent', 'struct', 'union', 'typedef', 
    '#use', '#define', '#if', '#ifdef', '#endif'
];

export const IC_FUNCTIONS: ICFunction[] = [
    // Motor Control
    { name: 'fd', signature: 'fd(motor: int)', returnType: 'void', description: 'full speed forward', category: 'Motor Control' },
    { name: 'bk', signature: 'bk(motor: int)', returnType: 'void', description: 'full speed backward', category: 'Motor Control' },
    { name: 'off', signature: 'off(motor: int)', returnType: 'void', description: 'coast motor off', category: 'Motor Control' },
    { name: 'ao', signature: 'ao()', returnType: 'void', description: 'all motors off', category: 'Motor Control' },
    { name: 'alloff', signature: 'alloff()', returnType: 'void', description: 'all motors off', category: 'Motor Control' },
    { name: 'allbrake', signature: 'allbrake()', returnType: 'void', description: 'brake all motors', category: 'Motor Control' },
    { name: 'motor', signature: 'motor(channel: int, speed: int)', returnType: 'void', description: 'speed -100 to 100', category: 'Motor Control' },
    { name: 'servo', signature: 'servo(channel: int, position: int)', returnType: 'void', description: 'set servo position', category: 'Motor Control' },
    { name: 'servo_on', signature: 'servo_on()', returnType: 'void', description: 'enable servo', category: 'Motor Control' },
    { name: 'servo_off', signature: 'servo_off()', returnType: 'void', description: 'disable servo', category: 'Motor Control' },
    { name: '_set_motor', signature: '_set_motor(motor: int, dir: int, speed: int)', returnType: 'void', description: 'set motor details', category: 'Motor Control' },

    // Sensor Input
    { name: 'analog', signature: 'analog(channel: int)', returnType: 'int', description: 'read analog sensor 0-255', category: 'Sensor Input' },
    { name: 'digital', signature: 'digital(channel: int)', returnType: 'int', description: 'read digital input 0/1', category: 'Sensor Input' },
    { name: 'knob', signature: 'knob()', returnType: 'int', description: 'read potentiometer 0-255', category: 'Sensor Input' },
    { name: 'start_button', signature: 'start_button()', returnType: 'int', description: 'read start button', category: 'Sensor Input' },
    { name: 'stop_button', signature: 'stop_button()', returnType: 'int', description: 'read stop button', category: 'Sensor Input' },
    { name: 'start_press', signature: 'start_press()', returnType: 'void', description: 'wait for start press', category: 'Sensor Input' },
    { name: 'stop_press', signature: 'stop_press()', returnType: 'void', description: 'wait for stop press', category: 'Sensor Input' },

    // Time
    { name: 'sleep', signature: 'sleep(seconds: float)', returnType: 'void', description: 'sleep in seconds', category: 'Time' },
    { name: 'msleep', signature: 'msleep(msec: long)', returnType: 'void', description: 'sleep in milliseconds', category: 'Time' },
    { name: 'seconds', signature: 'seconds()', returnType: 'float', description: 'time since reset', category: 'Time' },
    { name: 'mseconds', signature: 'mseconds()', returnType: 'long', description: 'milliseconds since reset', category: 'Time' },
    { name: 'reset_system_time', signature: 'reset_system_time()', returnType: 'void', description: 'reset clock', category: 'Time' },

    // Sound
    { name: 'beep', signature: 'beep()', returnType: 'void', description: 'short beep', category: 'Sound' },
    { name: 'tone', signature: 'tone(frequency: float, length: float)', returnType: 'void', description: 'play tone', category: 'Sound' },
    { name: 'set_beeper_pitch', signature: 'set_beeper_pitch(frequency: float)', returnType: 'void', description: 'set beeper pitch', category: 'Sound' },
    { name: 'beeper_on', signature: 'beeper_on()', returnType: 'void', description: 'turn beeper on', category: 'Sound' },
    { name: 'beeper_off', signature: 'beeper_off()', returnType: 'void', description: 'turn beeper off', category: 'Sound' },

    // Multitasking
    { name: 'start_process', signature: 'start_process(func)', returnType: 'int', description: 'spawn process, returns pid', category: 'Multitasking' },
    { name: 'kill_process', signature: 'kill_process(pid: int)', returnType: 'void', description: 'kill process', category: 'Multitasking' },
    { name: 'defer', signature: 'defer()', returnType: 'void', description: 'yield CPU', category: 'Multitasking' },
    { name: 'hog_processor', signature: 'hog_processor()', returnType: 'void', description: 'get 256 ticks', category: 'Multitasking' },

    // Memory
    { name: 'poke', signature: 'poke(addr: int, val: int)', returnType: 'void', description: 'write byte', category: 'Memory' },
    { name: 'peek', signature: 'peek(addr: int)', returnType: 'int', description: 'read byte', category: 'Memory' },
    { name: 'pokeword', signature: 'pokeword(addr: int, val: int)', returnType: 'void', description: 'write word', category: 'Memory' },
    { name: 'peekword', signature: 'peekword(addr: int)', returnType: 'int', description: 'read word', category: 'Memory' },
    { name: 'bit_set', signature: 'bit_set(addr: int, mask: int)', returnType: 'void', description: 'set bits in memory', category: 'Memory' },
    { name: 'bit_clear', signature: 'bit_clear(addr: int, mask: int)', returnType: 'void', description: 'clear bits in memory', category: 'Memory' },

    // Display
    { name: 'printf', signature: 'printf(format, ...)', returnType: 'void', description: 'print to LCD/console', category: 'Display' },

    // Encoder
    { name: 'enable_encoder', signature: 'enable_encoder(port: int)', returnType: 'void', description: 'enable encoder', category: 'Encoder' },
    { name: 'read_encoder', signature: 'read_encoder(port: int)', returnType: 'int', description: 'read encoder', category: 'Encoder' },
    { name: 'reset_encoder', signature: 'reset_encoder(port: int)', returnType: 'void', description: 'reset encoder', category: 'Encoder' },

    // AX-11 INEX Sensors
    { name: 'zx21_encoder', signature: 'zx21_encoder(channel: int)', returnType: 'int', description: 'ZX-21 Wheel Encoder', category: 'AX-11 INEX Sensors', boardSupport: ['ax11'] },
    { name: 'compass', signature: 'compass()', returnType: 'int', description: 'Electronic Compass', category: 'AX-11 INEX Sensors', boardSupport: ['ax11'] },
    { name: 'ultrasonic', signature: 'ultrasonic(channel: int)', returnType: 'int', description: 'Ultrasonic Rangefinder', category: 'AX-11 INEX Sensors', boardSupport: ['ax11'] },
    { name: 'gp2d120', signature: 'gp2d120(channel: int)', returnType: 'int', description: 'Sharp GP2D120 IR Distance (4-30cm)', category: 'AX-11 INEX Sensors', boardSupport: ['ax11'] },

    // Other
    { name: 'random', signature: 'random(mod: int)', returnType: 'int', description: 'random number', category: 'Other' }
];
