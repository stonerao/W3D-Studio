<template>
    <div class="advanced-color-picker" ref="pickerRef">
        <!-- English comment. -->
        <div class="color-trigger" @click="togglePicker">
            <div 
                class="color-preview-box" 
                :style="{ backgroundColor: modelValue }"
                :title="modelValue"
            >
                <div class="checkerboard"></div>
            </div>
            <div class="color-value">
                <span class="hex-value">{{ modelValue }}</span>
                <span class="dropdown-icon">▼</span>
            </div>
        </div>

        <!-- English comment. -->
        <Teleport to="body">
            <Transition name="picker-fade">
                <div 
                    v-if="isOpen" 
                    class="picker-panel"
                    :style="panelStyle"
                    @click.stop
                >
                    <!-- English comment. -->
                    <div class="saturation-panel">
                        <div 
                            ref="saturationRef"
                            class="saturation-canvas"
                            :style="{ backgroundColor: hueColor }"
                            @mousedown="startSaturationDrag"
                            @touchstart.prevent="startSaturationDrag"
                        >
                            <div class="saturation-white"></div>
                            <div class="saturation-black"></div>
                            <div 
                                class="saturation-cursor"
                                :style="saturationCursorStyle"
                            ></div>
                        </div>
                    </div>

                    <!-- English comment. -->
                    <div class="hue-slider">
                        <div 
                            ref="hueRef"
                            class="hue-track"
                            @mousedown="startHueDrag"
                            @touchstart.prevent="startHueDrag"
                        >
                            <div 
                                class="hue-cursor"
                                :style="{ left: `${(hsv.h / 360) * 100}%` }"
                            ></div>
                        </div>
                    </div>

                    <!-- English comment. -->
                    <div class="color-info">
                        <div class="preview-section">
                            <div class="preview-colors">
                                <div 
                                    class="preview-current" 
                                    :style="{ backgroundColor: modelValue }"
                                    title="当前颜色"
                                >
                                    <div class="checkerboard-sm"></div>
                                </div>
                                <div 
                                    class="preview-original" 
                                    :style="{ backgroundColor: originalColor }"
                                    title="原始颜色"
                                    @click="resetToOriginal"
                                >
                                    <div class="checkerboard-sm"></div>
                                </div>
                            </div>
                        </div>
                        <div class="input-section">
                            <div class="input-group">
                                <label>HEX</label>
                                <input 
                                    type="text" 
                                    :value="hexInput"
                                    @input="handleHexInput"
                                    @blur="validateHexInput"
                                    @keydown.enter="validateHexInput"
                                    class="hex-input"
                                    maxlength="7"
                                />
                            </div>
                            <div class="rgb-inputs">
                                <div class="input-group small">
                                    <label>R</label>
                                    <input 
                                        type="number" 
                                        :value="rgb.r"
                                        @input="handleRgbInput('r', $event)"
                                        min="0" 
                                        max="255"
                                        class="rgb-input"
                                    />
                                </div>
                                <div class="input-group small">
                                    <label>G</label>
                                    <input 
                                        type="number" 
                                        :value="rgb.g"
                                        @input="handleRgbInput('g', $event)"
                                        min="0" 
                                        max="255"
                                        class="rgb-input"
                                    />
                                </div>
                                <div class="input-group small">
                                    <label>B</label>
                                    <input 
                                        type="number" 
                                        :value="rgb.b"
                                        @input="handleRgbInput('b', $event)"
                                        min="0" 
                                        max="255"
                                        class="rgb-input"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- English comment. -->
                    <div class="preset-colors">
                        <div class="preset-title">常用颜色</div>
                        <div class="preset-grid">
                            <div 
                                v-for="(color, index) in presetColors" 
                                :key="index"
                                class="preset-color"
                                :style="{ backgroundColor: color }"
                                :title="color"
                                @click="selectPreset(color)"
                            >
                                <div v-if="modelValue === color" class="preset-check">✓</div>
                            </div>
                        </div>
                    </div>

                    <!-- English comment. -->
                    <div v-if="recentColors.length > 0" class="recent-colors">
                        <div class="preset-title">最近使用</div>
                        <div class="preset-grid">
                            <div 
                                v-for="(color, index) in recentColors" 
                                :key="index"
                                class="preset-color"
                                :style="{ backgroundColor: color }"
                                :title="color"
                                @click="selectPreset(color)"
                            >
                                <div v-if="modelValue === color" class="preset-check">✓</div>
                            </div>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <!-- English comment. -->
        <Teleport to="body">
            <div 
                v-if="isOpen" 
                class="picker-backdrop"
                @click="closePicker"
            ></div>
        </Teleport>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps({
    modelValue: {
        type: String,
        default: '#ffffff'
    },
    disabled: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:modelValue', 'change']);

// English comment.
const isOpen = ref(false);
const pickerRef = ref(null);
const saturationRef = ref(null);
const hueRef = ref(null);
const hexInput = ref(props.modelValue);
const originalColor = ref(props.modelValue);
const panelStyle = ref({});

// English comment.
const hsv = ref({ h: 0, s: 1, v: 1 });

// English comment.
const rgb = computed(() => hsvToRgb(hsv.value.h, hsv.value.s, hsv.value.v));

// English comment.
const recentColors = ref([]);

// English comment.
const presetColors = [
    '#ffffff', '#000000', '#808080', '#c0c0c0',
    '#ff0000', '#ff6600', '#ffcc00', '#ffff00',
    '#99ff00', '#00ff00', '#00ff99', '#00ffff',
    '#0099ff', '#0000ff', '#6600ff', '#ff00ff',
    '#ff0099', '#cc6600', '#996633', '#663300',
    '#ff9999', '#ffcc99', '#ffff99', '#ccff99',
    '#99ffcc', '#99ffff', '#99ccff', '#9999ff',
];

// English comment.
const hueColor = computed(() => {
    const { r, g, b } = hsvToRgb(hsv.value.h, 1, 1);
    return `rgb(${r}, ${g}, ${b})`;
});

// English comment.
const saturationCursorStyle = computed(() => ({
    left: `${hsv.value.s * 100}%`,
    top: `${(1 - hsv.value.v) * 100}%`
}));

// English comment.
watch(() => props.modelValue, (newValue) => {
    hexInput.value = newValue;
    const { h, s, v } = hexToHsv(newValue);
    hsv.value = { h, s, v };
}, { immediate: true });

// English comment.
const togglePicker = () => {
    if (props.disabled) return;
    if (!isOpen.value) {
        originalColor.value = props.modelValue;
        openPicker();
    } else {
        closePicker();
    }
};

const openPicker = async () => {
    isOpen.value = true;
    await nextTick();
    updatePanelPosition();
};

const closePicker = () => {
    isOpen.value = false;
    addToRecent(props.modelValue);
    emit('change', props.modelValue);
};

// English comment.
const updatePanelPosition = () => {
    if (!pickerRef.value) return;
    const rect = pickerRef.value.getBoundingClientRect();
    const panelWidth = 280;
    const panelHeight = 420;
    
    let left = rect.left;
    let top = rect.bottom + 8;
    
    // English comment.
    if (left + panelWidth > window.innerWidth) {
        left = window.innerWidth - panelWidth - 16;
    }
    
    // English comment.
    if (top + panelHeight > window.innerHeight) {
        top = rect.top - panelHeight - 8;
    }
    
    panelStyle.value = {
        left: `${Math.max(8, left)}px`,
        top: `${Math.max(8, top)}px`
    };
};

// English comment.
let isDraggingSaturation = false;

const startSaturationDrag = (e) => {
    isDraggingSaturation = true;
    updateSaturation(e);
    document.addEventListener('mousemove', updateSaturation);
    document.addEventListener('mouseup', stopSaturationDrag);
    document.addEventListener('touchmove', updateSaturation);
    document.addEventListener('touchend', stopSaturationDrag);
};

const updateSaturation = (e) => {
    if (!isDraggingSaturation || !saturationRef.value) return;
    
    const rect = saturationRef.value.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    let x = (clientX - rect.left) / rect.width;
    let y = (clientY - rect.top) / rect.height;
    
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));
    
    hsv.value.s = x;
    hsv.value.v = 1 - y;
    
    updateColor();
};

