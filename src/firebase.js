//@ts-check
const { initializeApp } = require("firebase/app");
const { getAuth } = require("firebase/auth");
const { getFirestore } = require("firebase/firestore");

const firebaseConfig = {
	apiKey: "AIzaSyD97NBMCQF1pvzEUP7xpjQ1nW362ym8hq0",
	authDomain: "aj-smartlight.firebaseapp.com",
	databaseURL: "https://aj-smartlight.firebaseio.com",
	projectId: "aj-smartlight",
	storageBucket: "aj-smartlight.appspot.com",
	messagingSenderId: "60490510559",
	appId: "1:60490510559:web:dfd98676749a102853396a",
};

const firebaseApp = initializeApp(firebaseConfig);

module.exports = {
	auth: getAuth(firebaseApp),
	db: getFirestore(firebaseApp),
};
