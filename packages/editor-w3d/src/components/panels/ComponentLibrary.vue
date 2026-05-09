<template>
    <div class="component-library">
        <div class="component-library__header">
            <Input
                v-model="searchKeyword"
                class="component-search"
                :placeholder="t('componentLibrary.searchPlaceholder')"
            />

            <div class="category-strip">
                <button
                    v-for="cat in categories"
                    :key="cat.key"
                    class="category-btn"
                    :class="{ active: selectedCategory === cat.key }"
                    @click="selectedCategory = cat.key"
                >
                    {{ cat.label }}
                </button>
            </div>
        </div>

        <!-- English comment. -->
        <div class="component-list">
            <div v-if="filteredComponents.length === 0" class="empty-state">
                <div class="empty-text">{{ t('componentLibrary.empty') }}</div>
            </div>

            <div
                v-for="comp in filteredComponents"
                :key="comp.type"
                class="component-card"
                :class="{ disabled: !canAddComponent(comp.type) }"
                @click="handleAddComponent(comp.type)"
                @contextmenu.prevent="handleShowContextMenu($event, comp)"
                draggable="true"
                @dragstart="handleDragStart($event, comp)"
                :title="!canAddComponent(comp.type) ? t('componentLibrary.alreadyExistsTitle', { name: getComponentName(comp) }) : ''"
            >
                <div class="component-info">
                    <div class="component-card__header">
                        <div class="component-name">
                            {{ getComponentName(comp) }}
                        </div>
                        <span v-if="!canAddComponent(comp.type)" class="exists-badge">
                            {{ t('componentLibrary.exists') }}
                        </span>
                    </div>
                    <div class="component-desc">{{ getComponentDescription(comp) }}</div>
                    <div class="component-meta-row">
                        <span v-if="comp.category" class="component-category">
                            {{ getCategoryLabel(comp.category) }}
                        </span>
                        <span class="component-type">{{ comp.type }}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- English comment. -->
        <ContextMenu
            v-model:visible="contextMenu.visible"
            :x="contextMenu.x"
            :y="contextMenu.y"
            :items="contextMenuItems"
            @select="handleContextMenuSelect"
        />


    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import Input from '../ui/Input.vue';
import ContextMenu from '../ui/ContextMenu.vue';
import { useComponent } from '../../composables/useComponent';
import { useComponentStore } from '../../stores/useComponentStore';
import { useConfirm } from '../../composables/useConfirm';
import { useToast } from '../../composables/useToast';
import { useEditorI18n } from '../../i18n';
import { getEnabledComponents, componentCategories } from '../../config/components';

// English comment.
const UNIQUE_COMPONENTS = ['GridHelper', 'HDRLoader', 'WeatherLighting', 'WeatherClouds'];

const emit = defineEmits(['component-added']);

const componentStore = useComponentStore();
const { alert: showAlert } = useConfirm();
const toast = useToast();
const { t, te } = useEditorI18n();

// English comment.
const searchKeyword = ref('');

// English comment.
const selectedCategory = ref('all');

// English comment.
const categories = computed(() => {
    return [
        { key: 'all', label: t('componentLibrary.all') },
        ...componentCategories.map((cat) => ({
            key: cat.key,
            label: getCategoryLabel(cat.key)
        }))
    ];
});

// English comment.
const availableComponents = computed(() => getEnabledComponents());

// English comment.
const filteredComponents = computed(() => {
    let filtered = availableComponents.value;

    // English comment.
    if (selectedCategory.value !== 'all') {
        filtered = filtered.filter((comp) => comp.category === selectedCategory.value);
    }

    // English comment.
    if (searchKeyword.value) {
        const keyword = searchKeyword.value.toLowerCase();
        filtered = filtered.filter(
            (comp) =>
                getComponentName(comp).toLowerCase().includes(keyword) ||
                getComponentDescription(comp).toLowerCase().includes(keyword) ||
                comp.type.toLowerCase().includes(keyword)
        );
    }

    return filtered;
});

// English comment.
const { addComponent } = useComponent();

/**
 * English comment.
 */
const isComponentExist = (type) => {
    if (!UNIQUE_COMPONENTS.includes(type)) {
        return false;
    }
    return componentStore.components.some((c) => c.type === type);
};

/**
 * English comment.
 */
const canAddComponent = (type) => {
    return !isComponentExist(type);
};

// English comment.
const contextMenu = ref({
    visible: false,
    x: 0,
    y: 0,
    component: null
});

// English comment.
const contextMenuItems = computed(() => {
    if (!contextMenu.value.component) return [];

    return [
        {
            icon: 'plus',
            label: t('componentLibrary.addToScene'),
            action: 'add'
        },
        {
            divider: true
        },
        {
            icon: 'info',
            label: t('componentLibrary.viewDetails'),
            action: 'info',
            disabled: true // English comment.
        }
    ];
});

/**
 * English comment.
 */
const getCategoryLabel = (categoryKey) => {
    const key = `componentLibrary.categories.${categoryKey}`;
    return te(key) ? t(key) : categoryKey;
};

const getComponentName = (component) => {
    const key = `componentLibrary.components.${component.type}.name`;
    return te(key) ? t(key) : (component.displayName || component.type);
};

const getComponentDescription = (component) => {
    const key = `componentLibrary.components.${component.type}.description`;
    return te(key) ? t(key) : (component.description || '');
};

/**
 * English comment.
 */
