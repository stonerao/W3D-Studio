import { onBeforeUnmount, ref, watch } from 'vue';
import { useComponentStore } from '../stores/useComponentStore';

const normalizeText = (value, fallback = '') => {
    const text = value === null || value === undefined ? '' : String(value).trim();
    return text || fallback;
};

const firstText = (...values) => {
    for (const value of values) {
        const text = normalizeText(value);
        if (text) return text;
    }
    return '';
};

const normalizeVideoFormat = (value, fallback = 'hls') => {
    const format = normalizeText(value, fallback).toLowerCase();
    return format === 'm3u8' ? 'hls' : format;
};

const inferVideoFormatFromUrl = (value) => {
    const url = normalizeText(value);
    if (!url) return '';

    const lowerUrl = url.toLowerCase();
    if (lowerUrl.startsWith('rtsp://')) return 'rtsp';
    if (lowerUrl.startsWith('rtmp://')) return 'rtmp';
    if (lowerUrl.startsWith('webrtc://')) return 'webrtc';

    try {
        const base = typeof window !== 'undefined' ? window.location.href : 'http://localhost/';
        const pathname = new URL(url, base).pathname.toLowerCase();
        if (pathname.endsWith('.m3u8')) return 'hls';
        if (pathname.endsWith('.mp4')) return 'mp4';
        if (pathname.endsWith('.flv')) return 'flv';
        if (pathname.endsWith('.webm')) return 'webm';
        if (pathname.endsWith('.ogg') || pathname.endsWith('.ogv')) return 'ogg';
    } catch {
        const path = lowerUrl.split(/[?#]/)[0] || '';
        if (path.endsWith('.m3u8')) return 'hls';
        if (path.endsWith('.mp4')) return 'mp4';
        if (path.endsWith('.flv')) return 'flv';
        if (path.endsWith('.webm')) return 'webm';
        if (path.endsWith('.ogg') || path.endsWith('.ogv')) return 'ogg';
    }

    return '';
};

const resolveVideoFormat = (value, url) => {
    const configured = normalizeVideoFormat(value, '');
    const inferred = inferVideoFormatFromUrl(url);
    if (inferred && (!configured || configured === 'hls')) return inferred;
    return configured || inferred || 'hls';
};

const normalizeVideoInfo = (value) => {
    if (!Array.isArray(value)) return [];
    return value.map((item, index) => {
        if (item && typeof item === 'object') {
            const label = normalizeText(item.label ?? item.name ?? item.key);
            const itemValue = normalizeText(item.value ?? item.text ?? item.content);
            if (!label && !itemValue) return null;
            return {
                label: label || `信息${index + 1}`,
                value: itemValue
            };
        }
        const itemValue = normalizeText(item);
        if (!itemValue) return null;
        return {
            label: `信息${index + 1}`,
            value: itemValue
        };
    }).filter(Boolean).filter((item) => item.label || item.value);
};

const normalizeEventConfig = (value = {}) => {
    const source = value && typeof value === 'object' ? value : {};
    return {
        click: {
            enabled: source.click?.enabled !== false,
            action: normalizeText(source.click?.action, 'openVideo')
        },
        dblclick: {
            enabled: source.dblclick?.enabled === true,
            action: normalizeText(source.dblclick?.action, 'openVideo')
        }
    };
};

const normalizeModalStyle = (value = {}) => {
    const source = value && typeof value === 'object' ? value : {};
    const preset = normalizeText(source.preset, 'dark');
    const placement = normalizeText(source.placement, 'center');
    const toNumber = (input, fallback = 0) => {
        const n = Number(input);
        return Number.isFinite(n) ? n : fallback;
    };
    return {
        preset: ['dark', 'light', 'glass', 'security'].includes(preset) ? preset : 'dark',
        placement: ['center', 'cursor', 'fixed'].includes(placement) ? placement : 'center',
        left: Math.max(0, Math.round(toNumber(source.left, 120))),
        top: Math.max(0, Math.round(toNumber(source.top, 120))),
        width: Math.max(320, Math.round(toNumber(source.width, 920))),
        height: Math.max(0, Math.round(toNumber(source.height, 0)))
    };
};

const normalizePointer = (event) => {
    const x = Number(event?.clientX);
    const y = Number(event?.clientY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return {
        x: Math.round(x),
        y: Math.round(y)
    };
};

export function useCameraPointRuntime() {
    const componentStore = useComponentStore();
    const modalState = ref({
        visible: false,
        componentId: '',
        pointId: '',
        pointName: '',
        title: '',
        url: '',
        format: 'hls',
        vendor: 'generic',
        videoInfo: [],
        modalStyle: normalizeModalStyle(),
        pointer: null,
        poster: '',
        autoplay: true,
        muted: false,
        controls: true
    });
    const listenerMap = new Map();

    const closeModal = () => {
        modalState.value = {
            visible: false,
            componentId: '',
            pointId: '',
            pointName: '',
            title: '',
            url: '',
            format: 'hls',
            vendor: 'generic',
            videoInfo: [],
            modalStyle: normalizeModalStyle(),
            pointer: null,
            poster: '',
            autoplay: true,
            muted: false,
            controls: true
        };
    };

    const openModal = (payload = {}, componentId = '', modalStyle = {}) => {
        const point = payload?.point || {};
        const video = point?.video || payload?.video || {};
        const url = firstText(point?.videoUrl, payload?.videoUrl, video?.url);
        if (!url) return;

        modalState.value = {
            visible: true,
            componentId,
            pointId: normalizeText(payload?.pointId || point?.id),
            pointName: normalizeText(point?.name),
            title: normalizeText(video?.title || point?.name),
            url,
            format: resolveVideoFormat(firstText(point?.videoFormat, payload?.videoFormat, video?.format), url),
            vendor: firstText(point?.vendor, payload?.vendor) || 'generic',
            videoInfo: normalizeVideoInfo(point?.videoInfo || payload?.videoInfo),
            modalStyle: normalizeModalStyle(modalStyle),
            pointer: normalizePointer(payload?.rawEvent),
            poster: normalizeText(video?.poster),
            autoplay: video?.autoplay !== false,
            muted: video?.muted === true,
            controls: video?.controls !== false
        };
    };

    const shouldOpenForTrigger = (component, trigger) => {
        const eventConfig = normalizeEventConfig(component?.config?.eventConfig);
        const target = trigger === 'dblclick' ? eventConfig.dblclick : eventConfig.click;
        return target.enabled === true && target.action === 'openVideo';
    };

    const getRuntimeComponent = (componentId, fallback = null) => {
        return (componentStore.components || []).find((item) => item.id === componentId) || fallback;
    };

    const openForTrigger = (payload, component, trigger) => {
        const latestComponent = getRuntimeComponent(component.id, component);
        if (!shouldOpenForTrigger(latestComponent, trigger)) return;
        openModal(payload, latestComponent.id, latestComponent?.config?.videoModalStyle);
    };

    const cleanupListenerRecord = (record) => {
        if (!record) return;
        clearTimeout(record.clickTimer);
        record.instance?.off?.('cameraPointClick', record.clickHandler);
        record.instance?.off?.('cameraPointDblClick', record.dblclickHandler);
    };

    const syncListeners = () => {
        const nextIds = new Set();

        (componentStore.components || []).forEach((component) => {
            if (component?.type !== 'CameraPointManager' || !component?.instance?.on) return;
            nextIds.add(component.id);
            const existing = listenerMap.get(component.id);
            if (existing?.instance === component.instance) return;
            if (existing) {
                cleanupListenerRecord(existing);
                listenerMap.delete(component.id);
            }

            const clickHandler = (payload) => {
                const record = listenerMap.get(component.id);
                const latestComponent = getRuntimeComponent(component.id, component);
                const eventConfig = normalizeEventConfig(latestComponent?.config?.eventConfig);
                if (eventConfig.dblclick.enabled) {
                    if (!record) {
                        openForTrigger(payload, latestComponent, 'click');
                        return;
                    }
                    clearTimeout(record?.clickTimer);
                    record.clickTimer = setTimeout(() => {
                        record.clickTimer = null;
                        openForTrigger(payload, latestComponent, 'click');
                    }, 240);
                    return;
                }
                openForTrigger(payload, latestComponent, 'click');
            };
            const dblclickHandler = (payload) => {
                const record = listenerMap.get(component.id);
                clearTimeout(record?.clickTimer);
                if (record) record.clickTimer = null;
                openForTrigger(payload, getRuntimeComponent(component.id, component), 'dblclick');
            };
            component.instance.on('cameraPointClick', clickHandler);
            component.instance.on('cameraPointDblClick', dblclickHandler);
            listenerMap.set(component.id, {
                instance: component.instance,
                clickHandler,
                dblclickHandler,
                clickTimer: null
            });
        });

        Array.from(listenerMap.entries()).forEach(([componentId, record]) => {
            if (nextIds.has(componentId)) return;
            cleanupListenerRecord(record);
            listenerMap.delete(componentId);
            if (modalState.value.visible && modalState.value.componentId === componentId) {
                closeModal();
            }
        });
    };

    watch(
        () => componentStore.serialVersion,
        () => syncListeners(),
        { immediate: true }
    );

    onBeforeUnmount(() => {
        Array.from(listenerMap.values()).forEach((record) => {
            cleanupListenerRecord(record);
        });
        listenerMap.clear();
    });

    return {
        modalState,
        closeModal,
        syncListeners
    };
}
