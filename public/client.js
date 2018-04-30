function handleAction(state,action) {
    if (action.type == "update") {
        console.log(state.messages);
        return Object.assign({}, state, {messages: action.messages});
    }
    else if (action.type == "sendMessage") {
        fetchOK("/messages", {
         method: "POST",
         headers: {"Content-Type": "application/json"},
         body: JSON.stringify({
             user: state.user,
             content: action.content
        })
     }).catch(reportError);
    }
    return state;
}

function reportError(error) {
  alert(String(error));
}

function fetchOK(url, options) {
  return fetch(url, options).then(response => {
    if (response.status < 400) return response;
    else throw new Error(response.statusText);
  });
}

async function poll(update) {
  let tag = undefined;
  for (;;) {
    let response;
    try {
      response = await fetchOK("/messages", {
        headers: tag && {"If-None-Match": tag,
                         "Prefer": "wait=90"}
      });
    } catch (e) {
      console.log("Request failed: " + e);
      await new Promise(resolve => setTimeout(resolve, 500));
      continue;
    }
    if (response.status == 304) continue;
    tag = response.headers.get("ETag");
    update(await response.json());
  }
}

function elt(type, props, ...children) {
  let dom = document.createElement(type);
  if (props) Object.assign(dom, props);
  for (let child of children) {
    if (typeof child != "string") dom.appendChild(child);
    else dom.appendChild(document.createTextNode(child));
  }
  return dom;
}

function renderMessages(messages) {
    return elt("div",{className:"message"}, elt(
            "p", {className:"nickname"}, messages.user),
            elt("p", {className:"content"}, messages.content));
}

function renderSendForm(dispatch) {
    return elt("div", {className:"footer"}, elt(
            "textarea", {placeholder:"Write a message..."}),
            elt ("button", {
              onclick() {
                dispatch({type:"sendMessage",content:document.querySelector("textarea").value});
              }
            }, "Send"));
}

class ChatApp {
  constructor(state, dispatch) {
    this.dispatch = dispatch;
    this.dom = elt("header", {className:"main"},
                   renderSendForm(dispatch));
    this.setState(state);
  }
  setState(state) {
    if (this.messages != state.messages) {
        for (let div of this.dom.querySelectorAll("header .message")) {
          div.remove();
        }
        for (let message of state.messages) {
            this.dom.appendChild(renderMessages(message));
        }
        this.messages = state.messages;
    }
  }
}

function runApp() {
    let user = localStorage.getItem("userName") || "Anon";
    let state, app;
    function dispatch(action) {
        state = handleAction(state, action);
        app.setState(state);
    }

    poll (messages => {
        if (!app) {
            state = {user, messages};
            app = new ChatApp(state, dispatch);
            document.body.appendChild(app.dom);
        } else {
            dispatch({type: "update", messages});
        }
    }).catch(reportError);
}

runApp();
