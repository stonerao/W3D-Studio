const parseErrorMessage = async (response) => {
    try {
        const data = await response.json();
        return data?.error || data?.message || response.statusText;
    } catch {
        return response.statusText;
    }
};

export const chatWithAI = async ({ message, history, context, provider, locale }) => {
    const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message,
            history,
            context,
            provider,
            locale
        })
    });

    if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
    }

    return response.json();
};

export const fetchAIHealth = async () => {
    const response = await fetch('/api/ai/health');
    if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
    }
    return response.json();
};
