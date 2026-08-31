const http = require('http');
http.get('http://localhost:9000/store/products?fields=*variants,*variants.prices', {
    headers: {
        'x-publishable-api-key': 'pk_9f814f01f0d29d23cadc137e19b89a0a1f97eceae91382099074319f94df3549'
    }
}, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        require('fs').writeFileSync('prices.json', data);
        console.log('done');
    });
});
