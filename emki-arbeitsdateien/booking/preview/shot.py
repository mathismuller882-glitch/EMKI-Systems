import asyncio, glob, os
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for f in sorted(glob.glob('*.html')):
            for name, w in [('d', 720), ('m', 390)]:
                pg = await b.new_page(viewport={'width': w, 'height': 900})
                await pg.goto('file://' + os.path.abspath(f))
                await pg.screenshot(path=f'{f[:-5]}_{name}.png', full_page=True)
                await pg.close()
        await b.close()
asyncio.run(main())
