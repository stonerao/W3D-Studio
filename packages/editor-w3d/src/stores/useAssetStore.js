import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAssetStore = defineStore('asset', () => {
    const PUBLIC_PROJECT_ID = '__public__';

    const repairPossiblyMojibake = (value) => {
        const text = String(value || '');
        if (!text) return '';
        if (/[\u4e00-\u9fff]/.test(text)) return text;
        if (!/[ÃÂÅÆÇÐÑØÙÚÛÜÝÞßà-ÿ]/.test(text)) return text;

        try {
            const bytes = Uint8Array.from(Array.from(text).map((char) => char.charCodeAt(0) & 0xff));
            const decoded = new TextDecoder('utf-8').decode(bytes);
            if (!decoded || decoded.includes('�')) return text;
            if (/[\u4e00-\u9fff]/.test(decoded)) return decoded;
            return decoded.length >= text.length ? decoded : text;
        } catch (error) {
            return text;
        }
    };

    // 资源列表
    const assets = ref([]);

    // 资源分类
    const assetCategories = ['model', 'splat', 'texture', 'hdr', 'geojson', 'image'];

    // 当前选中的资源分类
    const selectedCategory = ref('model');

    // 搜索关键词
    const searchKeyword = ref('');
    const selectedScope = ref('public');

    // 资源计数器
    let assetCounter = 0;

    // API 相关状态
    const loading = ref(false);
    const error = ref(null);
    const currentPage = ref(1);
    const pageSize = ref(20);
    const total = ref(0);
    const totalPages = ref(0);
    let fetchRequestToken = 0;

    // 分类路径筛选
    const selectedPath = ref('');

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

    const matchesKeywordFuzzy = (keyword, ...fields) => {
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

    const normalizeModelFormat = (value) => {
        const s = String(value || '').toLowerCase().replace(/^\./, '');
        return ['glb', 'gltf', 'fbx'].includes(s) ? s : '';
    };

    const normalizeSplatFormat = (value) => {
        const s = String(value || '').toLowerCase().replace(/^\./, '');
        return ['ply', 'splat', 'ksplat', 'spz'].includes(s) ? s : '';
    };

    const getFileExt = (value) => {
        if (!value) return '';
        const clean = String(value).split('?')[0].split('#')[0];
        const idx = clean.lastIndexOf('.');
        return idx === -1 ? '' : clean.slice(idx + 1).toLowerCase();
    };

    const inferModelFormat = (item) => {
        const candidates = [
            item?.fileType,
            item?.type,
            item?.fileDetails?.fileType,
            item?.metadata?.fileDetails?.fileType,
            getFileExt(item?.name),
            getFileExt(item?.url),
            getFileExt(Array.isArray(item?.modelFiles) ? item.modelFiles[0] : ''),
            getFileExt(Array.isArray(item?.files) ? item.files[0] : '')
        ];

        for (const candidate of candidates) {
            const format = normalizeModelFormat(candidate);
            if (format) return format;
        }

        return '';
    };

    const inferSplatFormat = (item) => {
        const candidates = [
            item?.fileType,
            item?.type,
            item?.fileDetails?.fileType,
            item?.metadata?.fileDetails?.fileType,
            getFileExt(item?.name),
            getFileExt(item?.url),
            getFileExt(Array.isArray(item?.files) ? item.files[0] : '')
        ];

        for (const candidate of candidates) {
            const format = normalizeSplatFormat(candidate);
            if (format) return format;
        }

        return '';
    };

    // 根据分类过滤的资源
    const filteredAssets = computed(() => {
        let filtered = assets.value.filter((asset) => asset.category === selectedCategory.value);

        // 搜索过滤
        if (searchKeyword.value) {
            filtered = filtered.filter(
                (asset) => matchesKeywordFuzzy(searchKeyword.value, asset.name, asset.fileName)
            );
        }

        return filtered;
    });

    // 根据分类获取资源数量
    const getAssetCountByCategory = (category) => {
        return assets.value.filter((asset) => asset.category === category).length;
    };

    // 添加资源
    const addAsset = (assetData) => {
        const asset = {
            id: `asset_${++assetCounter}`,
            name: assetData.name || `Asset ${assetCounter}`,
            fileName: assetData.fileName || '',
            url: assetData.url || '',
            category: assetData.category || 'model',
            type: assetData.type || '', // 文件类型：glb, gltf, jpg, png, hdr 等
            size: assetData.size || 0, // 文件大小（字节）
            thumbnail: assetData.thumbnail || '', // 缩略图 URL
            metadata: assetData.metadata || {}, // 额外元数据
            createdAt: Date.now()
        };

        assets.value.push(asset);
        return asset;
    };

    // 删除资源
    const removeAsset = (assetId) => {
        const index = assets.value.findIndex((a) => a.id === assetId);
        if (index !== -1) {
            const asset = assets.value[index];
            assets.value.splice(index, 1);
            return asset;
        }
        return null;
    };

    // 更新资源
    const updateAsset = (assetId, updates) => {
        const asset = assets.value.find((a) => a.id === assetId);
        if (asset) {
            Object.assign(asset, updates);
            return asset;
        }
        return null;
    };

    // 根据 ID 获取资源
    const getAssetById = (assetId) => {
        return assets.value.find((a) => a.id === assetId) || null;
    };

    // 根据 URL 获取资源
    const getAssetByUrl = (url) => {
        return assets.value.find((a) => a.url === url) || null;
    };

    // 设置选中的分类
    const setSelectedCategory = (category) => {
        selectedCategory.value = category;
    };

    // 设置搜索关键词
    const setSearchKeyword = (keyword) => {
        searchKeyword.value = keyword;
    };

    const setSelectedScope = (scope) => {
        selectedScope.value = ['project', 'public', 'all'].includes(scope) ? scope : 'public';
    };

    // 清空所有资源
    const clearAssets = () => {
        assets.value = [];
        assetCounter = 0;
    };

    // 批量添加资源
    const addAssets = (assetList) => {
        return assetList.map((assetData) => addAsset(assetData));
    };

    // 初始化默认资源
    const initializeDefaultAssets = () => {
        // 添加默认模型资源
        const defaultModels = [
            {
                name: 'ShaderBall',
                fileName: 'ShaderBall.glb',
                url: '/models/ShaderBall.glb',
                category: 'model',
                type: 'glb',
                size: 0,
                thumbnail: ''
            },
            {
                name: 'Xbot',
                fileName: 'Xbot.glb',
                url: '/models/Xbot.glb',
                category: 'model',
                type: 'glb',
                size: 0,
                thumbnail: ''
            }
        ];

        // 添加默认纹理资源
        const defaultTextures = [
            {
                name: 'Blouberg Sunrise',
                fileName: 'blouberg_sunrise_2_1k.hdr',
                url: '/textures/blouberg_sunrise_2_1k.hdr',
                category: 'hdr',
                type: 'hdr',
                size: 0,
                thumbnail: ''
            }
        ];

        addAssets([...defaultModels, ...defaultTextures]);
    };

    /**
     * ????????????????????
     */
    const fetchAssetsFromAPI = async (category, params = {}) => {
        const requestToken = ++fetchRequestToken;
        const isLatestRequest = () => requestToken === fetchRequestToken;

        try {
            loading.value = true;
            error.value = null;

            if (assets.value.length === 0) {
                initializeDefaultAssets();
            }

            const page = params.page || currentPage.value;
            const size = params.pageSize || pageSize.value;
            const keyword = params.keyword || searchKeyword.value;
            const normalizedCategory = category === 'image' ? 'texture' : category;
            const filtered = assets.value.filter((asset) => (
                asset.category === normalizedCategory &&
                matchesKeywordFuzzy(keyword, asset.name, asset.fileName, asset.url)
            ));
            const paged = filtered.slice((page - 1) * size, page * size);

            if (!isLatestRequest()) {
                return {
                    success: false,
                    stale: true
                };
            }

            total.value = filtered.length;
            totalPages.value = Math.max(1, Math.ceil(filtered.length / size));
            currentPage.value = page;

            return {
                success: true,
                data: paged,
                total: total.value,
                page: currentPage.value,
                totalPages: totalPages.value
            };
        } catch (err) {
            if (!isLatestRequest()) {
                return {
                    success: false,
                    stale: true
                };
            }
            console.error('[AssetStore] ??????????:', err);
            error.value = err.message;
            return {
                success: false,
                error: err.message
            };
        } finally {
            if (isLatestRequest()) {
                loading.value = false;
            }
        }
    };

    /**
     * 从 API 获取模型列表（兼容旧调用）
     */
    const fetchModelsFromAPI = async (params = {}) => {
        return await fetchAssetsFromAPI('model', params);
    };

    /**
     * 设置当前页码
     */
    const setCurrentPage = (page) => {
        currentPage.value = page;
    };

    /**
     * 设置每页数量
     */
    const setPageSize = (size) => {
        pageSize.value = size;
        currentPage.value = 1; // 重置到第一页
    };

    /**
     * 设置分类路径筛选
     */
    const setSelectedPath = (path) => {
        selectedPath.value = path;
    };

    const resolveProjectContext = (params = {}) => {
        const scope = params.scope || selectedScope.value || 'project';
        const projectId = String(params.projectId || '').trim();

        if ((scope === 'project' || scope === 'all') && !projectId) {
            throw new Error('当前未绑定项目，无法加载当前项目资源');
        }

        return {
            scope,
            projectId: projectId || PUBLIC_PROJECT_ID
        };
    };

    return {
        // 状态
        assets,
        assetCategories,
        selectedCategory,
        searchKeyword,
        selectedScope,
        filteredAssets,
        loading,
        error,
        currentPage,
        pageSize,
        total,
        totalPages,
        selectedPath,

        // 方法
        addAsset,
        removeAsset,
        updateAsset,
        getAssetById,
        getAssetByUrl,
        getAssetCountByCategory,
        setSelectedCategory,
        setSearchKeyword,
        setSelectedScope,
        clearAssets,
        addAssets,
        initializeDefaultAssets,
        fetchAssetsFromAPI,
        fetchModelsFromAPI,
        setCurrentPage,
        setPageSize,
        setSelectedPath
    };
});

