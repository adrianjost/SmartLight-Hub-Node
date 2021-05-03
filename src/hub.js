const { localStorage, kv } = require("./storage");
const { hex2rgb, colorToChannel } = require("./color");
const WebSocket = require("ws");
const { firebase, db } = require("./firebase");

const MESSAGE_ID_TIMEOUT = 10000;

kv.sendMessageIDs = {};

function unitStateToMessage(unit) {
	const state = unit.state;
	console.log(state);
	if (state.type === "OFF") {
		return {
			action: "SET /output/power",
			data: 0,
		};
	}
	if (state.type === "TIME") {
		return {
			action: "SET /output/power",
			data: 1,
		};
	}
	// legacy handling - state.color should not be used anymore
	if (state.color !== null || state.type === "MANUAL") {
		const channelValues = colorToChannel(
			unit.channelMap,
			hex2rgb(state.data || state.color)
		);
		return {
			action: "SET /output/channel",
			data: [channelValues[0], channelValues[1]],
		};
	}
}

async function messageToDatabaseState(unitRef, message) {
	if (message.action !== "GET /output") {
		console.log("can't handle message (yet)");
		return;
	}
	const currentHexColor = "#ff0000"; // TODO: update color with correct value
	switch (message.data.state) {
		case "OFF": {
			await unitRef.update({
				state: {
					color: "#000000",
					type: "OFF",
				},
			});
			return;
		}
		case "TIME":
		case "MANUAL": {
			await unitRef.update({
				state: {
					color: currentHexColor,
					type: message.data.state,
				},
			});
			return;
		}
		default:
			throw new Error("can't handle unit state (yet)");
	}
}

async function updateLocalUnit(unit) {
	const ip = unit.hostname || unit.ip;
	console.log(`connecting to ${ip}`);
	const ws = new WebSocket(`ws://${ip}`, {
		perMessageDeflate: false,
	});
	ws.on("open", function open() {
		console.log(`connected to ${ip}`);
		const message = unitStateToMessage(unit);
		const randomID = Math.round(Math.random() * 1000000);
		kv.sendMessageIDs[randomID] = true;
		message.id = randomID;
		setTimeout(() => {
			delete kv.sendMessageIDs[randomID];
		}, MESSAGE_ID_TIMEOUT);
		const messageString = JSON.stringify(message);
		console.log(`sending ${messageString} to ${ip}`);
		ws.send(messageString);
		ws.close();
	});
	ws.on("error", console.error);
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

		const unsubscribeDatabase = db
			.collection("units")
			.where("allowedUsers", "array-contains", kv.credential.user.uid)
			.where("type", "==", "LAMP")
			.onSnapshot((querySnapshot) => {
				querySnapshot.docChanges().forEach((change) => {
					if (change.type === "added") {
						console.log("added: ", change.doc.data());
					}
					if (change.type === "modified") {
						console.log("modified: ", change.doc.data());
						try {
							const unit = change.doc.data();
							if (unit.type === "LAMP") {
								updateLocalUnit(unit);
							}
						} catch (error) {
							console.error(error);
						}
					}
					if (change.type === "removed") {
						console.log("removed: ", change.doc.data());
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
