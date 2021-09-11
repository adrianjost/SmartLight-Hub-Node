//@ts-check
const { initializeApp } = require("firebase/app");
const { getAuth } = require("firebase/auth");
const { getFirestore } = require("firebase/firestore");

const firebaseConfig = {
	apiKey: "AIzaSyDJ17cuZ4P1YzSTOWtU_WqOKMloaqg7x_Q",
	authDomain: "smartlight-4861d.firebaseapp.com",
	databaseURL: "https://smartlight-4861d.firebaseio.com",
	projectId: "smartlight-4861d",
	storageBucket: "smartlight-4861d.appspot.com",
	messagingSenderId: "535232876187",
	appId: "1:535232876187:web:d1d32ada292db2bb3c803e",
};

const firebaseApp = initializeApp(firebaseConfig);

module.exports = {
	auth: getAuth(firebaseApp),
	db: getFirestore(firebaseApp),
};
