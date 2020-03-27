const rp = require('request-promise');

const params = require('../config/params');

function urlJoin(...parts) {
    return parts.map(p => p.replace(/(^\/)|(\/$)/, '')).join('/');
}

class Catsoop {
    constructor(api_root, token) {
        this.api_root = api_root;
        this.token = token;
    }

    post(route, form, uri=urlJoin(this.api_root, route)) {
        return rp
            .post({
                uri,
                form: Object.assign({api_token: this.token}, form),
                json: true,
            })
            .then(res => {
                if (!res.ok) {
                    throw res.error;
                }

                delete res.ok;
                return res;
            });
    }

    submit(uri, form) {
        return rp.post({
            uri,
            form: Object.assign({
                api_token: this.token,
                action: 'submit',
            }, form),
            json: true,
        }).then(res => {
            Object.keys(res).forEach(key => {
                if (res[key].error_msg) throw res[key].error_msg;
            });
        });
    }
}

module.exports = new Catsoop(params.CATSOOP.API_ROOT, params.CATSOOP.TOKEN);
