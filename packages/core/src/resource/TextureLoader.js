import * as THREE from 'three';

/**
 * English comment.
 */
export class TextureLoader {
    /**
     * English comment.
     */
    constructor(indexedDBCache = null) {
        this.loader = new THREE.TextureLoader();
        this.cache = indexedDBCache;
    }

    /**
     * English comment.
     */
    async load(url, onProgress) {
        // English comment.
        if (this.cache) {
            const cachedData = await this.cache.get(url);
            if (cachedData) {
                return this._loadFromCache(url, cachedData, onProgress);
            }
        }

        // English comment.
        return new Promise((resolve, reject) => {
            this.loader.load(
                url,
                async (texture) => {
                    // English comment.
                    if (this.cache) {
                        await this._cacheTexture(url);
                    }
                    resolve(texture);
                },
                (progress) => {
                    if (onProgress) {
                        const percent = progress.loaded / progress.total;
                        onProgress(percent);
                    }
                },
                (error) => {
                    reject(error);
                }
            );
        });
    }

    /**
     * English comment.
     */
    async loadMultiple(urls, onProgress) {
        const textures = [];
        let loaded = 0;

        for (const url of urls) {
            const texture = await this.load(url, (progress) => {
                const totalProgress = (loaded + progress) / urls.length;
                if (onProgress) {
                    onProgress(totalProgress);
                }
            });

            textures.push(texture);
            loaded++;
        }

        return textures;
    }

    /**
     * English comment.
     */
    async _loadFromCache(url, cachedData, onProgress) {
        // English comment.
        if (onProgress) {
            onProgress(1);
        }

        // English comment.
        const blob = new Blob([cachedData]);
        const objectURL = URL.createObjectURL(blob);

        return new Promise((resolve, reject) => {
            this.loader.load(
                objectURL,
                (texture) => {
                    // English comment.
                    URL.revokeObjectURL(objectURL);
                    resolve(texture);
                },
                undefined,
                (error) => {
                    URL.revokeObjectURL(objectURL);
                    reject(new Error(`纹理解析失败: ${error.message}`));
                }
            );
        });
    }

    /**
     * English comment.
     */
    async _cacheTexture(url) {
        try {
            // English comment.
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            await this.cache.set(url, arrayBuffer, 'texture');
        } catch (error) {
            // English comment.
            console.warn(`Failed to cache texture: ${url}`, error);
        }
    }
}
