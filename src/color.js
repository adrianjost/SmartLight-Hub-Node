//@ts-check
function componentToHex(color) {
	const hex = color.toString(16);
	return hex.length === 1 ? "0" + hex : hex;
}
const rgb2hex = ({ r, g, b }) => {
	return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
};

const hex2rgb = (hexColor) => {
	// remove leading #
	if (hexColor.length === 7 || hexColor.length === 4) {
		hexColor = hexColor.substr(1);
	}
	// convert 3 digit to 6 digit color
	if (hexColor.length === 3) {
		hexColor =
			hexColor[0] +
			hexColor[0] +
			hexColor[1] +
			hexColor[1] +
			hexColor[2] +
			hexColor[2];
	}
	const bigint = parseInt(hexColor, 16);
	const r = (bigint >> 16) & 255;
	const g = (bigint >> 8) & 255;
	const b = bigint & 255;
	return { r: r, g: g, b: b };
};

const colorToChannel = (mapping = { r: 1, g: 2, b: 3 }, { r, g, b } = {}) => {
	const out = {};
	out[mapping["r"]] = r;
	out[mapping["g"]] = g;
	out[mapping["b"]] = b;
	return out;
};

const channelToColor = (mapping = { r: 1, g: 2, b: 3 }, channelValues = {}) => {
	const out = {};
	out["r"] = channelValues[mapping["r"].toString()] || 0;
	out["g"] = channelValues[mapping["g"].toString()] || 0;
	out["b"] = channelValues[mapping["b"].toString()] || 0;
	return out;
};

module.exports = {
	hex2rgb,
	colorToChannel,
	rgb2hex,
	channelToColor,
};
