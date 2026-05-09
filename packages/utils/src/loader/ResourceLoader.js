/**
 * English comment.
 */
export class ResourceLoader {
    /**
     * English comment.
     */
    static async loadJSON(url) {
        const response = await fetch(url);
        return response.json();
    }

    /**
     * English comment.
     */
    static async loadText(url) {
        const response = await fetch(url);
        return response.text();
    }

    /**
     * English comment.
     */
    static loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }
}

export default ResourceLoader;
