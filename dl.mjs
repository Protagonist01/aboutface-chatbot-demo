import { writeFile } from 'fs/promises';

const images = [
    ['https://aboutface.com/cdn/shop/products/Cherry-Pick_Component_Swatch_0002_THE-CRANBERRIES-CAP-ON_1.png?v=1677263169', 'public/images/hero-product-2.png'],
    ['https://aboutface.com/cdn/shop/products/MFEP-Minis__0014_Blue-Monday-Shot-2.png?v=1677802576&width=1000', 'public/images/hero-product-3.png'],
    ['https://aboutface.com/cdn/shop/products/LLHF-Shaken-or-Stirred-Shot-1.png?v=1630101035&width=1000', 'public/images/hero-product-5.png'],
];

for (const [url, dest] of images) {
    console.log(`Downloading ${dest}...`);
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' }
        });
        if (!res.ok) { console.error(`  FAILED: ${res.status} ${res.statusText}`); continue; }
        const buf = Buffer.from(await res.arrayBuffer());
        await writeFile(dest, buf);
        console.log(`  OK — ${buf.length} bytes`);
    } catch (e) {
        console.error(`  ERROR: ${e.message}`);
    }
}
console.log('Done.');
