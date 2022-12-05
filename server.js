
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');

// defining the Express app
const app = express();

// adding Helmet to enhance your API's security
//app.use(helmet());

// parse the body
app.use(bodyParser.raw({ inflate: true, limit: '5Mb', type: '*/*' }));

// enabling CORS for all requests
app.use(cors());

// adding morgan to log HTTP requests
app.use(morgan('combined'));

app.use('/', express.static(__dirname + '/'));

/*
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: __dirname });
});
*/

// starting the server
app.listen(3001, () => {
    console.log('listening on port 3001');
});
