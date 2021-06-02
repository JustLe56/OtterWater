const express = require('express');
const app = express();
require('dotenv').config()

console.log(process.env.MAPBOX_API_KEY);

app.get('/',(req, res) => {
    res.send('Hello world 2')
});

app.listen(3000, "127.0.0.1", () => {
    console.log('server started');
});