const fs = require('fs');
const https = require('https');
const path = require('path');

const images = [
    {
        url: 'https://aboutface.com/cdn/shop/products/Cherry-Pick_Component_Swatch_0002_THE-CRANBERRIES-CAP-ON_1.png?v=1677263169',
        dest: 'public/images/hero-product-2.png'
    },
    {
        url: 'https://aboutface.com/cdn/shop/products/MFEP-Minis__0014_Blue-Monday-Shot-2.png?v=1677802576&width=1000',
        dest: 'public/images/hero-product-3.png'
    },
    {
        url: 'https://aboutface.com/cdn/shop/files/AF_CheekFreak_GetSome_Open_Web.png?v=1719253456&width=1000',
        dest: 'public/images/hero-product-4.png'
    },
    {
        url: 'https://aboutface.com/cdn/shop/products/LLHF-Shaken-or-Stirred-Shot-1.png?v=1630101035&width=1000',
        dest: 'public/images/hero-product-5.png'
    }
];

const downloadImage = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        };

        https.get(url, options, (response) => {
            // Handle redirects
            if (response.statusCode === 301 || response.statusCode === 302) {
                console.log(`Redirecting to ${response.headers.location}`);
                downloadImage(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
                return;
            }

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log(`Downloaded ${dest}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
};

(async () => {
    try {
        for (const image of images) {
            console.log(`Downloading ${image.dest}...`);
            await downloadImage(image.url, image.dest);
        }
        console.log('All downloads completed.');
    } catch (error) {
        console.error('Error downloading images:', error);
        process.exit(1);
    }
})();