const stopSaturationDrag = () => {
    isDraggingSaturation = false;
    document.removeEventListener('mousemove', updateSaturation);
    document.removeEventListener('mouseup', stopSaturationDrag);
    document.removeEventListener('touchmove', updateSaturation);
    document.removeEventListener('touchend', stopSaturationDrag);
};

// English comment.
let isDraggingHue = false;

const startHueDrag = (e) => {
    isDraggingHue = true;
    updateHue(e);
    document.addEventListener('mousemove', updateHue);
    document.addEventListener('mouseup', stopHueDrag);
    document.addEventListener('touchmove', updateHue);
    document.addEventListener('touchend', stopHueDrag);
};

const updateHue = (e) => {
    if (!isDraggingHue || !hueRef.value) return;
    
    const rect = hueRef.value.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    
    let x = (clientX - rect.left) / rect.width;
    x = Math.max(0, Math.min(1, x));
    
    hsv.value.h = x * 360;
    
    updateColor();
};

const stopHueDrag = () => {
    isDraggingHue = false;
    document.removeEventListener('mousemove', updateHue);
    document.removeEventListener('mouseup', stopHueDrag);
    document.removeEventListener('touchmove', updateHue);
    document.removeEventListener('touchend', stopHueDrag);
};

// English comment.
const updateColor = () => {
    const hex = hsvToHex(hsv.value.h, hsv.value.s, hsv.value.v);
    hexInput.value = hex;
    emit('update:modelValue', hex);
};

