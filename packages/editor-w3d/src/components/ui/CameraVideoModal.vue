<template>
    <Teleport to="body">
        <div v-if="state.visible" class="camera-video-modal" :class="modalStyleClass">
            <div class="camera-video-modal__backdrop" @click="emit('close')"></div>
            <div ref="panelRef" class="camera-video-modal__panel" :style="panelStyle">
                <div class="camera-video-modal__header" @pointerdown="startDrag">
                    <div>
                        <div class="camera-video-modal__eyebrow">摄像头视频</div>
                        <div class="camera-video-modal__title">{{ titleText }}</div>
                    </div>
                    <button
                        type="button"
                        class="camera-video-modal__close"
                        @pointerdown.stop
                        @click="emit('close')"
                    >
                        ×
                    </button>
                </div>
                <div class="camera-video-modal__body">
                    <div class="camera-video-modal__meta">
                        <span>格式：{{ formatText }}</span>
                        <span>厂商：{{ vendorText }}</span>
                    </div>
                    <div v-if="errorMessage" class="camera-video-modal__error">{{ errorMessage }}</div>
                    <video
                        ref="videoRef"
                        class="camera-video-modal__video"
                        :poster="state.poster || ''"
                        :controls="state.controls !== false"
                        :autoplay="state.autoplay !== false"
                        :muted="state.muted === true"
                        :style="videoStyle"
                        playsinline
                    ></video>
                    <div v-if="videoInfo.length" class="camera-video-modal__info">
                        <div
                            v-for="(item, index) in videoInfo"
                            :key="index"
                            class="camera-video-modal__info-item"
                        >
                            <span>{{ item.label }}</span>
                            <strong>{{ item.value }}</strong>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps({
    state: {
        type: Object,
        default: () => ({ visible: false })
    }
});

const emit = defineEmits(['close']);

const videoRef = ref(null);
const panelRef = ref(null);
const flvPlayer = ref(null);
const hlsPlayer = ref(null);
const errorMessage = ref('');
const dragPosition = ref(null);
let syncToken = 0;
let dragState = null;

const titleText = computed(() => {
    return props.state?.title || props.state?.pointName || props.state?.pointId || '视频播放';
});

const normalizeFormat = (value) => {
    const format = String(value || 'hls').trim().toLowerCase();
    return format === 'm3u8' ? 'hls' : format;
};

