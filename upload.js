const fs = require('fs');
const https = require('https');
const FormData = require('form-data');

function upload(file) {
    const form = new FormData();
    form.append('key', '6d207e02198a847aa98d0a2a901485a5');
    form.append('action', 'upload');
    form.append('source', fs.createReadStream(file));
    const req = https.request({
        host: 'freeimage.host',
        path: '/api/1/upload',
        method: 'POST',
        headers: form.getHeaders()
    }, (res) => {
        let dt = '';
        res.on('data', d => dt += d);
        res.on('end', () => console.log(file, 'URL=', dt));
    });
    form.pipe(req);
}
upload('C:/Users/HP/.gemini/antigravity/brain/6606f11e-7b19-4399-a794-b95b6e579eba/media__1773023686653.png');
upload('C:/Users/HP/.gemini/antigravity/brain/6606f11e-7b19-4399-a794-b95b6e579eba/media__1773023984013.png');