// English comment.
const handleHexInput = (e) => {
    hexInput.value = e.target.value;
};

const validateHexInput = () => {
    let value = hexInput.value.trim();
    if (!value.startsWith('#')) {
        value = '#' + value;
    }
    
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
        emit('update:modelValue', value.toLowerCase());
        const { h, s, v } = hexToHsv(value);
        hsv.value = { h, s, v };
    } else {
        hexInput.value = props.modelValue;
    }
};

// English comment.
const handleRgbInput = (channel, e) => {
    let value = parseInt(e.target.value) || 0;
    value = Math.max(0, Math.min(255, value));
    
    const newRgb = { ...rgb.value, [channel]: value };
    const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    const { h, s, v } = hexToHsv(hex);
    
    hsv.value = { h, s, v };
    hexInput.value = hex;
    emit('update:modelValue', hex);
};

// English comment.
const selectPreset = (color) => {
    emit('update:modelValue', color);
    const { h, s, v } = hexToHsv(color);
    hsv.value = { h, s, v };
    hexInput.value = color;
};

// English comment.
const resetToOriginal = () => {
    selectPreset(originalColor.value);
};

// English comment.
const addToRecent = (color) => {
    if (!color || presetColors.includes(color)) return;
    
    const index = recentColors.value.indexOf(color);
    if (index > -1) {
        recentColors.value.splice(index, 1);
    }
    
    recentColors.value.unshift(color);
    
    if (recentColors.value.length > 8) {
        recentColors.value.pop();
    }
};

