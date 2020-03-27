const logs = require('../server/log');

const options = {
    from: new Date(),
};

logs.stream(options).on('log', log => {
    console.log(log);
});
