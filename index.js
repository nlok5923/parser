const express = require('express');
const cors = require('cors');
const solveRoute = require('./routes/solveRoute')

const corsOptions = {
    origin:
    //  'https://intent-solver.netlify.app',
    // 'https://solver.bananahq.io',
    "*",
    credentials: true,
    optionSuccessStatus: 200,
  };

const app = express();
app.use(express.json());
app.use(cors(corsOptions));

app.get('/', (req, res) => {
  res.send('ok');
})

app.use('/solve', solveRoute)

app.listen("80", (req, res) => {
    console.log("Listening your req...");
});