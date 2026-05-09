<template>
    <Modal
        v-model="isOpen"
        :title="title"
        width="900px"
        @close="handleClose"
    >
        <!-- 搜索框 -->
        <div class="search-bar">
            <div class="search-input-wrap">
                <Input
                    v-model="searchQuery"
                    :placeholder="placeholder"
                    class="search-input"
                    @keyup.enter="handleSearch"
                />
                <button
                    v-if="searchQuery"
                    type="button"
                    class="search-clear-icon"
                    title="清空搜索"
                    @click="handleClearSearch"
                >
                    ×
                </button>
            </div>
            <Button variant="primary" size="sm" class="search-button" @click="handleSearch">
                搜索
            </Button>
        </div>
        <Tabs v-model="selectedScope" :tabs="scopeTabs" class="mb-3" />

        <div v-if="multiple && filteredModelAssets.length > 0" class="bulk-toolbar">
            <div class="bulk-toolbar__info">
                当前页 {{ filteredModelAssets.length }} 条，已选 {{ selectedAssets.length }} 条
            </div>
            <div class="bulk-toolbar__actions">
                <Button variant="outline" size="sm" @click="selectAllVisibleAssets">
                    当前页全选
                </Button>
                <Button variant="outline" size="sm" :disabled="selectedAssets.length === 0" @click="clearSelectedAssets">
                    清空选择
                </Button>
            </div>
        </div>

        <!-- 加载状态 -->
        <div v-if="assetStore.loading" class="loading-state">
            <div class="loading-spinner"></div>
            <div class="loading-text">加载中...</div>
        </div>

        <!-- 错误状态 -->
        <div v-else-if="assetStore.error" class="error-state">
            <div class="error-icon"></div>
            <div class="error-text">{{ assetStore.error }}</div>
            <Button variant="primary" size="sm" class="mt-3" @click="handleRetry">
                重试
            </Button>
        </div>

        <!-- 资源列表 -->
        <div v-else-if="filteredModelAssets.length > 0" class="asset-list">
            <div
                v-for="asset in filteredModelAssets"
                :key="asset.id"
                class="asset-item"
                :class="{ 'selected': isAssetSelected(asset) }"
                @click="selectAsset(asset)"
            >
                <!-- 缩略图 -->
                <div class="asset-thumbnail">
                    <img
                        v-if="asset.thumbnail"
                        :src="asset.thumbnail"
                        :alt="asset.name"
                        class="thumbnail-image"
                    />
                    <div v-else class="thumbnail-placeholder">
                        {{ getFileExtension(asset.type) }}
                    </div>
                </div>

                <!-- 资源信息 -->
                <div class="asset-info">
                    <div class="asset-name">{{ asset.name }}</div>
                    <div class="asset-meta">
                        <span class="asset-type">{{ asset.type.toUpperCase() }}</span>
                        <span v-if="asset.size" class="asset-size">{{ formatFileSize(asset.size) }}</span>
                    </div>
                    <div v-if="asset.createdAt" class="asset-date">
                        {{ formatDate(asset.createdAt) }}
                    </div>
                </div>

                <!-- 选中标记 -->
                <div v-if="isAssetSelected(asset)" class="asset-check">✓</div>
            </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="empty-state">
            <div class="empty-icon"></div>
            <div class="empty-text">没有找到符合条件的资源</div>
            <div class="empty-hint">请先在左侧资源库中上传资源文件</div>
        </div>

        <!-- 分页控制 -->
        <div v-if="assetStore.total > 0" class="pagination">
            <div class="pagination-info">
                共 {{ assetStore.total }} 个资源，第 {{ assetStore.currentPage }} / {{ assetStore.totalPages }} 页
            </div>
            <div class="pagination-controls">
                <label class="page-size-control">
                    <span>每页</span>
                    <select :value="assetStore.pageSize" @change="handlePageSizeChange">
                        <option v-for="size in pageSizeOptions" :key="size" :value="size">
                            {{ size }}
                        </option>
                    </select>
                </label>
                <Button
                    variant="outline"
                    size="sm"
                    :disabled="assetStore.currentPage <= 1"
                    @click="handlePrevPage"
                >
                    上一页
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    :disabled="assetStore.currentPage >= assetStore.totalPages"
                    @click="handleNextPage"
                >
                    下一页
                </Button>
            </div>
        </div>

        <!-- 底部按钮 -->
        <template #footer>
            <Button variant="outline" @click="handleClose">取消</Button>
            <Button
                variant="primary"
                :disabled="confirmDisabled"
                @click="handleConfirm"
            >
                {{ multiple ? `确定 (${selectedAssets.length})` : '确定' }}
            </Button>
        </template>
    </Modal>
