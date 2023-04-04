import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import express from 'express';

const port = process.env.PORT || 5001;

export async function createServer(
  root = process.cwd(),
  isDev = process.env.NODE_ENV === 'development',
  hmrPort,
) {
  const dirname = path.dirname(fileURLToPath(import.meta.url))
  const absolutePath = (p) => path.resolve(dirname, p)

  const indexProd = isDev
    ? ''
    : fs.readFileSync(absolutePath('dist/client/index.html'), 'utf-8')

  const app = express()
  let vite
  if (isDev) {
    vite = await (
      await import('vite')
    ).createServer({
      root,
      logLevel: 'info',
      server: {
        middlewareMode: true,
        watch: {
          usePolling: true,
          interval: 100,
        },
        hmr: {
          port: hmrPort,
        },
      },
      appType: 'custom',
    })
    app.use(vite.middlewares)
  } else {
    app.use((await import('compression')).default())
    app.use(
      (await import('serve-static')).default(absolutePath('dist/client'), {
        index: false,
      }),
    )
  }

  app.use('*', async (req, res) => {
    try {
      const url = req.originalUrl;
      let template, render;
      if (isDev) {
        template = fs.readFileSync(absolutePath('index.html'), 'utf-8')
        template = await vite.transformIndexHtml(url, template);
        render = (await vite.ssrLoadModule('/src/entry-server.jsx')).render;
      } else {
        template = indexProd;
        render = (await import('./dist/server/entry-server.js')).render;
      }
      const context = {};
      const appHtml = render(url, context);

      if (context.url) return res.redirect(301, context.url);
      const html = template.replace(`<!--ssr-outlet-->`, appHtml);
      res.status(200).set({'Content-Type': 'text/html'}).end(html);
    } catch (e) {
      isDev && vite.ssrFixStacktrace(e)
      console.log(e.stack)
      res.status(500).end(e.stack)
    }
  })
  return {app}
}

createServer().then(({app}) =>
  app.listen(port, () => {
    console.log(
      `Server running at http://localhost:${port}/`,
    )
  }),
)
