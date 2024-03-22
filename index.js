//Carrega arquivo de configuração
require("dotenv").config();
//Carregar express que é uma função para criar o servidor
const express = require("express");

//Cria o servidor
const app = express();

app.use(express.json());

app.use('/comprar', async (req, res, next) => { 
    console.log(req.originalUrl);
    console.log(req.body);
    
    //Tamanho da ordem COMPRA
    const order = await newOrder("0.01", "BUY");
    console.log(order);
    res.json(order);
})

app.use('/vender', async (req, res, next) => { 
    console.log(req.originalUrl);
    console.log(req.body);
     
    //Tamanho da ordem VENDA
    const order = await newOrder("0.01", "SELL");
    console.log(order);
    res.json(order);

})

app.use('/', (req, res, next) => { 
    console.log("Hello World");
    res.send(`Hello World`);    
})

//Inicializar a aplicação e traz o valor setado em PORT do arquivo .env
app.listen(process.env.PORT, () => {
    console.log("Server started at " + process.env.PORT);
});


//aqui começa o codigo para envio de ordens a binance
const axios = require('axios');
const crypto = require('crypto');

async function newOrder(quantity, side) {
    const data = {
        symbol: process.env.SYMBOL,
        side,
        type: 'MARKET',
        quantity,
        timestamp: Date.now(),
        recvWindow: 60000//máximo permitido, default 5000
    };

    const signature = crypto
        .createHmac('sha256', process.env.SECRET_KEY)
        .update(`${new URLSearchParams(data)}`)
        .digest('hex');

    const newData = { ...data, signature };
    const qs = `?${new URLSearchParams(newData)}`;

    try {
        const result = await axios({
            method: 'POST',
            url: `${process.env.API_URL}/v3/order${qs}`,
            headers: { 'X-MBX-APIKEY': process.env.API_KEY }
        });
        console.log(result.data);
    } catch (err) {
        console.error(err);
    }
}