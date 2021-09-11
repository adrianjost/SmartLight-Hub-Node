//@ts-check
const LocalStorage = require("node-localstorage").LocalStorage;
module.exports = {
	localStorage: new LocalStorage("../localstorage"),
	kv: {},
};
