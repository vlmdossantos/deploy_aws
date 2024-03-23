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
    let profit = 0;

    if (side === 'SELL' && lastBuyPrice != null) {
        profit = (latestPrice - lastBuyPrice) * quantity;
    }

    if (side === 'BUY') {
        lastBuyPrice = latestPrice;
    } else if (side === 'SELL') {
        // Reset last buy price after selling
        lastBuyPrice = null;
    }

    const trade = { time: new Date(), side, quantity, price: latestPrice, profit: profit };

    // Only log trades when a sale is made or a purchase (to track next sale)
    if (side === 'SELL' || lastBuyPrice != null) {
        trades.push(trade);
        fs.appendFileSync(logFile, JSON.stringify(trade) + '\n');
    }
}

async function checkMarketAndScalp() {
    const prices = await getPrices();
    const smaShort = SMA.calculate({ period: 5, values: prices });
    const smaLong = SMA.calculate({ period: 10, values: prices });

    const latestPrice = prices[prices.length - 1];
    const latestShortSMA = smaShort[smaShort.length - 1];
    const latestLongSMA = smaLong[smaLong.length - 1];

    if (latestShortSMA > latestLongSMA && lastBuyPrice == null) {
        console.log("Estratégia Scalping: COMPRA");
        await newOrder("0.01", "BUY", latestPrice);
    } else if (latestShortSMA < latestLongSMA && lastBuyPrice != null) {
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
