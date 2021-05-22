const { hex2rgb, colorToChannel, channelToColor, rgb2hex } = require("./color");
const logger = require("./log");

function dbStateToMessage(unit) {
	const state = unit.state;
	logger.info(state);
	if (state.type === "OFF") {
		return {
			action: "SET /output/power",
			data: 0,
		};
	}
	if (state.type === "AUTO") {
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
			data: [channelValues[1], channelValues[2]],
		};
	}
}

function messageToDBState(unit, message) {
	logger.info("got message:", message);
	if (message.action !== "GET /output") {
		logger.info(message);
		logger.error("can't handle message (yet)");
		return null;
	}
	const [one, two] = message.data.channel;
	const currentRGBColor = channelToColor(unit.channelMap, { 1: one, 2: two });
	logger.info("currentRGBColor", currentRGBColor);
	const currentHexColor = rgb2hex(currentRGBColor);
	switch (message.data.state) {
		case "OFF": {
			return {
				color: "#000000",
				type: "OFF",
			};
		}
		case "AUTO":
		case "MANUAL": {
			return {
				color: currentHexColor,
				type: message.data.state,
			};
		}
		default:
			throw new Error("can't handle unit state (yet)");
	}
}

module.exports = {
	dbStateToMessage,
	messageToDBState,
};
