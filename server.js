import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import express from 'express';

const PORT = process.env.PORT || 5001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const absolutePath = (p) => path.resolve(__dirname, p);

const isDev = process.env.NODE_ENV === 'development';

export async function createServer(root = process.cwd(), hmrPort) {
    const indexProd = isDev
        ? ''
        : fs.readFileSync(absolutePath('dist/client/index.html'), 'utf-8')

    const app = express()
    let vite;
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

    app.all('*', async (req, res) => {
        const url = req.originalUrl;

        const template = isDev
            ? (await vite.transformIndexHtml(url, fs.readFileSync(absolutePath('index.html'), 'utf-8')))
            : indexProd;

        const render = isDev
            ? (await vite.ssrLoadModule('/src/entry-server.jsx')).render
            : (await import('./dist/server/entry-server.js')).render;

        const context = {};
        const appHtml = render(url, context);
        if (context.url) return res.redirect(301, context.url);
        const html = template.replace(`<!--ssr-outlet-->`, appHtml);
        res.status(200).set({'Content-Type': 'text/html'}).end(html);
    })
    app.use((err, req, res, next) => {
        console.error(err.stack)
        res.status(500).send({
            message: err.message,
            stack: isDev ? err.stack : undefined,
        })
    })
    return {app, port: PORT}
}

createServer().then(({app, port}) =>
    app.listen(port, () => {
        console.log(
            `Server running at http://localhost:${port}/`,
        )
    }),
)
