const { localStorage, kv } = require("./storage");
const ReconnectingWebSocket = require("reconnecting-websocket");
const WebSocket = require("ws");
const { firebase, db } = require("./firebase");
const { throttle } = require("throttle-debounce");

const MESSAGE_ID_TIMEOUT = 10000;

const UNITS_COLLECTION = db.collection("units");

kv.sendMessageIDs = {};
kv.connections = {};

const { dbStateToMessage, messageToDBState } = require("./translation");

async function updateDBFromMessage(unit, messageEvent) {
  const message = JSON.parse(messageEvent.data);

  if (kv.sendMessageIDs[message.id] === true) {
    console.log("skip updating db, message was initialized by hub");
    return;
  }
  const newState = messageToDBState(unit, message);
  console.log("new state", newState);
  if (newState === null) {
    return;
  }
  const unitRef = UNITS_COLLECTION.doc(unit.id);
  await unitRef.update({
    state: newState,
  });
}

function createConnection(unit) {
  let workingURLIndex = 0;
  const urls = [`ws://${unit.hostname}`, `ws://${unit.ip}`];
  let urlHealthTimeout = null;
  const urlProvider = () => {
    const currentIndex = workingURLIndex;
    const url = urls[currentIndex];

    // increment by default, in case the connection does fail
    workingURLIndex = (workingURLIndex + 1) % urls.length;

    if (urlHealthTimeout !== null) {
      clearTimeout(urlHealthTimeout);
    }
    urlHealthTimeout = setTimeout(() => {
      urlHealthTimeout = null;
      workingURLIndex = currentIndex;
    }, 20000);

    return url;
  };
  const rws = new ReconnectingWebSocket(urlProvider, [], {
    WebSocket: WebSocket,
  });
  return {
    urls,
    rws,
  };
}

async function onAdd(unit) {
  const connection = createConnection(unit);
  connection.rws.onerror = console.error;
  connection.rws.onmessage = throttle(5000, false, (message) => {
    updateDBFromMessage(unit, message);
  });
  kv.connections[unit.id] = connection;
}

async function onModify(unit) {
  // TODO: modify connection url list when unit get's modified
  const connection = kv.connections[unit.id];
  const newUrls = [`ws://${unit.hostname}`, `ws://${unit.ip}`];
  connection.urls.splice(0, connection.urls.length);
  connection.urls.push(...newUrls);

  const message = dbStateToMessage(unit);

  const randomID = Math.round(Math.random() * 1000000);
  kv.sendMessageIDs[randomID] = true;
  message.id = randomID;
  setTimeout(() => {
    delete kv.sendMessageIDs[randomID];
  }, MESSAGE_ID_TIMEOUT);

  const messageString = JSON.stringify(message);
  console.log(`sending ${messageString} to ${unit.id}`);
  connection.rws.send(messageString);
}

async function onRemove(unit) {
  const connection = kv.connections[unit.id];
  connection.rws.close();
  delete kv.connections[unit.id];
}

async function init() {
  try {
    const savedLogin = localStorage.getItem("credential");
    if (savedLogin === null) {
      console.log("No saved credential found");
      return;
    }
    console.log("saved loginData", savedLogin);
    loginData = JSON.parse(savedLogin);
    kv.credential = await firebase
      .auth()
      .signInWithEmailAndPassword(loginData.email, loginData.password);

    console.log(kv.credential.user.uid);

    const unsubscribeDatabase = UNITS_COLLECTION.where(
      "allowedUsers",
      "array-contains",
      kv.credential.user.uid
    )
      .where("type", "==", "LAMP")
      .onSnapshot((querySnapshot) => {
        querySnapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            console.log("added: ", change.doc.data());
            onAdd(change.doc.data());
          }
          if (change.type === "modified") {
            console.log("modified: ", change.doc.data());
            onModify(change.doc.data());
          }
          if (change.type === "removed") {
            console.log("removed: ", change.doc.data());
            // TODO: I am not sure, if I can read the data here. Check it and eventually just close the connection by uid. There must be a way to at least get this.
            onRemove(change.doc.data());
          }
        });
      });

    kv.unsubscribeDatabase = async () => {
      await unsubscribeDatabase();
      delete kv.unsubscribeDatabase;
    };
  } catch (error) {
    console.error("catched error", error);
  }
}

module.exports = {
  init,
};
