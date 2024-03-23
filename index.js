require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { SMA } = require('technicalindicators');
const fs = require('fs');
const basicAuth = require('express-basic-auth');
const json2xls = require('json2xls');
const path = require('path');


const app = express();
app.use(express.json());

const symbol = process.env.SYMBOL;
const apiURL = process.env.API_URL;
const logFile = 'scalping_data.log';

// Função para customizar a mensagem de falha de autenticação
const getUnauthorizedResponse = req => 'Credenciais incorretas';

// Middleware de autenticação básica
app.use('/resultado', basicAuth({
    users: { [process.env.BASIC_AUTH_USER]: process.env.BASIC_AUTH_PASSWORD },
    challenge: true,
    unauthorizedResponse: getUnauthorizedResponse
}));

// Rota para exibir o conteúdo do log
app.get('/resultado', (req, res) => {
    fs.readFile(logFile, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Erro ao ler o arquivo de log.');
        }

        const trades = data
            .split('\n')
            .filter(line => line && JSON.parse(line).profit !== 0)
            .map(line => JSON.parse(line));

        let html = '<html><head><title>Resultados</title></head><body>';
        html += '<table border="1"><tr><th>Time</th><th>Side</th><th>Quantity</th><th>Price</th><th>Profit</th></tr>';

        trades.forEach(trade => {
            html += `<tr><td>${trade.time}</td><td>${trade.side}</td><td>${trade.quantity}</td><td>${trade.price}</td><td>${trade.profit.toFixed(2)}</td></tr>`;
        });

        html += '</table>';

        // Gerar link para download do XLS
        const xls = json2xls(trades);
        const filePath = path.join(__dirname, 'trades.xlsx');
        fs.writeFileSync(filePath, xls, 'binary');
        html += `<a href="/download">Baixar XLS</a>`;

        html += '</body></html>';
        res.send(html);
    });
});

// Rota para download do XLS
app.get('/download', (req, res) => {
    const filePath = path.join(__dirname, 'trades.xlsx');
    res.download(filePath);
});


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
        lastBuyPrice = null;
    }
    const trade = { time: new Date(), side, quantity, price: latestPrice, profit: profit };
    trades.push(trade);
    fs.appendFileSync(logFile, JSON.stringify(trade) + '\n');
}

async function checkMarketAndScalp() {
    const prices = await getPrices();
    const smaShort = SMA.calculate({ period: 5, values: prices });
    const smaLong = SMA.calculate({ period: 10, values: prices });
    const latestPrice = prices[prices.length - 1];
    const latestShortSMA = smaShort[smaShort.length - 1];
    const latestLongSMA = smaLong[smaLong.length - 1];
    if (latestShortSMA > latestLongSMA && lastBuyPrice == null) {
        await newOrder("0.01", "BUY", latestPrice);
    } else if (latestShortSMA < latestLongSMA && lastBuyPrice != null) {
        await newOrder("0.01", "SELL", latestPrice);
    }
}

app.get('/check', async (req, res) => {
    await checkMarketAndScalp();
    res.send('Verificação de mercado e operações de scalping executadas.');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Servidor iniciado na porta ${port}`);
    setInterval(checkMarketAndScalp, 1000);
});
