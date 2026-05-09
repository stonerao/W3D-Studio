import { ModelLoader } from './ModelLoader.js';
import { TextureLoader } from './TextureLoader.js';

/**
 * English comment.
 */
export class LoaderManager {
    /**
     * English comment.
     */
    constructor(indexedDBCache = null, options = {}) {
        this.indexedDBCache = indexedDBCache;
        this.options = options;

        // English comment.
        this._modelLoader = null;
        this._textureLoader = null;

        // English comment.
        this._dracoDecoderPath = options.dracoDecoderPath || '/draco/';
    }

    /**
     * English comment.
     */
    getModelLoader() {
        if (!this._modelLoader) {
            // English comment.
            // English comment.
            // English comment.
            // English comment.
            this._modelLoader = new ModelLoader(this.indexedDBCache, {
                dracoDecoderPath: this._dracoDecoderPath
            });

            if (
                typeof this._dracoDecoderPath === 'string' &&
                typeof this._modelLoader.setDracoDecoderPath === 'function'
            ) {
                this._modelLoader.setDracoDecoderPath(this._dracoDecoderPath);
            }
        }
        return this._modelLoader;
    }

    /**
     * English comment.
     */
    getTextureLoader() {
        if (!this._textureLoader) {
            this._textureLoader = new TextureLoader(this.indexedDBCache);
        }
        return this._textureLoader;
    }

    /**
     * English comment.
     */
    setDracoDecoderPath(path) {
        this._dracoDecoderPath = path;

        // English comment.
        if (this._modelLoader) {
            this._modelLoader.setDracoDecoderPath(path);
        }
    }

    /**
     * English comment.
     */
    getDracoDecoderPath() {
        return this._dracoDecoderPath;
    }

    /**
     * English comment.
     */
    async preloadDraco() {
        const modelLoader = this.getModelLoader();
        return modelLoader.preloadDraco();
    }

    /**
     * English comment.
     */
    setIndexedDBCache(indexedDBCache) {
        this.indexedDBCache = indexedDBCache;

        // English comment.
        if (this._modelLoader) {
            this._modelLoader.cache = indexedDBCache;
        }
        if (this._textureLoader) {
            this._textureLoader.cache = indexedDBCache;
        }
    }

    /**
     * English comment.
     */
    dispose() {
        if (this._modelLoader) {
            // English comment.
            if (typeof this._modelLoader.dispose === 'function') {
                this._modelLoader.dispose();
            }
            this._modelLoader = null;
        }

        if (this._textureLoader) {
            this._textureLoader = null;
        }
    }
}

export default LoaderManager;
