const http = require('http');

const options = {
    hostname: 'localhost',
    port: 9000,
    path: '/store/products?region_id=reg_01KJGNNB7F58NMWSGDHYTHGR0Q',
    method: 'GET',
    headers: {
        'x-publishable-api-key': 'pk_9f814f01f0d29d23cadc137e19b89a0a1f97eceae91382099074319f94df3549'
    }
};

const req = http.request(options, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        try {
            const data = JSON.parse(body);
            const lamour = data.products.find(p => p.title.includes('Amour Dress'));
            if (lamour) {
                require('fs').writeFileSync('lamour2.json', JSON.stringify(lamour, null, 2));
            } else {
                console.log('not found');
            }
        } catch (e) { console.error(e); }
    });
});

req.on('error', e => console.error(e));
req.end();