</template>

<script setup>
import { ref, computed, watch, onMounted, inject } from 'vue';
import { useRoute } from 'vue-router';
import { useAssetStore } from '../../stores/useAssetStore';
import { useToast } from '../../composables/useToast';
import Modal from '../ui/Modal.vue';
import Input from '../ui/Input.vue';
import Button from '../ui/Button.vue';
import Tabs from '../ui/Tabs.vue';

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    category: {
        type: String,
        default: 'model'
    },
    initialKeyword: {
        type: String,
        default: ''
    },
    currentValue: {
        type: String,
        default: ''
    },
    multiple: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:modelValue', 'select']);

const route = useRoute();
const assetStore = useAssetStore();
const toast = useToast();
const injectedProjectId = inject('editorProjectId', null);

// 获取当前项目 ID
const projectId = computed(() => {
    const providedId = typeof injectedProjectId?.value === 'string'
        ? injectedProjectId.value
        : (typeof injectedProjectId === 'string' ? injectedProjectId : '');
    if (providedId.trim()) return providedId.trim();
    const routeProjectId = route?.params?.projectId;
    if (typeof routeProjectId === 'string' && routeProjectId.trim()) {
        return routeProjectId.trim();
    }
    const routeId = route?.params?.id;
    return typeof routeId === 'string' && routeId.trim() ? routeId.trim() : '';
});

// 状态
const isOpen = ref(props.modelValue);
const searchQuery = ref('');
const selectedAsset = ref(null);
const selectedAssets = ref([]);
const pageSizeOptions = [20, 40, 60, 100, 200];

const categoryTitleMap = {
    model: '选择模型文件',
    splat: '选择高斯泼溅文件',
    texture: '选择纹理文件',
    hdr: '选择 HDR 文件',
    image: '选择图片文件'
};

const categoryPlaceholderMap = {
    model: '搜索模型...',
    splat: '搜索高斯泼溅...',
    texture: '搜索纹理...',
    hdr: '搜索 HDR...',
    image: '搜索图片...'
};

const categoryExtensionsMap = {
    model: ['glb', 'gltf', 'fbx', 'obj', 'stl'],
    splat: ['ply', 'splat', 'ksplat', 'spz'],
    texture: ['png', 'jpg', 'jpeg', 'webp', 'ktx2', 'dds', 'bmp', 'tga'],
    hdr: ['hdr', 'exr'],
    image: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg']
};

const normalizeCategory = (category) => String(category || '').trim().toLowerCase();

const normalizedCategory = computed(() => normalizeCategory(props.category));

const title = computed(() => categoryTitleMap[normalizedCategory.value] || '选择资源');
const placeholder = computed(() => categoryPlaceholderMap[normalizedCategory.value] || '搜索...');
const selectedScope = computed({
    get: () => assetStore.selectedScope || 'project',
    set: (value) => assetStore.setSelectedScope(value)
});
const scopeTabs = computed(() => [
    { key: 'project', label: '当前项目' },
    { key: 'public', label: '公共资源' },
    { key: 'all', label: '全部' }
]);

const normalizeForFuzzySearch = (value) => {
    return String(value || '')
        .toLowerCase()
        .replace(/[\s_\-./\\]+/g, '');
};

