const express = require('express');
const fs = require('fs');
const path = require('path');
const basicAuth = require('express-basic-auth');
require('dotenv').config();

const app = express();
const logFilePath = path.join(__dirname, 'scalping_data.log');

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
        res.send(`<html><body><pre>${data}</pre></body></html>`);
    });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