// English comment.
function hexToHsv(hex) {
    const { r, g, b } = hexToRgb(hex);
    return rgbToHsv(r, g, b);
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    
    let h = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;
    
    if (max !== min) {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    
    return { h: h * 360, s, v };
}

function hsvToRgb(h, s, v) {
    h /= 360;
    
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    
    let r, g, b;
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

function hsvToHex(h, s, v) {
    const { r, g, b } = hsvToRgb(h, s, v);
    return rgbToHex(r, g, b);
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

// English comment.
const handleResize = () => {
    if (isOpen.value) {
        updatePanelPosition();
    }
};

onMounted(() => {
    window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    stopSaturationDrag();
    stopHueDrag();
});
</script>

<style scoped>
.advanced-color-picker {
    position: relative;
    width: 100%;
}

.color-trigger {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    background-color: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.color-trigger:hover {
    border-color: var(--color-primary);
    background-color: var(--color-bg-hover);
}

.color-preview-box {
    position: relative;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
    overflow: hidden;
}

.checkerboard,
.checkerboard-sm {
    position: absolute;
    inset: 0;
    z-index: -1;
    background-image: 
        linear-gradient(45deg, #ccc 25%, transparent 25%),
        linear-gradient(-45deg, #ccc 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #ccc 75%),
        linear-gradient(-45deg, transparent 75%, #ccc 75%);
    background-size: 8px 8px;
    background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
}

.checkerboard-sm {
    background-size: 6px 6px;
    background-position: 0 0, 0 3px, 3px -3px, -3px 0px;
}

.color-value {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-width: 0;
}

.hex-value {
    font-family: monospace;
    font-size: 0.8125rem;
    color: var(--color-text-primary);
    text-transform: uppercase;
}

.dropdown-icon {
    font-size: 0.625rem;
    color: var(--color-text-tertiary);
    transition: transform var(--transition-fast);
}

.color-trigger:hover .dropdown-icon {
    color: var(--color-primary);
}

/* English comment. */
.picker-backdrop {
    position: fixed;
    inset: 0;
    z-index: 999;
}

.picker-panel {
    position: fixed;
    z-index: 1000;
    width: 280px;
    background-color: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.picker-fade-enter-active,
.picker-fade-leave-active {
    transition: all 0.15s ease;
}

.picker-fade-enter-from,
.picker-fade-leave-to {
    opacity: 0;
    transform: translateY(-8px);
}

/* English comment. */
.saturation-panel {
    position: relative;
    width: 100%;
    height: 160px;
    border-radius: var(--border-radius-sm);
    overflow: hidden;
}

.saturation-canvas {
    position: relative;
    width: 100%;
    height: 100%;
    cursor: crosshair;
}

.saturation-white {
    position: absolute;
    inset: 0;
    background: linear-gradient(to right, #fff, transparent);
}

.saturation-black {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, #000, transparent);
}

.saturation-cursor {
    position: absolute;
    width: 14px;
    height: 14px;
    border: 2px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.3);
    transform: translate(-50%, -50%);
    pointer-events: none;
}

/* English comment. */
.hue-slider {
    padding: 0.25rem 0;
}

.hue-track {
    position: relative;
    width: 100%;
    height: 12px;
    border-radius: 6px;
    background: linear-gradient(to right,
        #ff0000 0%,
        #ffff00 17%,
        #00ff00 33%,
        #00ffff 50%,
        #0000ff 67%,
        #ff00ff 83%,
        #ff0000 100%
    );
    cursor: pointer;
}

.hue-cursor {
    position: absolute;
    top: 50%;
    width: 14px;
    height: 14px;
    background: #fff;
    border: 2px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.3);
    transform: translate(-50%, -50%);
    pointer-events: none;
}

/* English comment. */
.color-info {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
}

.preview-section {
    flex-shrink: 0;
}

.preview-colors {
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-radius: var(--border-radius-sm);
    overflow: hidden;
    border: 1px solid var(--color-border);
}

.preview-current,
.preview-original {
    position: relative;
    width: 36px;
    height: 24px;
    cursor: pointer;
}

.preview-original {
    opacity: 0.7;
}

.preview-original:hover {
    opacity: 1;
}

.input-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.input-group {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
}

.input-group label {
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--color-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.input-group.small {
    flex: 1;
}

.hex-input {
    width: 100%;
    padding: 0.375rem 0.5rem;
    font-family: monospace;
    font-size: 0.8125rem;
    background-color: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    color: var(--color-text-primary);
    text-transform: uppercase;
    transition: all var(--transition-fast);
}

.hex-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(0, 212, 255, 0.2);
}

.rgb-inputs {
    display: flex;
    gap: 0.375rem;
}

.rgb-input {
    width: 100%;
    padding: 0.375rem 0.25rem;
    font-family: monospace;
    font-size: 0.75rem;
    text-align: center;
    background-color: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    color: var(--color-text-primary);
    transition: all var(--transition-fast);
    appearance: textfield;
    -moz-appearance: textfield;
}

.rgb-input::-webkit-outer-spin-button,
.rgb-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

.rgb-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(0, 212, 255, 0.2);
}

/* English comment. */
.preset-colors,
.recent-colors {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}

.preset-title {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.preset-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 4px;
}

.preset-color {
    position: relative;
    aspect-ratio: 1;
    border-radius: 3px;
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
    transition: all var(--transition-fast);
}

.preset-color:hover {
    transform: scale(1.15);
    z-index: 1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.preset-check {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.625rem;
    font-weight: bold;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
</style>
