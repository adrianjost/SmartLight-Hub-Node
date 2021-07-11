const { localStorage, kv } = require("./storage");
const ReconnectingWebSocket = require("reconnecting-websocket");
const WebSocket = require("ws");
const { firebase, db } = require("./firebase");
const { throttle } = require("throttle-debounce");
const logger = require("./log");

const MESSAGE_ID_TIMEOUT = 10000;
const CONNECTION_IS_HEALTHY_AFTER = 20000;
const HEARTBEAT_INTERVAL = 60000;
const UNITS_COLLECTION = db.collection("units");

kv.sendMessageIDs = {};
kv.connections = {};

const { dbStateToMessage, messageToDBState } = require("./translation");

async function updateDBFromMessage(unit, messageEvent) {
	const message = JSON.parse(messageEvent.data);

	if (kv.sendMessageIDs[message.id] === true) {
		logger.info("skip updating db, message was send by hub");
		return;
	}
	const newState = messageToDBState(unit, message);
	logger.info("new state", newState);
	if (newState === null) {
		return;
	}
	if (JSON.stringify(newState) === JSON.stringify(unit.state)) {
		logger.info("new state is identical to db state - skip db update");
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
		}, CONNECTION_IS_HEALTHY_AFTER);

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

function onAdd(unit) {
	const connection = createConnection(unit);
	connection.rws.onerror = logger.info;
	connection.rws.onmessage = throttle(5000, false, (message) => {
		updateDBFromMessage(unit, message);
	});
	connection.heartbeat = setInterval(() => {
		const message = {
			action: "GET /output",
		};
		const messageString = JSON.stringify(message);
		connection.rws.send(messageString);
	}, HEARTBEAT_INTERVAL);
	kv.connections[unit.id] = connection;
}

function onModify(unit) {
	const connection = kv.connections[unit.id];
	const newUrls = [`ws://${unit.hostname}`, `ws://${unit.ip}`];
	connection.urls.splice(0, connection.urls.length, ...newUrls);

	const message = dbStateToMessage(unit);

	const randomID = Math.round(Math.random() * 1000000);
	kv.sendMessageIDs[randomID] = true;
	message.id = randomID;
	setTimeout(() => {
		delete kv.sendMessageIDs[randomID];
	}, MESSAGE_ID_TIMEOUT);

	const messageString = JSON.stringify(message);

	logger.info(`sending ${messageString} to ${unit.id}`);
	connection.rws.send(messageString);
}

function onRemove(unit) {
	const connection = kv.connections[unit.id];
	clearInterval(connection.heartbeat);
	connection.rws.close();
	delete kv.connections[unit.id];
}

function resetConnections() {
	Object.entries(kv.connections).forEach(([key, value]) => {
		value.rws.close();
		delete kv.connections[key];
	});
}

async function init() {
	try {
		const savedLogin = localStorage.getItem("credential");
		if (savedLogin === null) {
			logger.info("No saved credential found");
			return;
		}
		logger.info("Login with saved credentials");
		loginData = JSON.parse(savedLogin);
		kv.credential = await firebase
			.auth()
			.signInWithEmailAndPassword(loginData.email, loginData.password);

		logger.info(kv.credential.user.uid);

		const unsubscribeDatabase = UNITS_COLLECTION.where(
			"allowedUsers",
			"array-contains",
			kv.credential.user.uid
		)
			.where("type", "==", "LAMP")
			.onSnapshot((querySnapshot) => {
				querySnapshot.docChanges().forEach((change) => {
					if (change.type === "added") {
						logger.info("added: ", change.doc.data());
						onAdd(change.doc.data());
					}
					if (change.type === "modified") {
						logger.info("modified: ", change.doc.data());
						onModify(change.doc.data());
					}
					if (change.type === "removed") {
						logger.info("removed: ", change.doc.data());
						// TODO [#10]: I am not sure, if I can read the data here. Check it and eventually just close the connection by uid. There must be a way to at least get this.
						onRemove(change.doc.data());
					}
				});
			});

		kv.unsubscribeDatabase = async () => {
			await unsubscribeDatabase();
			delete kv.unsubscribeDatabase;
			resetConnections();
		};
	} catch (error) {
		logger.error(error);
	}
}

module.exports = {
	init,
};
