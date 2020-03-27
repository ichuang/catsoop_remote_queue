const http = require('http');

const bodyParser = require('body-parser');
const express = require('express');

const app = express();
app.set('trust proxy', 'loopback');

app.use(bodyParser.urlencoded({ extended: true }));

app.post('/get_user_information', (req, res) => {
    if (req.body.succeed) {
        res.json({
            ok: true,
            user_info: {
                username: req.body.username,
                role: req.body.role,
            },
        });
    }
    else {
        res.json({
            ok: false,
            error: 'mock error message',
        });
    }
});



const groups = express.Router();

groups.post('/get_my_group', (req, res) => {
    res.json({
        ok: true,
        members: [req.body.as, `${req.body.as}-partner`]
    });
});

app.use('/groups', groups);


const assignments = express.Router();

assignments.post('/0', (req, res) => {
    const names = JSON.parse(req.body.names);
    res.json(Object.assign({}, ...(names.map(name => ({[name]: {}})))));
});

app.use('/assignments', assignments);


const server = http.Server(app);

module.exports = {
    start(port) {
        server.listen(port);
    },

    stop() {
        server.close();
    }
};
