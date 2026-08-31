const http = require('http');
http.get('http://localhost:9000/store/products?region_id=reg_01KJGNNB7F58NMWSGDHYTHGR0Q&fields=*categories,id,title,description,thumbnail,*variants,*variants.prices,*images,*collection', {
    headers: {
        'x-publishable-api-key': 'pk_9f814f01f0d29d23cadc137e19b89a0a1f97eceae91382099074319f94df3549'
    }
}, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        require('fs').writeFileSync('lamour.json', JSON.stringify(JSON.parse(data), null, 2));
        console.log('done');
    });
});