const inferFormatFromUrl = (value) => {
    const url = String(value || '').trim();
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

const resolvePlaybackFormat = (format, url) => {
    const configured = normalizeFormat(format);
    const inferred = inferFormatFromUrl(url);
    if (inferred && (!configured || configured === 'hls')) return inferred;
    return configured || inferred || 'hls';
};

const playbackFormat = computed(() => resolvePlaybackFormat(props.state?.format, props.state?.url));
const formatText = computed(() => playbackFormat.value.toUpperCase());
const vendorText = computed(() => {
    const map = {
        generic: '通用',
        hikvision: '海康威视',
        dahua: '大华',
        uniview: '宇视',
        huawei: '华为',
        tiandy: '天地伟业',
        custom: '自定义'
    };
    const vendor = String(props.state?.vendor || 'generic').trim();
    return map[vendor] || vendor || '通用';
});

const videoInfo = computed(() => {
    return Array.isArray(props.state?.videoInfo) ? props.state.videoInfo : [];
});

const modalStylePreset = computed(() => {
    const preset = String(props.state?.modalStyle?.preset || 'dark').trim();
    return ['dark', 'light', 'glass', 'security'].includes(preset) ? preset : 'dark';
});

const modalStyleClass = computed(() => `camera-video-modal--${modalStylePreset.value}`);

const toNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const modalStyleConfig = computed(() => {
    const source = props.state?.modalStyle && typeof props.state.modalStyle === 'object'
        ? props.state.modalStyle
        : {};
    const placement = String(source.placement || 'center').trim();
    return {
        placement: ['center', 'cursor', 'fixed'].includes(placement) ? placement : 'center',
        left: Math.max(0, Math.round(toNumber(source.left, 120))),
        top: Math.max(0, Math.round(toNumber(source.top, 120))),
        width: Math.max(320, Math.round(toNumber(source.width, 920))),
        height: Math.max(0, Math.round(toNumber(source.height, 0)))
    };
});

const getViewportBounds = () => {
    if (typeof window === 'undefined') {
        return { width: 1280, height: 720 };
    }
    return {
        width: window.innerWidth || 1280,
        height: window.innerHeight || 720
    };
};

const clampPosition = (left, top, width, height = 120) => {
    const bounds = getViewportBounds();
    const maxLeft = Math.max(8, bounds.width - width - 8);
    const maxTop = Math.max(8, bounds.height - height - 8);
    return {
        left: Math.min(Math.max(8, Math.round(left)), maxLeft),
        top: Math.min(Math.max(8, Math.round(top)), maxTop)
    };
};

const panelStyle = computed(() => {
    const config = modalStyleConfig.value;
    const width = Math.min(config.width, Math.max(320, getViewportBounds().width - 32));
    const base = {
        width: `${width}px`
    };
    const dragged = dragPosition.value;
    if (dragged) {
        const position = clampPosition(dragged.left, dragged.top, dragged.width || width, dragged.height || 120);
        return {
            ...base,
            left: `${position.left}px`,
            top: `${position.top}px`,
            transform: 'none'
        };
    }

    if (config.placement === 'cursor') {
        const pointer = props.state?.pointer || {};
        const x = toNumber(pointer.x, getViewportBounds().width / 2);
        const y = toNumber(pointer.y, getViewportBounds().height / 2);
        const position = clampPosition(x, y, width);
        return {
            ...base,
            left: `${position.left}px`,
            top: `${position.top}px`,
            transform: 'none'
        };
    }

    if (config.placement === 'fixed') {
        const position = clampPosition(config.left, config.top, width);
        return {
            ...base,
            left: `${position.left}px`,
            top: `${position.top}px`,
            transform: 'none'
        };
    }

    return {
        ...base,
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)'
    };
});

const videoStyle = computed(() => {
    const height = modalStyleConfig.value.height;
    if (height <= 0) return {};
    return {
        height: `${height}px`,
        objectFit: 'contain'
    };
});

const stopDrag = () => {
    if (typeof window !== 'undefined') {
        window.removeEventListener('pointermove', handleDragMove);
        window.removeEventListener('pointerup', stopDrag);
        window.removeEventListener('pointercancel', stopDrag);
    }
    if (typeof document !== 'undefined' && dragState?.previousUserSelect !== undefined) {
        document.body.style.userSelect = dragState.previousUserSelect;
    }
    dragState = null;
};

function handleDragMove(event) {
    if (!dragState) return;
    event.preventDefault();
    const nextLeft = dragState.left + event.clientX - dragState.startX;
    const nextTop = dragState.top + event.clientY - dragState.startY;
    dragPosition.value = {
        ...clampPosition(nextLeft, nextTop, dragState.width, dragState.height),
        width: dragState.width,
        height: dragState.height
    };
}

const startDrag = (event) => {
    if (event?.button !== undefined && event.button !== 0) return;
    if (event?.target?.closest?.('.camera-video-modal__close')) return;

    const panel = panelRef.value;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();

    stopDrag();
    dragState = {
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        previousUserSelect: typeof document !== 'undefined' ? document.body.style.userSelect : ''
    };
    dragPosition.value = {
        ...clampPosition(rect.left, rect.top, rect.width, rect.height),
        width: rect.width,
        height: rect.height
    };

    if (typeof document !== 'undefined') {
        document.body.style.userSelect = 'none';
    }
    if (typeof window !== 'undefined') {
        window.addEventListener('pointermove', handleDragMove);
        window.addEventListener('pointerup', stopDrag, { once: true });
        window.addEventListener('pointercancel', stopDrag, { once: true });
    }
    event.preventDefault();
};