const handleAddComponent = async (type) => {
    // English comment.
    if (!canAddComponent(type)) {
        const componentInfo = getEnabledComponents().find(c => c.type === type);
        const displayName = componentInfo ? getComponentName(componentInfo) : type;
        toast.warning(t('componentLibrary.alreadyExistsWarning', { name: displayName }));
        return;
    }

    try {
        const component = await addComponent(type);
        emit('component-added', component);
    } catch (error) {
        console.error('Failed to add component:', error);
        toast.error(t('componentLibrary.addFailed', { message: error.message }));
    }
};

/**
 * English comment.
 */
const handleDragStart = (event, comp) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('component-type', comp.type);
    event.dataTransfer.setData('component-name', getComponentName(comp));

    // English comment.
    try {
        const preview = document.createElement('div');
        preview.textContent = getComponentName(comp) || comp.type;
        preview.style.position = 'fixed';
        preview.style.top = '-1000px';
        preview.style.left = '-1000px';
        preview.style.padding = '6px 10px';
        preview.style.border = '1px solid var(--color-border)';
        preview.style.borderRadius = '6px';
        preview.style.background = 'var(--color-bg-tertiary)';
        preview.style.color = 'var(--color-text-primary)';
        preview.style.fontSize = '12px';
        preview.style.whiteSpace = 'nowrap';
        document.body.appendChild(preview);
        event.dataTransfer.setDragImage(preview, 10, 10);
        requestAnimationFrame(() => {
            try { document.body.removeChild(preview); } catch { /* ignore */ }
        });
    } catch {
        // ignore
    }
};

/**
 * English comment.
 */
const handleShowContextMenu = (event, comp) => {
    contextMenu.value = {
        visible: true,
        x: event.clientX,
        y: event.clientY,
        component: comp
    };
};

/**
 * English comment.
 */
const handleContextMenuSelect = (item) => {
    const comp = contextMenu.value.component;
    if (!comp) return;

    switch (item.action) {
        case 'add':
            handleAddComponent(comp.type);
            break;
        case 'info':
            // English comment.
            showAlert(t('componentLibrary.detailsMessage', {
                name: getComponentName(comp),
                type: comp.type,
                description: getComponentDescription(comp)
            }), { title: t('componentLibrary.detailsTitle') });
            break;
    }
};

/**
 * English comment.
 */
/* English comment. */
</script>

<style scoped>
.component-library {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
    gap: var(--left-panel-content-gap);
    padding: var(--left-panel-content-padding) var(--left-panel-content-padding) 0;
}

.component-library__header {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--left-panel-content-gap);
}

.component-search :deep(.input) {
    height: var(--left-panel-control-height);
    border-radius: var(--left-panel-control-radius);
    font-size: var(--font-size-sm);
}

.category-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.category-btn {
    height: 26px;
    padding: 0 10px;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    border-radius: 6px;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background-color: rgba(15, 23, 42, 0.28);
    color: var(--color-text-secondary);
    cursor: pointer;
    white-space: nowrap;
    transition:
        border-color var(--transition-fast),
        background-color var(--transition-fast),
        color var(--transition-fast);
}

.category-btn:hover {
    border-color: rgba(47, 125, 244, 0.34);
    background-color: rgba(18, 27, 42, 0.74);
    color: var(--color-text-primary);
}

.category-btn.active {
    background-color: rgba(47, 125, 244, 0.18);
    color: #d7e8ff;
    border-color: rgba(47, 125, 244, 0.58);
}

.component-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    gap: var(--left-panel-list-gap);
    padding-bottom: var(--left-panel-content-padding);
    scrollbar-gutter: stable;
}

.empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-height: 180px;
    padding: 0 var(--space-3) var(--left-panel-content-padding);
    text-align: center;
}

.empty-text {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
}

.component-card {
    display: flex;
    min-height: var(--left-panel-card-min-height);
    padding: var(--left-panel-card-padding);
    border-radius: var(--left-panel-card-radius);
    border: 1px solid var(--left-panel-card-border);
    background-color: var(--left-panel-card-bg);
    cursor: pointer;
    user-select: none;
    transition:
        border-color var(--transition-fast),
        background-color var(--transition-fast),
        transform var(--transition-fast);
}

.component-card:hover {
    border-color: var(--left-panel-card-border-hover);
    background-color: var(--left-panel-card-bg-hover);
}

.component-card:active {
    transform: translateY(0) scale(0.99);
}

.component-card.disabled {
    opacity: 0.72;
    cursor: not-allowed;
}

.component-card.disabled:hover {
    border-color: var(--left-panel-card-border);
    background-color: var(--left-panel-card-bg);
    transform: none;
    box-shadow: none;
}

.component-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.component-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
}

.component-name {
    min-width: 0;
    overflow: hidden;
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.exists-badge {
    flex: 0 0 auto;
    font-size: 10px;
    line-height: 1;
    padding: 3px 6px;
    background-color: rgba(245, 158, 11, 0.2);
    color: #f7c56b;
    border: 1px solid rgba(245, 158, 11, 0.26);
    border-radius: 999px;
    font-weight: var(--font-weight-semibold);
}

.component-desc {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    margin-top: 4px;
    line-height: 1.45;
    display: -webkit-box;
    overflow: hidden;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

.component-meta-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    margin-top: 6px;
}

.component-category,
.component-type {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    line-height: 1;
}

.component-category {
    color: #9ec7ff;
}

.component-type {
    min-width: 0;
    overflow: hidden;
    color: var(--color-text-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>

