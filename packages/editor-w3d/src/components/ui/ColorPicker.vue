<template>
    <div ref="rootRef" class="color-picker-wrapper">
        <label v-if="label" class="color-picker-label">
            {{ label }}
        </label>

        <div class="color-picker-trigger-row">
            <button
                ref="triggerRef"
                type="button"
                class="color-picker-trigger"
                :class="{ 'is-open': isOpen, 'is-disabled': disabled }"
                :disabled="disabled"
                @click="togglePopover"
            >
                <span class="color-preview-checker"></span>
                <span class="color-preview-fill" :style="{ background: previewColor }"></span>
            </button>

            <input
                :value="displayValue"
                :disabled="disabled"
                class="color-text-input"
                placeholder="#2563eb"
                @focus="openPopover"
                @input="handleTextInput"
                @blur="handleInputBlur"
            />

            <input
                ref="nativeInputRef"
                type="color"
                :value="hexValue"
                class="native-color-input"
                :disabled="disabled"
                @input="handleNativeInput"
                @change="handleNativeChange"
            />
        </div>

        <Teleport to="body">
            <div
                v-if="isOpen"
                ref="popoverRef"
                class="color-picker-popover"
                :class="`is-${popoverPlacement}`"
                :style="popoverStyle"
            >
                <div
                    ref="spectrumRef"
                    class="color-spectrum"
                    :style="{ background: spectrumBackground }"
                    @mousedown.prevent="startSpectrumDrag"
                >
                    <div class="color-spectrum__white"></div>
                    <div class="color-spectrum__black"></div>
                    <div
                        class="color-spectrum__thumb"
                        :style="{ left: `${saturation * 100}%`, top: `${(1 - brightness) * 100}%` }"
                    ></div>
                </div>

                <div class="color-sliders">
                    <div class="color-slider-row">
                        <span class="color-slider-label">H</span>
                        <input
                            v-model.number="hue"
                            type="range"
                            min="0"
                            max="360"
                            step="1"
                            class="color-slider color-slider--hue"
                        />
                    </div>
                    <div class="color-slider-row">
                        <span class="color-slider-label">A</span>
                        <input
                            v-model.number="alpha"
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            class="color-slider color-slider--alpha"
                            :style="{ '--alpha-color': rgbString }"
                        />
                    </div>
                </div>

                <div class="color-picker-toolbar">
                    <div class="color-picker-meta">
                        <div class="color-picker-chip">
                            <span class="color-preview-checker"></span>
                            <span class="color-preview-fill" :style="{ background: previewColor }"></span>
                        </div>
                        <div class="color-picker-values">
                            <strong>{{ formatMode.toUpperCase() }}</strong>
                            <span>{{ rgbaLabel }}</span>
                        </div>
                    </div>

                    <div class="color-picker-actions">
                        <button
                            type="button"
                            class="picker-link"
                            :disabled="disabled || !supportsEyeDropper"
                            @click="pickFromScreen"
                        >
                            吸管取色
                        </button>
                        <button
                            type="button"
                            class="picker-link"
                            :disabled="disabled"
                            @click="openNativePicker"
                        >
                            手动选择
                        </button>
                    </div>
                </div>

                <div class="format-toggle">
                    <button
                        v-for="format in formatOptions"
                        :key="format"
                        type="button"
                        class="format-toggle__button"
                        :class="{ 'is-active': formatMode === format }"
                        @click="setFormatMode(format)"
                    >
                        {{ format.toUpperCase() }}
                    </button>
                </div>

                <input
                    :value="draftValue"
                    class="color-value-input"
                    :disabled="disabled"
                    @input="handlePanelInput"
                    @blur="handlePanelBlur"
                />

                <div v-if="inputError" class="color-error">
                    {{ inputError }}
                </div>

                <div class="swatch-section">
                    <div class="swatch-section__header">
                        <span>预设色板</span>
                        <span>{{ presets.length }} 色</span>
                    </div>

                    <div class="swatch-grid">
                        <button
                            v-for="preset in presets"
                            :key="preset"
                            type="button"
                            class="swatch-button"
                            :class="{ 'is-active': isPresetActive(preset) }"
                            :style="{ background: normalizePreset(preset) }"
                            @click="applyPreset(preset)"
                        ></button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps({
    modelValue: {
        type: String,
        default: '#000000'
    },
    label: {
        type: String,
        default: ''
    },
    disabled: {
        type: Boolean,
        default: false
    },
    presets: {
        type: Array,
        default: () => ([
            '#ffffff', '#d1d5db', '#94a3b8', '#111827',
            '#000000', '#2563eb', '#06b6d4', '#14b8a6',
            '#22c55e', '#84cc16', '#eab308', '#f97316',
            '#ef4444', '#ec4899', '#a855f7', '#8b5cf6'
        ])
    }
});

