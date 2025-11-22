import fs from 'node:fs';
export function addServerToConfigs(id, source) {
    const cfgPath = 'config/mcp-config.json';
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    cfg.mcpServers[id] = cfg.mcpServers[id] || { command: 'npx', args: ['-y', id], metadata: { source } };
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
}
//# sourceMappingURL=config-generator.js.map