const isSubsequence = (target, query) => {
    if (!query) return true;
    let queryIndex = 0;
    for (let i = 0; i < target.length && queryIndex < query.length; i++) {
        if (target[i] === query[queryIndex]) {
            queryIndex++;
        }
    }
    return queryIndex === query.length;
};

const isFuzzyMatched = (keyword, ...fields) => {
    const rawKeyword = String(keyword || '').trim().toLowerCase();
    if (!rawKeyword) return true;
    const normalizedKeyword = normalizeForFuzzySearch(rawKeyword);

    return fields.some((field) => {
        const rawField = String(field || '').toLowerCase();
        if (!rawField) return false;
        if (rawField.includes(rawKeyword)) return true;

        const normalizedField = normalizeForFuzzySearch(rawField);
        return normalizedField.includes(normalizedKeyword) || isSubsequence(normalizedField, normalizedKeyword);
    });
};

// 监听 modelValue 变化
watch(() => props.modelValue, async (newValue) => {
    isOpen.value = newValue;
    if (newValue) {
        const initialKeyword = String(props.initialKeyword || '').trim();
        searchQuery.value = initialKeyword;
        selectedAsset.value = null;
        selectedAssets.value = [];
        assetStore.setCurrentPage(1);
        if (initialKeyword) {
            await handleSearch();
        } else {
            assetStore.setSearchKeyword('');
            await loadAssets();
        }
    }
});

watch(
    () => props.category,
    async () => {
        if (isOpen.value) {
            assetStore.setCurrentPage(1);
            await loadAssets();
        }
    }
);

watch(
    () => props.initialKeyword,
    async (keyword) => {
        if (!isOpen.value) return;
        const nextKeyword = String(keyword || '').trim();
        searchQuery.value = nextKeyword;
        assetStore.setCurrentPage(1);
        if (nextKeyword) {
            await handleSearch();
        } else {
            await handleClearSearch();
        }
    }
);

// 监听 isOpen 变化
watch(isOpen, (newValue) => {
    emit('update:modelValue', newValue);
});

/**
 * 点击搜索按钮时执行搜索
 */
const handleSearch = async () => {
    assetStore.setSearchKeyword(String(searchQuery.value || '').trim());
    assetStore.setCurrentPage(1);
    await loadAssets();
};

const handleClearSearch = async () => {
    searchQuery.value = '';
    assetStore.setSearchKeyword('');
    assetStore.setCurrentPage(1);
    await loadAssets();
};

const getFileExtFromAsset = (asset) => {
    const candidates = [asset?.fileName, asset?.name, asset?.url, asset?.type];
    for (const candidate of candidates) {
        const text = String(candidate || '').trim().toLowerCase();
        if (!text) continue;

        const pure = text.split('?')[0].split('#')[0];
        const dotIndex = pure.lastIndexOf('.');
        if (dotIndex >= 0 && dotIndex < pure.length - 1) {
            return pure.slice(dotIndex + 1);
        }

        if (/^[a-z0-9]+$/i.test(pure)) {
            return pure;
        }
    }
    return '';
};

const isAssetInCategory = (asset, category) => {
    const targetCategory = normalizeCategory(category);
    if (!targetCategory) return true;

    const assetCategory = normalizeCategory(asset?.category);
    if (assetCategory && assetCategory === targetCategory) return true;

    const ext = getFileExtFromAsset(asset);
    if (!ext) return false;

    const allowedExts = categoryExtensionsMap[targetCategory] || [];
    return allowedExts.includes(ext);
};

// 过滤模型资源（直接使用 store 中的资源列表）
const filteredModelAssets = computed(() => {
    return assetStore.assets.filter((asset) => {
        if (!isAssetInCategory(asset, normalizedCategory.value)) {
            return false;
        }
        return isFuzzyMatched(searchQuery.value, asset?.name, asset?.fileName, asset?.url);
    });
});

const isAssetSelected = (asset) => {
    if (!asset?.id) return false;
    if (props.multiple) {
        return selectedAssets.value.some((item) => item?.id === asset.id);
    }
    if (selectedAsset.value) {
        return selectedAsset.value?.id === asset.id;
    }
    return isCurrentAsset(asset);
};

