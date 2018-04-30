const {createServer} = require("http");
const {writeFile} = require("fs");
const {readFileSync} = require("fs");
const ecstatic = require("ecstatic");
const Router = require("./router");

let router = new Router();
let defaultHeaders = {"Content-Type": "text/plain"};

class ChatServer {
  constructor(messages) {
    this.messages = messages;
    this.version = 0;
    this.waiting = [];

    let fileServer = ecstatic({root: "./public"});
    this.server = createServer((request, response) => {
      let resolved = router.resolve(this, request);
      if (resolved) {
        resolved.catch(error => {
          if (error.status != null) return error;
          return {body: String(error), status: 500};
        }).then(({body,
                  status = 200,
                  headers = defaultHeaders}) => {
          response.writeHead(status, headers);
          response.end(body);
        });
      } else {
        fileServer(request, response);
      }
    });
  }
  start(port) {
    this.server.listen(port);
  }
  stop() {
    this.server.close();
  }
}
function readStream(stream) {
  return new Promise((resolve, reject) => {
    let data = "";
    stream.on("error", reject);
    stream.on("data", chunk => data += chunk.toString());
    stream.on("end", () => resolve(data));
  });
}

router.add("POST", /^\/messages$/,
           async (server, request) => {
  let requestBody = await readStream(request);
  let message;
  try { message = JSON.parse(requestBody); }
  catch (_) { return {status: 400, body: "Invalid JSON"}; }

  if (!message) {
    return {status: 400, body: "Bad message data"};
  } else {    
    server.messages.push(message);
    server.updated();
    return {status: 204};
  }
});

ChatServer.prototype.talkResponse = function() {
  return {
    body: JSON.stringify(this.messages),
    headers: {"Content-Type": "application/json",
              "ETag": `"${this.version}"`}
  };
};

router.add("GET", /^\/messages$/, async (server, request) => {
  let tag = /"(.*)"/.exec(request.headers["if-none-match"]);
  let wait = /\bwait=(\d+)/.exec(request.headers["prefer"]);
  if (!tag || tag[1] != server.version) {
    return server.talkResponse();
  } else if (!wait) {
    return {status: 304};
  } else {
    return server.waitForChanges(Number(wait[1]));
  }
});

ChatShareServer.prototype.waitForChanges = function(time) {
  return new Promise(resolve => {
    this.waiting.push(resolve);
    setTimeout(() => {
      if (!this.waiting.includes(resolve)) return;
      this.waiting = this.waiting.filter(r => r != resolve);
      resolve({status: 304});
    }, time * 1000);
  });
};

ChatServer.prototype.updated = function() {
  this.version++;

  writeFile("./messages.json", JSON.stringify(this.messages), err => {
    if (err) console.log(`Failed to write file: ${err}`);
    else console.log("File written.");
  });

  let response = this.talkResponse();
  this.waiting.forEach(resolve => resolve(response));
  this.waiting = [];
};

let json=JSON.parse(readFileSync("./messages.json","utf8"));
new ChatServer(json).start(3000);
