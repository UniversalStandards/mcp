export async function normalizeRequest(_provider, _model, original) {
    // TODO: implement with selected provider; stub returns passthrough
    return { method: 'tools/call', params: original?.params ?? {}, intent: 'passthrough', confidence: 0.5 };
}
//# sourceMappingURL=ai-client.js.map