const destroyFlv = () => {
    try {
        flvPlayer.value?.pause?.();
        flvPlayer.value?.unload?.();
        flvPlayer.value?.detachMediaElement?.();
        flvPlayer.value?.destroy?.();
    } catch (error) {
        void error;
    }
    flvPlayer.value = null;
};

const destroyHls = () => {
    try {
        hlsPlayer.value?.destroy?.();
    } catch (error) {
        void error;
    }
    hlsPlayer.value = null;
};

const destroyPlayers = () => {
    destroyFlv();
    destroyHls();
};

const clearNativeSource = (video) => {
    if (!video) return;
    video.pause?.();
    video.removeAttribute('src');
    video.load();
};

const playNative = async () => {
    const video = videoRef.value;
    if (!video) return;
    video.src = props.state?.url || '';
    video.load();
    if (props.state?.autoplay !== false) {
        try {
            await video.play();
        } catch (error) {
            void error;
        }
    }
};

const playFlv = async () => {
    const video = videoRef.value;
    if (!video || !props.state?.url) return;
    const flvModule = await import('flv.js');
    const flvjs = flvModule?.default || flvModule;
    if (!flvjs?.isSupported?.()) {
        throw new Error('当前浏览器不支持 FLV 播放');
    }

    destroyFlv();
    const player = flvjs.createPlayer({
        type: 'flv',
        url: props.state.url
    });
    player.attachMediaElement(video);
    player.load();
    if (props.state?.autoplay !== false) {
        player.play();
    }
    flvPlayer.value = player;
};

const playHls = async () => {
    const video = videoRef.value;
    if (!video || !props.state?.url) return;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
        await playNative();
        return;
    }

    const hlsModule = await import('hls.js');
    const Hls = hlsModule?.default || hlsModule;
    if (!Hls?.isSupported?.()) {
        throw new Error('当前浏览器不支持 HLS 播放');
    }

    destroyHls();
    const player = new Hls();
    player.loadSource(props.state.url);
    player.attachMedia(video);
    player.on(Hls.Events.MANIFEST_PARSED, () => {
        if (props.state?.autoplay !== false) {
            video.play().catch(() => {});
        }
    });
    player.on(Hls.Events.ERROR, (_, data) => {
        if (data?.fatal) {
            errorMessage.value = data?.details || 'HLS 视频加载失败';
        }
    });
    hlsPlayer.value = player;
};

const syncPlayer = async () => {
    const token = ++syncToken;
    errorMessage.value = '';
    destroyPlayers();

    await nextTick();
    if (token !== syncToken) return;

    const video = videoRef.value;
    if (!video) return;
    clearNativeSource(video);

    if (!props.state?.visible || !props.state?.url) return;

    try {
        if (token !== syncToken) return;
        const format = resolvePlaybackFormat(props.state?.format, props.state?.url);
        if (format === 'flv' || format === 'ws-flv') {
            await playFlv();
        } else if (format === 'hls') {
            await playHls();
        } else if (format === 'rtsp' || format === 'rtmp' || format === 'webrtc') {
            throw new Error(`${format.toUpperCase()} 需要流媒体网关或专用信令，浏览器不能直接用 video 标签播放`);
        } else {
            await playNative();
        }
    } catch (error) {
        errorMessage.value = error?.message || '视频加载失败';
    }
};

watch(
    () => [props.state?.visible, props.state?.url, props.state?.format, props.state?.autoplay, props.state?.muted],
    () => {
        syncPlayer();
    },
    { immediate: true, flush: 'post' }
);

watch(
    () => [
        props.state?.visible,
        props.state?.componentId,
        props.state?.pointId,
        props.state?.url,
        props.state?.modalStyle?.placement
    ],
    () => {
        stopDrag();
        dragPosition.value = null;
    },
    { flush: 'post' }
);

onBeforeUnmount(() => {
    syncToken += 1;
    stopDrag();
    destroyPlayers();
});
</script>