const emit = defineEmits(['update:modelValue', 'change']);

const formatOptions = ['hex', 'rgb', 'hsl'];
const POPOVER_WIDTH = 320;
const VIEWPORT_MARGIN = 12;

const rootRef = ref(null);
const triggerRef = ref(null);
const popoverRef = ref(null);
const spectrumRef = ref(null);
const nativeInputRef = ref(null);

const isOpen = ref(false);
const isDraggingSpectrum = ref(false);
const formatMode = ref('hex');
const draftValue = ref(props.modelValue || '#000000');
const inputError = ref('');
const popoverPlacement = ref('bottom');
const popoverStyle = ref({
    top: '0px',
    left: '0px',
    width: `${POPOVER_WIDTH}px`
});

const supportsEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

const hsv = ref({ h: 217, s: 0.83, v: 0.92, a: 1 });

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, digits = 2) => Number(value.toFixed(digits));
const toHex = (value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
const normalizeAlpha = (value) => round(clamp(Number(value), 0, 1), 2);

const rgbToHsv = ({ r, g, b }) => {
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;
    let h = 0;

    if (delta) {
        if (max === red) h = ((green - blue) / delta) % 6;
        else if (max === green) h = (blue - red) / delta + 2;
        else h = (red - green) / delta + 4;
    }

    return {
        h: Math.round((h * 60 + 360) % 360),
        s: max === 0 ? 0 : delta / max,
        v: max
    };
};

const hsvToRgb = ({ h, s, v }) => {
    const hue = ((h % 360) + 360) % 360;
    const chroma = v * s;
    const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
    const m = v - chroma;

    let red = 0;
    let green = 0;
    let blue = 0;

    if (hue < 60) {
        red = chroma; green = x;
    } else if (hue < 120) {
        red = x; green = chroma;
    } else if (hue < 180) {
        green = chroma; blue = x;
    } else if (hue < 240) {
        green = x; blue = chroma;
    } else if (hue < 300) {
        red = x; blue = chroma;
    } else {
        red = chroma; blue = x;
    }

    return {
        r: Math.round((red + m) * 255),
        g: Math.round((green + m) * 255),
        b: Math.round((blue + m) * 255)
    };
};

const hslToRgb = ({ h, s, l }) => {
    const hue = ((h % 360) + 360) % 360;
    const saturation = clamp(s, 0, 100) / 100;
    const lightness = clamp(l, 0, 100) / 100;
    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
    const m = lightness - chroma / 2;

    let red = 0;
    let green = 0;
    let blue = 0;

    if (hue < 60) {
        red = chroma; green = x;
    } else if (hue < 120) {
        red = x; green = chroma;
    } else if (hue < 180) {
        green = chroma; blue = x;
    } else if (hue < 240) {
        green = x; blue = chroma;
    } else if (hue < 300) {
        red = x; blue = chroma;
    } else {
        red = chroma; blue = x;
    }

    return {
        r: Math.round((red + m) * 255),
        g: Math.round((green + m) * 255),
        b: Math.round((blue + m) * 255)
    };
};

const rgbToHsl = ({ r, g, b }) => {
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;
    const lightness = (max + min) / 2;

    let hue = 0;
    let saturation = 0;

    if (delta) {
        saturation = delta / (1 - Math.abs(2 * lightness - 1));
        if (max === red) hue = ((green - blue) / delta) % 6;
        else if (max === green) hue = (blue - red) / delta + 2;
        else hue = (red - green) / delta + 4;
    }

    return {
        h: Math.round((hue * 60 + 360) % 360),
        s: Math.round(saturation * 100),
        l: Math.round(lightness * 100)
    };
};

const parseRgbChannel = (value) => {
    const text = value.trim();
    if (text.endsWith('%')) return clamp((parseFloat(text) / 100) * 255, 0, 255);
    return clamp(parseFloat(text), 0, 255);
};

const parseAlphaChannel = (value) => {
    const text = value.trim();
    if (text.endsWith('%')) return clamp(parseFloat(text) / 100, 0, 1);
    return clamp(parseFloat(text), 0, 1);
};

const parseColor = (value) => {
    if (!value || typeof value !== 'string') return null;

    const input = value.trim();
    if (!input) return null;

    const hexMatch = input.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (hexMatch) {
        let hex = hexMatch[1];
        if (hex.length === 3 || hex.length === 4) {
            hex = hex.split('').map((char) => char + char).join('');
        }

        return {
            r: parseInt(hex.slice(0, 2), 16),
            g: parseInt(hex.slice(2, 4), 16),
            b: parseInt(hex.slice(4, 6), 16),
            a: hex.length === 8 ? normalizeAlpha(parseInt(hex.slice(6, 8), 16) / 255) : 1,
            format: 'hex'
        };
    }

    const rgbMatch = input.match(/^rgba?\((.+)\)$/i);
    if (rgbMatch) {
        const parts = rgbMatch[1].split(',').map((part) => part.trim());
        if (parts.length === 3 || parts.length === 4) {
            return {
                r: Math.round(parseRgbChannel(parts[0])),
                g: Math.round(parseRgbChannel(parts[1])),
                b: Math.round(parseRgbChannel(parts[2])),
                a: normalizeAlpha(parseAlphaChannel(parts[3] ?? '1')),
                format: 'rgb'
            };
        }
    }

    const hslMatch = input.match(/^hsla?\((.+)\)$/i);
    if (hslMatch) {
        const parts = hslMatch[1].split(',').map((part) => part.trim());
        if (parts.length === 3 || parts.length === 4) {
            const rgb = hslToRgb({
                h: parseFloat(parts[0]),
                s: parseFloat(parts[1]),
                l: parseFloat(parts[2])
            });

            return {
                ...rgb,
                a: normalizeAlpha(parseAlphaChannel(parts[3] ?? '1')),
                format: 'hsl'
            };
        }
    }

    return null;
};

const formatColor = (color, format = formatMode.value) => {
    const alphaValue = normalizeAlpha(color.a);

    if (format === 'rgb') {
        return alphaValue < 1
            ? `rgba(${color.r}, ${color.g}, ${color.b}, ${alphaValue})`
            : `rgb(${color.r}, ${color.g}, ${color.b})`;
    }

    if (format === 'hsl') {
        const hsl = rgbToHsl(color);
        return alphaValue < 1
            ? `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${alphaValue})`
            : `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    }

    const alphaHex = alphaValue < 1 ? toHex(alphaValue * 255) : '';
    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}${alphaHex}`;
};

const syncFromColor = (color, preferredFormat = color.format || formatMode.value) => {
    const nextHsv = rgbToHsv(color);
    hsv.value = {
        h: nextHsv.h,
        s: nextHsv.s,
        v: nextHsv.v,
        a: normalizeAlpha(color.a ?? 1)
    };
    formatMode.value = preferredFormat === 'rgb' || preferredFormat === 'hsl' ? preferredFormat : 'hex';
    draftValue.value = formatColor({ ...color, a: hsv.value.a }, formatMode.value);
    inputError.value = '';
};

watch(
    () => props.modelValue,
    (value) => {
        const parsed = parseColor(value) || parseColor('#2563eb');
        syncFromColor(parsed, parsed?.format || formatMode.value);
    },
    { immediate: true }
);

const currentColor = computed(() => ({
    ...hsvToRgb(hsv.value),
    a: normalizeAlpha(hsv.value.a)
}));

const hue = computed({
    get: () => hsv.value.h,
    set: (value) => {
        hsv.value.h = clamp(Number(value), 0, 360);
        syncDraftFromCurrent();
    }
});

const saturation = computed(() => hsv.value.s);
const brightness = computed(() => hsv.value.v);
const alpha = computed({
    get: () => hsv.value.a,
    set: (next) => {
        hsv.value.a = normalizeAlpha(next);
        syncDraftFromCurrent();
    }
});

const hexValue = computed(() => formatColor(currentColor.value, 'hex').slice(0, 7));
const rgbString = computed(() => `rgb(${currentColor.value.r}, ${currentColor.value.g}, ${currentColor.value.b})`);
const previewColor = computed(() => formatColor(currentColor.value, 'rgb'));
const displayValue = computed(() => draftValue.value);
const rgbaLabel = computed(() => `${currentColor.value.r}, ${currentColor.value.g}, ${currentColor.value.b}, ${normalizeAlpha(currentColor.value.a)}`);
const spectrumBackground = computed(() => `hsl(${hsv.value.h} 100% 50%)`);

const updatePopoverPosition = async () => {
    if (!isOpen.value || !triggerRef.value) return;

    await nextTick();

    const triggerRect = triggerRef.value.getBoundingClientRect();
    const popoverRect = popoverRef.value?.getBoundingClientRect();
    const popoverWidth = popoverRect?.width || POPOVER_WIDTH;
    const popoverHeight = popoverRect?.height || 0;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = triggerRect.left;
    if (left + popoverWidth > viewportWidth - VIEWPORT_MARGIN) {
        left = viewportWidth - popoverWidth - VIEWPORT_MARGIN;
    }
    left = Math.max(VIEWPORT_MARGIN, left);

    let top = triggerRect.bottom + 8;
    if (top + popoverHeight > viewportHeight - VIEWPORT_MARGIN) {
        top = triggerRect.top - popoverHeight - 8;
    }
    top = Math.max(VIEWPORT_MARGIN, top);

    popoverPlacement.value = top < triggerRect.top ? 'top' : 'bottom';
    popoverStyle.value = {
        top: `${Math.round(top + window.scrollY)}px`,
        left: `${Math.round(left + window.scrollX)}px`,
        width: `${POPOVER_WIDTH}px`
    };
};

const emitColor = (shouldEmitChange = false) => {
    const nextValue = formatColor(currentColor.value, formatMode.value);
    draftValue.value = nextValue;
    emit('update:modelValue', nextValue);
    if (shouldEmitChange) emit('change', nextValue);
};

const syncDraftFromCurrent = () => {
    draftValue.value = formatColor(currentColor.value, formatMode.value);
    emit('update:modelValue', draftValue.value);
};

const normalizePreset = (preset) => formatColor(parseColor(preset) || currentColor.value, 'rgb');
const isPresetActive = (preset) => {
    const parsed = parseColor(preset);
    return parsed && formatColor(parsed, 'hex') === formatColor(currentColor.value, 'hex');
};

const applyPreset = (preset) => {
    const parsed = parseColor(preset);
    if (!parsed) return;
    syncFromColor(parsed, formatMode.value);
    emitColor(true);
};

const setFormatMode = (format) => {
    formatMode.value = format;
    draftValue.value = formatColor(currentColor.value, formatMode.value);
    emit('update:modelValue', draftValue.value);
};

const openPopover = async () => {
    if (props.disabled) return;
    isOpen.value = true;
    await updatePopoverPosition();
};

const togglePopover = async () => {
    if (props.disabled) return;
    isOpen.value = !isOpen.value;
    if (isOpen.value) {
        await updatePopoverPosition();
    }
};

const closePopover = () => {
    isOpen.value = false;
};

const updateSpectrumFromEvent = (event) => {
    const rect = spectrumRef.value?.getBoundingClientRect();
    if (!rect) return;

    hsv.value.s = round(clamp((event.clientX - rect.left) / rect.width, 0, 1), 3);
    hsv.value.v = round(clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1), 3);
    syncDraftFromCurrent();
};

const handleWindowMouseMove = (event) => {
    if (!isDraggingSpectrum.value) return;
    updateSpectrumFromEvent(event);
};

const stopSpectrumDrag = () => {
    if (!isDraggingSpectrum.value) return;
    isDraggingSpectrum.value = false;
    emitColor(true);
    window.removeEventListener('mousemove', handleWindowMouseMove);
    window.removeEventListener('mouseup', stopSpectrumDrag);
};

const startSpectrumDrag = (event) => {
    if (props.disabled) return;
    isDraggingSpectrum.value = true;
    updateSpectrumFromEvent(event);
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', stopSpectrumDrag);
};

const handleNativeInput = (event) => {
    const parsed = parseColor(event.target.value);
    if (!parsed) return;
    syncFromColor({ ...parsed, a: currentColor.value.a }, formatMode.value);
    emit('update:modelValue', draftValue.value);
};

const handleNativeChange = (event) => {
    const parsed = parseColor(event.target.value);
    if (!parsed) return;
    syncFromColor({ ...parsed, a: currentColor.value.a }, formatMode.value);
    emitColor(true);
};

const handleTextInput = (event) => {
    draftValue.value = event.target.value;
    const parsed = parseColor(draftValue.value);
    if (parsed) {
        inputError.value = '';
        syncFromColor(parsed, parsed.format || formatMode.value);
        emit('update:modelValue', draftValue.value);
    } else {
        inputError.value = '支持 HEX / RGB(A) / HSL(A)';
    }
};

const handlePanelInput = (event) => {
    draftValue.value = event.target.value;
    const parsed = parseColor(draftValue.value);
    if (parsed) {
        inputError.value = '';
        syncFromColor(parsed, parsed.format || formatMode.value);
        emit('update:modelValue', draftValue.value);
    } else {
        inputError.value = '支持 HEX / RGB(A) / HSL(A)';
    }
};

const handleInputBlur = () => {
    const parsed = parseColor(draftValue.value);
    if (!parsed) {
        draftValue.value = formatColor(currentColor.value, formatMode.value);
        inputError.value = '';
        return;
    }
    emitColor(true);
};

const handlePanelBlur = () => {
    const parsed = parseColor(draftValue.value);
    if (!parsed) {
        draftValue.value = formatColor(currentColor.value, formatMode.value);
        inputError.value = '';
        return;
    }
    syncFromColor(parsed, parsed.format || formatMode.value);
    emitColor(true);
};

const handleDocumentMouseDown = (event) => {
    if (rootRef.value?.contains(event.target) || popoverRef.value?.contains(event.target)) return;
    closePopover();
};

const handleKeydown = (event) => {
    if (event.key === 'Escape') {
        closePopover();
    }
};

const openNativePicker = () => {
    if (props.disabled) return;
    nativeInputRef.value?.click();
};

const pickFromScreen = async () => {
    if (props.disabled || !supportsEyeDropper) return;

    try {
        closePopover();
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        const parsed = parseColor(result.sRGBHex);
        if (!parsed) return;
        syncFromColor(parsed, 'hex');
        emitColor(true);
    } catch (error) {
        if (error?.name !== 'AbortError') {
            inputError.value = '当前浏览器不支持或取色失败';
            await openPopover();
        }
    }
};

watch(isOpen, async (open) => {
    if (open) {
        document.addEventListener('mousedown', handleDocumentMouseDown);
        document.addEventListener('keydown', handleKeydown);
        window.addEventListener('resize', updatePopoverPosition);
        window.addEventListener('scroll', updatePopoverPosition, true);
        await updatePopoverPosition();
    } else {
        document.removeEventListener('mousedown', handleDocumentMouseDown);
        document.removeEventListener('keydown', handleKeydown);
        window.removeEventListener('resize', updatePopoverPosition);
        window.removeEventListener('scroll', updatePopoverPosition, true);
    }
});

onBeforeUnmount(() => {
    document.removeEventListener('mousedown', handleDocumentMouseDown);
    document.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('resize', updatePopoverPosition);
    window.removeEventListener('scroll', updatePopoverPosition, true);
    window.removeEventListener('mousemove', handleWindowMouseMove);
    window.removeEventListener('mouseup', stopSpectrumDrag);
});
</script>

<style scoped>
.color-picker-wrapper {
    position: relative;
    width: 100%;
}

.color-picker-label {
    display: block;
    margin-bottom: var(--space-1);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
}

.color-picker-trigger-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.color-picker-trigger {
    position: relative;
    width: 36px;
    height: 36px;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    background: var(--color-bg-secondary);
    cursor: pointer;
    flex-shrink: 0;
}

.color-picker-trigger.is-open {
    border-color: var(--color-primary);
}

.color-picker-trigger.is-disabled {
    cursor: not-allowed;
    opacity: 0.6;
}

.color-preview-checker,
.color-preview-fill {
    position: absolute;
    inset: 0;
}

.color-preview-checker {
    background-image:
        linear-gradient(45deg, rgba(148, 163, 184, 0.2) 25%, transparent 25%),
        linear-gradient(-45deg, rgba(148, 163, 184, 0.2) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, rgba(148, 163, 184, 0.2) 75%),
        linear-gradient(-45deg, transparent 75%, rgba(148, 163, 184, 0.2) 75%);
    background-size: 12px 12px;
    background-position: 0 0, 0 6px, 6px -6px, -6px 0;
}

.color-text-input,
.color-value-input {
    width: 100%;
    height: 36px;
    padding: 0 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    font-family: var(--font-family-mono);
    font-size: var(--font-size-sm);
}

.color-text-input:focus,
.color-value-input:focus {
    outline: none;
    border-color: var(--color-primary);
}

.native-color-input {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
    pointer-events: none;
}

.color-picker-popover {
    position: absolute;
    z-index: 9999;
    padding: 0.875rem;
    border: 1px solid var(--color-border);
    border-radius: 14px;
    background: var(--color-bg-elevated, #1f2937);
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.28);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.color-picker-popover::before {
    content: '';
    position: absolute;
    left: 18px;
    width: 12px;
    height: 12px;
    background: var(--color-bg-elevated, #1f2937);
    border-left: 1px solid var(--color-border);
    border-top: 1px solid var(--color-border);
}

.color-picker-popover.is-bottom::before {
    top: -7px;
    transform: rotate(45deg);
}

.color-picker-popover.is-top::before {
    bottom: -7px;
    transform: rotate(225deg);
}

.color-spectrum {
    position: relative;
    height: 168px;
    border-radius: 12px;
    overflow: hidden;
    cursor: crosshair;
}

.color-spectrum__white,
.color-spectrum__black {
    position: absolute;
    inset: 0;
}

.color-spectrum__white {
    background: linear-gradient(90deg, #fff, rgba(255, 255, 255, 0));
}

.color-spectrum__black {
    background: linear-gradient(0deg, #000, rgba(0, 0, 0, 0));
}

.color-spectrum__thumb {
    position: absolute;
    width: 14px;
    height: 14px;
    border: 2px solid #fff;
    border-radius: 999px;
    box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.4);
    transform: translate(-50%, -50%);
}

.color-sliders {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.color-slider-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.color-slider-label {
    width: 16px;
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
    flex-shrink: 0;
}

.color-slider {
    flex: 1;
    margin: 0;
}

.color-slider--alpha {
    accent-color: var(--alpha-color, #2563eb);
}

.color-picker-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
}

.color-picker-meta {
    display: flex;
    align-items: center;
    gap: 0.625rem;
}

.color-picker-chip {
    position: relative;
    width: 28px;
    height: 28px;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    flex-shrink: 0;
}

.color-picker-values {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
}

.color-picker-values strong {
    color: var(--color-text-primary);
    font-size: 0.75rem;
}

.color-picker-values span {
    color: var(--color-text-secondary);
    font-size: 0.75rem;
}

.color-picker-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.picker-link {
    border: 0;
    background: transparent;
    color: var(--color-primary);
    cursor: pointer;
    font-size: 0.75rem;
}

.picker-link:disabled {
    color: var(--color-text-tertiary);
    cursor: not-allowed;
}

.format-toggle {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
}

.format-toggle__button {
    height: 30px;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 0.75rem;
}

.format-toggle__button.is-active {
    border-color: var(--color-primary);
    background: rgba(37, 99, 235, 0.12);
    color: var(--color-primary);
}

.color-error {
    color: var(--color-error, #ef4444);
    font-size: 0.75rem;
}

.swatch-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.swatch-section__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--color-text-secondary);
    font-size: 0.75rem;
}

.swatch-grid {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    gap: 0.375rem;
}

.swatch-button {
    height: 22px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    cursor: pointer;
}

.swatch-button.is-active {
    outline: 2px solid var(--color-primary);
    outline-offset: 1px;
}
</style>
