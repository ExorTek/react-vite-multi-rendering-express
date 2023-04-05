import fs from 'fs'
import path from 'path'
import {fileURLToPath} from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const absolutePath = (p) => path.resolve(__dirname, p)

const template = fs.readFileSync(absolutePath('dist/client/index.html'), 'utf-8')
const {render} = await import('./dist/server/entry-server.js')

const routesToPrerender = fs
    .readdirSync(absolutePath('src/pages'))
    .map((file) => {
        const name = file.replace(/\.jsx$/, '').toLowerCase()
        return name === 'home' ? `/` : `/${name}`
    });

(async () => {
    for (const url of routesToPrerender) {
        const context = {}
        const appHtml = render(url, context)
        const html = template.replace(`<!--ssr-outlet-->`, appHtml)
        const filePath = `dist/client${url === '/' ? '/index' : url}.html`
        fs.writeFileSync(absolutePath(filePath), html)
        console.log('pre-rendered:', filePath)
    }
})()
