/**
 * English comment.
 */

/**
 * English comment.
 */
export const ValidatorTypes = {
    REQUIRED: 'required',
    TYPE: 'type',
    MIN: 'min',
    MAX: 'max',
    PATTERN: 'pattern',
    ENUM: 'enum',
    CUSTOM: 'custom'
};

/**
 * English comment.
 */
export const DataTypes = {
    STRING: 'string',
    NUMBER: 'number',
    BOOLEAN: 'boolean',
    ARRAY: 'array',
    OBJECT: 'object',
    FUNCTION: 'function'
};

/**
 * English comment.
 */
class ValidationResult {
    constructor() {
        this.valid = true;
        this.errors = [];
    }

    addError(field, message) {
        this.valid = false;
        this.errors.push({ field, message });
    }

    getErrors() {
        return this.errors;
    }

    isValid() {
        return this.valid;
    }
}

/**
 * English comment.
 */
export class Validator {
    /**
     * English comment.
     */
    static validate(data, schema) {
        const result = new ValidationResult();

        for (const [field, rules] of Object.entries(schema)) {
            const value = data[field];

            // English comment.
            if (rules.required && (value === undefined || value === null || value === '')) {
                result.addError(field, `${rules.label || field} 是必填项`);
                continue;
            }

            // English comment.
            if (value === undefined || value === null || value === '') {
                continue;
            }

            // English comment.
            if (rules.type) {
                if (!this.validateType(value, rules.type)) {
                    result.addError(field, `${rules.label || field} 类型错误，期望 ${rules.type}`);
                    continue;
                }
            }

            // English comment.
            if (rules.min !== undefined) {
                if (typeof value === 'number' && value < rules.min) {
                    result.addError(field, `${rules.label || field} 不能小于 ${rules.min}`);
                }
                if (typeof value === 'string' && value.length < rules.min) {
                    result.addError(field, `${rules.label || field} 长度不能小于 ${rules.min}`);
                }
                if (Array.isArray(value) && value.length < rules.min) {
                    result.addError(field, `${rules.label || field} 数量不能小于 ${rules.min}`);
                }
            }

            // English comment.
            if (rules.max !== undefined) {
                if (typeof value === 'number' && value > rules.max) {
                    result.addError(field, `${rules.label || field} 不能大于 ${rules.max}`);
                }
                if (typeof value === 'string' && value.length > rules.max) {
                    result.addError(field, `${rules.label || field} 长度不能大于 ${rules.max}`);
                }
                if (Array.isArray(value) && value.length > rules.max) {
                    result.addError(field, `${rules.label || field} 数量不能大于 ${rules.max}`);
                }
            }

            // English comment.
            if (rules.pattern && typeof value === 'string') {
                const regex = new RegExp(rules.pattern);
                if (!regex.test(value)) {
                    result.addError(field, `${rules.label || field} 格式不正确`);
                }
            }

            // English comment.
            if (rules.enum && Array.isArray(rules.enum)) {
                if (!rules.enum.includes(value)) {
                    result.addError(field, `${rules.label || field} 必须是以下值之一: ${rules.enum.join(', ')}`);
                }
            }

            // English comment.
            if (rules.validator && typeof rules.validator === 'function') {
                const customResult = rules.validator(value, data);
                if (customResult !== true) {
                    result.addError(field, customResult || `${rules.label || field} 验证失败`);
                }
            }
        }

        return result;
    }

    /**
     * English comment.
     */
    static validateType(value, type) {
        switch (type) {
            case DataTypes.STRING:
                return typeof value === 'string';
            case DataTypes.NUMBER:
                return typeof value === 'number' && !isNaN(value);
            case DataTypes.BOOLEAN:
                return typeof value === 'boolean';
            case DataTypes.ARRAY:
                return Array.isArray(value);
            case DataTypes.OBJECT:
                return typeof value === 'object' && value !== null && !Array.isArray(value);
            case DataTypes.FUNCTION:
                return typeof value === 'function';
            default:
                return true;
        }
    }

    /**
     * English comment.
     */
    static validateComponentConfig(config, configSchema) {
        const schema = {};

        // English comment.
        for (const field of configSchema) {
            schema[field.key] = {
                label: field.label,
                required: field.required || false,
                type: this.mapFieldTypeToDataType(field.type),
                min: field.min,
                max: field.max,
                pattern: field.pattern,
                enum: field.options?.map((opt) => opt.value),
                validator: field.validator
            };
        }

        return this.validate(config, schema);
    }

    /**
     * English comment.
     */
    static mapFieldTypeToDataType(fieldType) {
        const typeMap = {
            text: DataTypes.STRING,
            number: DataTypes.NUMBER,
            boolean: DataTypes.BOOLEAN,
            select: DataTypes.STRING,
            color: DataTypes.STRING,
            vector3: DataTypes.ARRAY
        };
        return typeMap[fieldType] || null;
    }

    /**
     * English comment.
     */
    static isValidURL(url) {
        if (!url || typeof url !== 'string') return false;

        // English comment.
        if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
            return true;
        }

        // English comment.
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * English comment.
     */
    static isValidColor(color) {
        if (!color || typeof color !== 'string') return false;

        // English comment.
        const hexPattern = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
        const rgbPattern = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/;
        const rgbaPattern = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/;

        return hexPattern.test(color) || rgbPattern.test(color) || rgbaPattern.test(color);
    }

    /**
     * English comment.
     */
    static isValidVector3(vector) {
        return (
            Array.isArray(vector) &&
            vector.length === 3 &&
            vector.every((v) => typeof v === 'number' && !isNaN(v))
        );
    }
}

/**
 * English comment.
 */
export const validate = (data, schema) => Validator.validate(data, schema);
export const validateComponentConfig = (config, configSchema) =>
    Validator.validateComponentConfig(config, configSchema);
export const isValidURL = (url) => Validator.isValidURL(url);
export const isValidColor = (color) => Validator.isValidColor(color);
export const isValidVector3 = (vector) => Validator.isValidVector3(vector);

