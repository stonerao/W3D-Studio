import { LogLevel } from './LogLevel.js';

/**
 * English comment.
 */
export class Logger {
    /**
     * English comment.
     */
    constructor(name = 'W3D', level = LogLevel.INFO) {
        this.name = name;
        this.level = level;
        this.enabled = true;
    }

    /**
     * English comment.
     */
    shouldLog(level) {
        if (!this.enabled) return false;

        const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
        return levels.indexOf(level) >= levels.indexOf(this.level);
    }

    /**
     * English comment.
     */
    format(level, ...args) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${this.name}] [${level}]`;
        return [prefix, ...args];
    }

    /**
     * English comment.
     */
    debug(...args) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.debug(...this.format(LogLevel.DEBUG, ...args));
        }
    }

    /**
     * English comment.
     */
    info(...args) {
        if (this.shouldLog(LogLevel.INFO)) {
            console.info(...this.format(LogLevel.INFO, ...args));
        }
    }

    /**
     * English comment.
     */
    warn(...args) {
        if (this.shouldLog(LogLevel.WARN)) {
            console.warn(...this.format(LogLevel.WARN, ...args));
        }
    }

    /**
     * English comment.
     */
    error(...args) {
        if (this.shouldLog(LogLevel.ERROR)) {
            console.error(...this.format(LogLevel.ERROR, ...args));
        }
    }

    /**
     * English comment.
     */
    setLevel(level) {
        this.level = level;
    }

    /**
     * English comment.
     */
    enable() {
        this.enabled = true;
    }

    /**
     * English comment.
     */
    disable() {
        this.enabled = false;
    }
}
