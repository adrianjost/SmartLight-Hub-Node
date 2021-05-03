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

module.exports = {
	hex2rgb,
	colorToChannel,
};
