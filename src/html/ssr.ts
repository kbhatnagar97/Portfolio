import { createServer, type PluginOption } from 'vite';

export type TLoad = (url: string) => Promise<Record<string, unknown>>;

// Build time only. The server resolves TS, JSON and ?raw imports the way the browser build does, and always closes.
export const withSsr = async <T>(root: string, plugins: PluginOption[], run: (load: TLoad) => Promise<T>): Promise<T> => {
  const server = await createServer({
    root,
    configFile: false,
    plugins,
    appType: 'custom',
    mode: 'production',
    logLevel: 'error',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  try {
    return await run((url) => server.ssrLoadModule(url));
  } finally {
    await server.close();
  }
};