<style scoped>
.camera-video-modal{position:fixed;inset:0;z-index:2147483647;isolation:isolate}.camera-video-modal__backdrop{position:absolute;inset:0;background:rgba(2,6,23,.58)}.camera-video-modal__panel{position:fixed;z-index:1;background:#0f172a;border:1px solid rgba(148,163,184,.2);border-radius:16px;box-shadow:0 20px 60px rgba(15,23,42,.35);overflow:hidden}.camera-video-modal__header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(148,163,184,.16);color:#e2e8f0}.camera-video-modal__eyebrow{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8}.camera-video-modal__title{margin-top:4px;font-size:18px;font-weight:600}.camera-video-modal__close{border:none;background:transparent;color:#cbd5e1;font-size:28px;cursor:pointer;line-height:1}.camera-video-modal__body{padding:16px;background:#020617}.camera-video-modal__meta{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px;color:#94a3b8;font-size:12px}.camera-video-modal__video{display:block;width:100%;max-height:70vh;background:#000;border-radius:12px}.camera-video-modal__error{margin-bottom:10px;color:#fca5a5;font-size:12px}.camera-video-modal__info{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:12px}.camera-video-modal__info-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 10px;border:1px solid rgba(148,163,184,.16);border-radius:10px;background:rgba(15,23,42,.72);color:#cbd5e1;font-size:12px}.camera-video-modal__info-item span{color:#94a3b8}.camera-video-modal__info-item strong{font-weight:600;color:#e2e8f0}
.camera-video-modal--light .camera-video-modal__backdrop{background:rgba(15,23,42,.28)}.camera-video-modal--light .camera-video-modal__panel{background:#f8fafc;border-color:rgba(15,23,42,.12);box-shadow:0 24px 70px rgba(15,23,42,.22)}.camera-video-modal--light .camera-video-modal__header{color:#0f172a;border-bottom-color:rgba(15,23,42,.1)}.camera-video-modal--light .camera-video-modal__eyebrow,.camera-video-modal--light .camera-video-modal__meta,.camera-video-modal--light .camera-video-modal__info-item span{color:#64748b}.camera-video-modal--light .camera-video-modal__close{color:#334155}.camera-video-modal--light .camera-video-modal__body{background:#e2e8f0}.camera-video-modal--light .camera-video-modal__info-item{background:rgba(255,255,255,.82);border-color:rgba(15,23,42,.1);color:#334155}.camera-video-modal--light .camera-video-modal__info-item strong{color:#0f172a}
.camera-video-modal--glass .camera-video-modal__backdrop{background:rgba(8,13,24,.48);backdrop-filter:blur(8px)}.camera-video-modal--glass .camera-video-modal__panel{background:rgba(15,23,42,.76);border-color:rgba(226,232,240,.18);box-shadow:0 24px 80px rgba(2,6,23,.44);backdrop-filter:blur(18px)}.camera-video-modal--glass .camera-video-modal__body{background:rgba(2,6,23,.7)}
.camera-video-modal--security .camera-video-modal__backdrop{background:rgba(0,12,16,.68)}.camera-video-modal--security .camera-video-modal__panel{background:#031b1e;border-color:rgba(45,212,191,.32);box-shadow:0 0 0 1px rgba(45,212,191,.12),0 28px 90px rgba(0,0,0,.5)}.camera-video-modal--security .camera-video-modal__header{color:#ccfbf1;border-bottom-color:rgba(45,212,191,.18)}.camera-video-modal--security .camera-video-modal__eyebrow,.camera-video-modal--security .camera-video-modal__meta{color:#5eead4}.camera-video-modal--security .camera-video-modal__body{background:#001012}.camera-video-modal--security .camera-video-modal__info-item{background:rgba(6,78,59,.22);border-color:rgba(45,212,191,.18);color:#99f6e4}.camera-video-modal--security .camera-video-modal__info-item span{color:#5eead4}.camera-video-modal--security .camera-video-modal__info-item strong{color:#ccfbf1}
.camera-video-modal__header{cursor:move;user-select:none;touch-action:none}.camera-video-modal__close{cursor:pointer}
</style>
