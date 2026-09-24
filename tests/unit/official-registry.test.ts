import { describe, expect, test } from '@jest/globals';
import { browseOfficialRegistry, getServerDetails, searchOfficialRegistry } from '../../src/discovery/official-registry.js';

const entry = {
  server: {
    name: 'example.org/weather',
    title: 'Weather',
    description: 'Weather observations',
    version: '2.1.0',
    repository: { url: 'https://github.com/example/weather' },
    remotes: [{ type: 'streamable-http', url: 'https://example.org/mcp' }],
    packages: [{ transport: { type: 'stdio' }, identifier: 'example-weather' }]
  },
  _meta: {
    'io.modelcontextprotocol.registry/official': {
      status: 'active',
      updatedAt: '2026-09-01T00:00:00Z'
    }
  }
};

describe('official MCP Registry', () => {
  test('uses the versioned API, cursor, and server-name filter', async () => {
    let requestedUrl = '';
    const page = await browseOfficialRegistry(
      { search: 'weather', cursor: 'previous:1', limit: 2 },
      async (url) => {
        requestedUrl = url;
        return new Response(JSON.stringify({
          servers: [entry],
          metadata: { nextCursor: 'next:2', count: 1 }
        }), { status: 200 });
      }
    );

    const url = new URL(requestedUrl);
    expect(url.origin + url.pathname).toBe('https://registry.modelcontextprotocol.io/v0.1/servers');
    expect(url.searchParams.get('version')).toBe('latest');
    expect(url.searchParams.get('search')).toBe('weather');
    expect(url.searchParams.get('cursor')).toBe('previous:1');
    expect(url.searchParams.get('limit')).toBe('2');
    expect(page.nextCursor).toBe('next:2');
    expect(page.entries).toEqual([{
      id: 'example.org/weather',
      kind: 'mcp_server',
      name: 'Weather',
      description: 'Weather observations',
      version: '2.1.0',
      repository: 'https://github.com/example/weather',
      transportTypes: ['streamable-http', 'stdio'],
      status: 'active',
      updatedAt: '2026-09-01T00:00:00Z',
      source: 'official-mcp-registry',
      availability: 'discoverable'
    }]);
  });

  test('rejects malformed pages instead of claiming the catalog is empty', async () => {
    await expect(browseOfficialRegistry({}, async () => new Response('{}')))
      .rejects.toThrow('invalid server page');
  });

  test('does not send a request for an invalid page size', async () => {
    await expect(browseOfficialRegistry({ limit: 101 }, async () => {
      throw new Error('request must not run');
    })).rejects.toThrow('between 1 and 100');
  });

  test('reports upstream failures without exposing network details', async () => {
    await expect(browseOfficialRegistry({}, async () => {
      throw new Error('private network detail');
    })).rejects.toThrow('unavailable; retry later');
  });

  test('name search does not return fabricated package or capability claims', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ servers: [entry], metadata: {} }));
    try {
      const results = await searchOfficialRegistry({ toolName: 'weather' });
      expect(results).toHaveLength(1);
      expect(results[0].npmPackage).toBeUndefined();
      expect(results[0].capabilities).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('fetches a server detail by encoded name and preserves a 404', async () => {
    let requestedUrl = '';
    const found = await getServerDetails('example.org/weather', async (url) => {
      requestedUrl = url;
      return new Response(JSON.stringify(entry));
    });
    expect(requestedUrl).toContain('example.org%2Fweather/versions/latest');
    expect(found?.id).toBe('example.org/weather');
    expect(await getServerDetails('example.org/missing', async () =>
      new Response('', { status: 404 }))).toBeNull();
  });
});
