require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { SMA } = require('technicalindicators');
const fs = require('fs');

const app = express();
app.use(express.json());

const symbol = process.env.SYMBOL;
const apiURL = process.env.API_URL;
const logFile = 'scalping_data.log';

let currentPosition = null;
let lastBuyPrice = null;
let trades = [];

async function getPrices() {
    const response = await axios.get(`${apiURL}/v3/klines`, {
        params: {
            symbol: symbol,
            interval: '1m',
            limit: 10
        }
    });

    return response.data.map(kline => parseFloat(kline[4]));
}

async function newOrder(quantity, side, latestPrice) {
    const data = {
        symbol: symbol,
        side: side,
        type: 'MARKET',
        quantity: quantity,
        timestamp: Date.now(),
        recvWindow: 5000
    };

    const signature = crypto.createHmac('sha256', process.env.SECRET_KEY).update(new URLSearchParams(data).toString()).digest('hex');

    try {
        console.log(`Executando ordem: ${side} ${quantity} ${symbol}`);
        currentPosition = side;
        
        if (side === 'BUY') {
            lastBuyPrice = latestPrice;
        }
        
        const profit = side === 'SELL' && lastBuyPrice ? (latestPrice - lastBuyPrice) * quantity : 0;

        const trade = { time: new Date(), side: side, quantity: quantity, price: latestPrice, profit: profit };
        trades.push(trade);

        // Log trade information
        fs.appendFileSync(logFile, JSON.stringify(trade) + '\n');

    } catch (error) {
        console.error('Erro ao executar ordem:', error);
    }
}

async function checkMarketAndScalp() {
    const prices = await getPrices();
    const smaShort = SMA.calculate({ period: 5, values: prices });
    const smaLong = SMA.calculate({ period: 10, values: prices });

    const latestPrice = prices[prices.length - 1];
    const latestShortSMA = smaShort[smaShort.length - 1];
    const latestLongSMA = smaLong[smaLong.length - 1];

    console.log(`Último preço: ${latestPrice}, SMA Curto: ${latestShortSMA}, SMA Longo: ${latestLongSMA}`);

    if (latestShortSMA > latestLongSMA && currentPosition !== 'BUY') {
        console.log("Estratégia Scalping: COMPRA");
        await newOrder("0.01", "BUY", latestPrice);
    } else if (latestShortSMA < latestLongSMA && currentPosition !== 'SELL') {
        console.log("Estratégia Scalping: VENDA");
        await newOrder("0.01", "SELL", latestPrice);
    }
}

app.get('/check', async (req, res) => {
    await checkMarketAndScalp();
    res.send('Verificação de mercado e operações de scalping executadas.');
});

app.listen(process.env.PORT, () => {
    console.log(`Servidor iniciado na porta ${process.env.PORT}`);
    setInterval(checkMarketAndScalp, 1000);  // Execução a cada segundo
});
