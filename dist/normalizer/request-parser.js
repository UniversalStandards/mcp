export function parseIncoming(body) {
    if (body && body.jsonrpc === '2.0')
        return body;
    // TODO: support non-standard inputs
    return { jsonrpc: '2.0', id: body.id ?? 1, method: body.method ?? 'tools/call', params: body.params ?? {} };
}
//# sourceMappingURL=request-parser.js.map