const normalizeAssetValue = (value) => String(value || '').trim();

const isCurrentAsset = (asset) => {
    const currentValue = normalizeAssetValue(props.currentValue);
    if (!currentValue) return false;

    return [
        asset?.url,
        asset?.id,
        asset?.resourceId,
        asset?.fileName,
        asset?.name
    ].some((value) => normalizeAssetValue(value) === currentValue);
};

const currentAsset = computed(() => {
    if (props.multiple) return null;
    return assetStore.assets.find((asset) => isCurrentAsset(asset)) || null;
});

const confirmDisabled = computed(() => {
    if (props.multiple) return selectedAssets.value.length === 0;
    return !selectedAsset.value && !currentAsset.value;
});

const selectAllVisibleAssets = () => {
    if (!props.multiple) return;
    const selectedIds = new Set(selectedAssets.value.map((item) => item?.id));
    const merged = [...selectedAssets.value];
    filteredModelAssets.value.forEach((asset) => {
        if (!selectedIds.has(asset?.id)) {
            merged.push(asset);
        }
    });
    selectedAssets.value = merged;
};

const clearSelectedAssets = () => {
    selectedAssets.value = [];
};

// 选择资源
const selectAsset = (asset) => {
    if (props.multiple) {
        const exists = selectedAssets.value.some((item) => item?.id === asset.id);
        selectedAssets.value = exists
            ? selectedAssets.value.filter((item) => item?.id !== asset.id)
            : [...selectedAssets.value, asset];
        return;
    }
    selectedAsset.value = asset;
};

// 确认选择
const handleConfirm = () => {
    if (props.multiple) {
        if (!selectedAssets.value.length) {
            toast.warning('请先选择资源文件');
            return;
        }
        emit('select', [...selectedAssets.value]);
        toast.success(`已选择 ${selectedAssets.value.length} 个资源`);
        handleClose();
        return;
    }

    const assetToSelect = selectedAsset.value || currentAsset.value;

    if (!assetToSelect) {
        toast.warning('请先选择一个资源文件');
        return;
    }

    emit('select', assetToSelect);
    toast.success(`已选择: ${assetToSelect.name}`);
    handleClose();
};

// 关闭对话框
const handleClose = () => {
    isOpen.value = false;
};

/**
 * 加载模型列表
 */
const loadAssets = async () => {
    const params = {
        page: assetStore.currentPage,
        pageSize: assetStore.pageSize,
        keyword: assetStore.searchKeyword,
        path: assetStore.selectedPath,
        projectId: projectId.value,
        scope: assetStore.selectedScope || 'project'
    };

    if (typeof assetStore.fetchAssetsFromAPI === 'function') {
        await assetStore.fetchAssetsFromAPI(normalizedCategory.value, params);
    } else {
        await assetStore.fetchModelsFromAPI(params);
    }
};

/**
 * 上一页
 */
const handlePrevPage = async () => {
    if (assetStore.currentPage > 1) {
        assetStore.setCurrentPage(assetStore.currentPage - 1);
        await loadAssets();
    }
};

/**
 * 下一页
 */
const handleNextPage = async () => {
    if (assetStore.currentPage < assetStore.totalPages) {
        assetStore.setCurrentPage(assetStore.currentPage + 1);
        await loadAssets();
    }
};

const handlePageSizeChange = async (event) => {
    const nextSize = Number(event?.target?.value) || 20;
    assetStore.setPageSize(nextSize);
    await loadAssets();
};

/**
 * 重试加载
 */
const handleRetry = async () => {
    await loadAssets();
};

// 获取文件扩展名
const getFileExtension = (fileType) => {
    if (!fileType) return '';
    return `.${fileType.toUpperCase()}`;
};

// 格式化文件大小（转换为 MB）
const formatFileSize = (bytes) => {
    if (bytes === 0) return '-';
    const mb = (bytes / 1024 / 1024).toFixed(2);
    return `${mb} MB`;
};

/**
 * 格式化日期
 */
const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
};

