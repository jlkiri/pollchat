const {parse} = require("url");

module.exports = class Router {
    constructor() {
        this.routes = [];
    }
    add (method, url, handler) {
        this.routes.push({method, url, handler});
    }
    resolve (context,request) {
        let path = parse(request.url).pathname;

        for (let {method, url, handler} of this.routes) {
            let match = url.exec(path);
            if (!match || request.method!=method) continue;
            let urlPart = match.slice(1).map(decodeURIComponent);
            return handler(context, ...urlPart, request);
        }
        return null;
    }
};