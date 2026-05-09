/**
 * English comment.
 */
export class IndexedDBCache {
    /**
     * English comment.
     */
    constructor(config = {}) {
        this.config = {
            enabled: true,
            dbName: 'W3DCache',
            storeName: 'resources',
            debug: false,
            version: 1,
            ...config
        };

        this.db = null;
        this.isInitialized = false;
        this.initPromise = null;
    }

    /**
     * English comment.
     */
    async init() {
        if (!this.config.enabled) {
            this.log('IndexedDB caching is disabled');
            return;
        }

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this._initDB();
        return this.initPromise;
    }

    /**
     * English comment.
     */
    async _initDB() {
        if (!window.indexedDB) {
            console.warn('IndexedDB is not supported in this browser');
            this.config.enabled = false;
            return;
        }

        try {
            // English comment.
            await this._checkVersionChange();

            // English comment.
            this.db = await this._openDatabase();
            this.isInitialized = true;
            this.log('IndexedDB initialized successfully');
        } catch (error) {
            console.error('Failed to initialize IndexedDB:', error);
            this.config.enabled = false;
        }
    }

    /**
     * English comment.
     */
    async _checkVersionChange() {
        const storedVersion = localStorage.getItem(`${this.config.dbName}_version`);
        const currentVersion = this.config.version.toString();

        if (storedVersion && storedVersion !== currentVersion) {
            this.log(`Version changed from ${storedVersion} to ${currentVersion}, clearing cache`);
            await this._clearDatabase();
        }

        // English comment.
        localStorage.setItem(`${this.config.dbName}_version`, currentVersion);
    }

    /**
     * English comment.
     */
    async _clearDatabase() {
        return new Promise((resolve, reject) => {
            const deleteRequest = indexedDB.deleteDatabase(this.config.dbName);

            deleteRequest.onsuccess = () => {
                this.log('Database cleared successfully');
                resolve();
            };

            deleteRequest.onerror = () => {
                reject(new Error('Failed to clear database'));
            };

            deleteRequest.onblocked = () => {
                this.log('Database deletion blocked');
            };
        });
    }

    /**
     * English comment.
     */
    _openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.config.dbName, 1);

            request.onerror = () => {
                reject(new Error('Failed to open IndexedDB'));
            };

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // English comment.
                if (!db.objectStoreNames.contains(this.config.storeName)) {
                    const objectStore = db.createObjectStore(this.config.storeName, {
                        keyPath: 'url'
                    });

                    // English comment.
                    objectStore.createIndex('type', 'type', { unique: false });
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });

                    this.log('Object store created');
                }
            };
        });
    }

    /**
     * English comment.
     */
    async get(url) {
        if (!this.config.enabled || !this.isInitialized) {
            return null;
        }

        try {
            const transaction = this.db.transaction([this.config.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.config.storeName);
            const request = objectStore.get(url);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const result = request.result;
                    if (result) {
                        this.log(`Cache hit for: ${url}`);
                        resolve(result.data);
                    } else {
                        this.log(`Cache miss for: ${url}`);
                        resolve(null);
                    }
                };

                request.onerror = () => {
                    reject(new Error('Failed to get resource from cache'));
                };
            });
        } catch (error) {
            console.error('Error getting resource from cache:', error);
            return null;
        }
    }

    /**
     * English comment.
     */
    async set(url, data, type = 'unknown') {
        if (!this.config.enabled || !this.isInitialized) {
            return;
        }

        try {
            const transaction = this.db.transaction([this.config.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.config.storeName);

            const record = {
                url,
                data,
                type,
                timestamp: Date.now(),
                version: this.config.version
            };

            const request = objectStore.put(record);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    this.log(`Cached ${type}: ${url}`);
                    resolve();
                };

                request.onerror = () => {
                    reject(new Error('Failed to cache resource'));
                };
            });
        } catch (error) {
            console.error('Error caching resource:', error);
        }
    }

    /**
     * English comment.
     */
    async has(url) {
        if (!this.config.enabled || !this.isInitialized) {
            return false;
        }

        try {
            const data = await this.get(url);
            return data !== null;
        } catch (error) {
            return false;
        }
    }

    /**
     * English comment.
     */
    async delete(url) {
        if (!this.config.enabled || !this.isInitialized) {
            return;
        }

        try {
            const transaction = this.db.transaction([this.config.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.config.storeName);
            const request = objectStore.delete(url);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    this.log(`Deleted from cache: ${url}`);
                    resolve();
                };

                request.onerror = () => {
                    reject(new Error('Failed to delete resource from cache'));
                };
            });
        } catch (error) {
            console.error('Error deleting resource from cache:', error);
        }
    }

    /**
     * English comment.
     */
    async clear() {
        if (!this.config.enabled || !this.isInitialized) {
            return;
        }

        try {
            const transaction = this.db.transaction([this.config.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.config.storeName);
            const request = objectStore.clear();

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    this.log('All cache cleared');
                    resolve();
                };

                request.onerror = () => {
                    reject(new Error('Failed to clear cache'));
                };
            });
        } catch (error) {
            console.error('Error clearing cache:', error);
        }
    }

    /**
     * English comment.
     */
    async getStats() {
        if (!this.config.enabled || !this.isInitialized) {
            return { count: 0, size: 0 };
        }

        try {
            const transaction = this.db.transaction([this.config.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.config.storeName);
            const request = objectStore.getAll();

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const items = request.result;
                    const count = items.length;
                    const size = items.reduce((total, item) => {
                        return total + (item.data ? item.data.byteLength : 0);
                    }, 0);

                    resolve({ count, size });
                };

                request.onerror = () => {
                    reject(new Error('Failed to get cache stats'));
                };
            });
        } catch (error) {
            console.error('Error getting cache stats:', error);
            return { count: 0, size: 0 };
        }
    }

    /**
     * English comment.
     */
    log(message) {
        if (this.config.debug) {
            console.log(`[IndexedDBCache] ${message}`);
        }
    }

    /**
     * English comment.
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.isInitialized = false;
            this.log('Database connection closed');
        }
    }
}

