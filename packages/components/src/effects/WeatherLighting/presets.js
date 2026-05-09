export const WEATHER_PRESETS = [
    { key: 'clear', label: '晴天' },
    { key: 'rainLight', label: '小雨' },
    { key: 'rainHeavy', label: '大雨' },
    { key: 'snow', label: '雪' },
    { key: 'fog', label: '雾（占位）' },
    { key: 'cloudy', label: '多云（占位）' }
];

export const TIME_PRESETS = [
    { key: 'dawn', label: '清晨' },
    { key: 'noon', label: '正午' },
    { key: 'dusk', label: '傍晚' },
    { key: 'night', label: '夜晚' }
];

export function getLightingPreset(timePreset) {
    switch (timePreset) {
        case 'dawn':
            return {
                ambient: { color: '#ffffff', intensity: 0.35 },
                sun: { color: '#ffd7a6', intensity: 0.9 }
            };
        case 'noon':
            return {
                ambient: { color: '#ffffff', intensity: 0.45 },
                sun: { color: '#ffffff', intensity: 1.2 }
            };
        case 'dusk':
            return {
                ambient: { color: '#ffffff', intensity: 0.30 },
                sun: { color: '#ffbf8a', intensity: 0.75 }
            };
        case 'night':
            return {
                ambient: { color: '#cfe7ff', intensity: 0.18 },
                sun: { color: '#cfe7ff', intensity: 0.06 }
            };
        default:
            return {
                ambient: { color: '#ffffff', intensity: 0.4 },
                sun: { color: '#ffffff', intensity: 1.0 }
            };
    }
}
