import { exec as _exec } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(_exec);
export async function npmInstall(serverId) {
    await exec(`npm install ${serverId} --prefix ./servers`);
}
//# sourceMappingURL=npm-installer.js.map