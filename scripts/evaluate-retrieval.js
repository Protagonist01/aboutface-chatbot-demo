import 'dotenv/config';

import { retrieveContext } from '../rag-engine.js';

const cases = [
    ['who founded about-face?', ['Halsey']],
    ['when did about-face launch?', ['January 25, 2021']],
    ['what does the name about-face mean?', ["change one's direction"]],
    ['are the products vegan?', ['100%', 'vegan']],
    ['is the makeup cruelty free?', ['never tested on animals']],
    ['what are the best sellers?', ['Matte Fluid Eye Paint', 'fan-favorite']],
    ['can i use matte fluid eye paint as eyeliner?', ['eyeliner']],
    ['how many foundation shades are available?', ['45 shades']],
    ['how many concealer shades are available?', ['32 shades']],
    ['what undertones do you offer?', ['Cool', 'Neutral', 'Warm', 'Olive', 'Peach']],
    ['how much do i need for free shipping?', ['$45']],
    ['how long does shipping take?', ['5-7 business days']],
    ['do you ship internationally?', ['suspended']],
    ['where can i buy about-face?', ['Ulta']],
    ['what is the return policy?', ['30-day', 'refund']],
    ['can i return used products?', ['unused']],
    ['how do i start a return?', ['returns.aboutface.com']],
    ['does about-face have rewards?', ['Subscribe & Save', '10%']],
    ['is there a welcome discount?', ['15%']],
    ['can i use multiple discount codes?', ['one discount code']],
    ['how do i contact customer support?', ['help@aboutface.com']],
];

let failures = 0;

for (const [query, expected] of cases) {
    const records = await retrieveContext(query);
    const retrievedText = records.map((record) => record.text).join('\n');
    const missing = expected.filter((term) => !retrievedText.toLowerCase().includes(term.toLowerCase()));

    if (missing.length === 0) {
        console.log(`PASS  ${query}`);
    } else {
        failures += 1;
        console.error(`FAIL  ${query}`);
        console.error(`      missing: ${missing.join(', ')}`);
        console.error(`      titles: ${records.map((record) => record.title).join(' | ')}`);
    }
}

console.log(`\n${cases.length - failures}/${cases.length} retrieval checks passed.`);
if (failures > 0) process.exitCode = 1;
