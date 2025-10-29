import fetch from 'node-fetch';
export async function triggerInstallWorkflow(repo: string, token: string, serverId: string, source: string) {
  const [owner, name] = repo.split('/');
  const res = await fetch(`https://api.github.com/repos/${owner}/${name}/dispatches`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' },
    body: JSON.stringify({ event_type: 'install-mcp-server', client_payload: { server_id: serverId, source } })
  });
  if (!res.ok) throw new Error(`Dispatch failed: ${res.status}`);
}
