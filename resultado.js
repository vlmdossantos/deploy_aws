const express = require('express');
const fs = require('fs');
const path = require('path');
const basicAuth = require('express-basic-auth');
require('dotenv').config();

const app = express();
const logFilePath = path.join(__dirname, 'scalping_data.log');

// Configura a autenticação básica apenas para a rota /resultado
const users = {};
users[process.env.BASIC_AUTH_USER] = process.env.BASIC_AUTH_PASSWORD;

app.use('/resultado', basicAuth({
    users: users,
    challenge: true,
    unauthorizedResponse: (req) => 'Credenciais incorretas'
}));

app.get('/resultado', (req, res) => {
    fs.readFile(logFilePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Erro ao ler o arquivo de log.');
        }
        
        // Transforma cada linha do log em um objeto JSON e cria a tabela HTML
        const trades = data.split('\n').filter(line => line).map(line => JSON.parse(line));
        
        let html = '<html><head><title>Resultados</title></head><body>';
        html += '<table border="1"><tr><th>Time</th><th>Side</th><th>Quantity</th><th>Price</th><th>Profit</th></tr>';
        
        trades.forEach(trade => {
            html += `<tr><td>${trade.time}</td><td>${trade.side}</td><td>${trade.quantity}</td><td>${trade.price}</td><td>${trade.profit.toFixed(2)}</td></tr>`;
        });
        
        html += '</table></body></html>';
        res.send(html);
    });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
