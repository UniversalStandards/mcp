export async function npmInstall(_serverId: string): Promise<never> {
  throw new Error('Automatic package installation is disabled; review and install adapters explicitly');
}