onMounted(async () => {
    if (!isOpen.value) return;
    await loadAssets();
});

watch(
    () => assetStore.selectedScope,
    async () => {
        if (!isOpen.value) return;
        assetStore.setCurrentPage(1);
        await loadAssets();
    }
);
</script>

<style scoped>
.search-bar {
    margin-bottom: 1rem;
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.search-input-wrap {
    flex: 1;
    position: relative;
}

.search-input {
    width: 100%;
}

:deep(.search-input .input) {
    padding-right: 1.875rem;
}

.search-clear-icon {
    position: absolute;
    top: 50%;
    right: 0.5rem;
    transform: translateY(-50%);
    width: 1.25rem;
    height: 1.25rem;
    border: 0;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: var(--color-text-tertiary);
    cursor: pointer;
    line-height: 1;
}

.search-clear-icon:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-hover);
}

.search-button {
    flex-shrink: 0;
}

.bulk-toolbar {
    margin-bottom: 0.75rem;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
    background: var(--color-bg-secondary);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
}

.bulk-toolbar__info {
    color: var(--color-text-secondary);
    font-size: 0.8125rem;
}

.bulk-toolbar__actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.asset-list {
    max-height: 500px;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    padding: 0.5rem;
}

.asset-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: var(--border-radius-md);
    border: 1px solid var(--color-border);
    cursor: pointer;
    transition: all var(--transition-fast);
    position: relative;
}

.asset-item:hover {
    background-color: var(--color-bg-hover);
    border-color: var(--color-primary);
}

.asset-item.selected {
    background-color: var(--color-bg-hover);
    border-color: var(--color-primary);
}

.asset-thumbnail {
    flex-shrink: 0;
    max-width: 120px;
    aspect-ratio: 1;
    border-radius: var(--border-radius-sm);
    overflow: hidden;
    background-color: var(--color-bg-elevated);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.5rem;
    height: 120px;
}

.thumbnail-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.thumbnail-placeholder {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--color-text-tertiary);
}

.asset-info {
    width: 100%;
    text-align: center;
}

.asset-name {
    font-weight: 500;
    font-size: 0.75rem;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
    /* 超出隐藏 */
    text-overflow: ellipsis;
    word-break: break-all;
    width: 130px;
}

.asset-meta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    margin-top: 0.25rem;
    font-size: 0.625rem;
    color: var(--color-text-secondary);
    flex-wrap: wrap;
}

.asset-type {
    padding: 0.125rem 0.25rem;
    background-color: var(--color-bg-elevated);
    border-radius: var(--border-radius-sm);
    font-size: 0.625rem;
}

.asset-size {
    flex-shrink: 0;
    font-size: 0.625rem;
}

.asset-date {
    font-size: 0.625rem;
    color: var(--color-text-tertiary);
    margin-top: 0.25rem;
    width: 100%;
    text-align: center;
}

.asset-check {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    background-color: var(--color-primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.loading-state,
.error-state,
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 0;
    text-align: center;
}

.loading-spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.loading-text {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--color-text-tertiary);
}

.error-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
}

.error-text {
    font-size: 0.875rem;
    color: var(--color-error);
}

.empty-icon {
    font-size: 3.75rem;
    margin-bottom: 1rem;
}

.empty-text {
    font-size: 1.125rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    margin-bottom: 0.5rem;
}

.empty-hint {
    font-size: 0.875rem;
    color: var(--color-text-tertiary);
}

.pagination {
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
}

.pagination-info {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
}

.pagination-controls {
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.page-size-control {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    margin-right: 0.25rem;
    color: var(--color-text-secondary);
    font-size: 0.8125rem;
}

.page-size-control select {
    height: 30px;
    min-width: 72px;
    padding: 0 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
}

.page-size-control select:focus {
    outline: none;
    border-color: var(--color-primary);
}

@media (max-width: 768px) {
    .bulk-toolbar,
    .pagination {
        flex-direction: column;
        align-items: stretch;
    }

    .bulk-toolbar__actions,
    .pagination-controls {
        width: 100%;
    }
}
</style>

