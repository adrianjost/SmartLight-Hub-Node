const polka = require("polka");
const firebase = require("firebase/app");
require("firebase/auth");
require("firebase/firestore");
const WebSocket = require('ws');

const firebaseConfig = {
  apiKey: "AIzaSyDJ17cuZ4P1YzSTOWtU_WqOKMloaqg7x_Q",
  authDomain: "smartlight-4861d.firebaseapp.com",
  databaseURL: "https://smartlight-4861d.firebaseio.com",
  projectId: "smartlight-4861d",
  storageBucket: "smartlight-4861d.appspot.com",
  messagingSenderId: "535232876187",
  appId: "1:535232876187:web:d1d32ada292db2bb3c803e",
};
firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();

var unitsRef = db.collection("units");

let credentials;

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

async function updateLocalUnit(unit) {
  console.log(`connecting to ${unit.hostname}`)
  const ws =   new WebSocket(`ws://${unit.hostname}`, {
    perMessageDeflate: false
  });
  ws.on('open', function open() {
    console.log("connected!")
    const {r, b } = hex2rgb(unit.state.color);
    console.log(unit.state.color, r,b)
    ws.send(JSON.stringify(
      {
        "action": "SET /output/channel",
        "data": [r, b]
      }
    ));
    ws.close()
  });
}

async function init() {
  try {
    // await firebase.auth().createUserWithEmailAndPassword("adrian.aus.berlin+firebase-node-demo@gmail.com", "mySuperSecretKey123")
    credentials = await firebase
      .auth()
      .signInWithEmailAndPassword(
        "adrian.aus.berlin+firebase-node-demo@gmail.com",
        "mySuperSecretKey123"
      );

    console.log(credentials.user.uid);

    const doc = await unitsRef.doc("0X5F4qjkrFbeOMTzrLT8").get();
    console.log(doc.data());

    await unitsRef
      .where("allowedUsers", "array-contains", credentials.user.uid)
      .onSnapshot((querySnapshot) => {
        querySnapshot.forEach((doc) => {
          updateLocalUnit(doc.data())
        });
      });
  } catch (error) {
    console.error("catched error", error);
  }
}

let initialized = false;
init();

async function one(req, res, next) {
  req.hello = "world";
  if (!initialized) {
    await init();
    initialized = true;
  }
  next();
}

polka()
  .use(one)
  .get("/users/:id", (req, res) => {
    console.log(`~> Hello, ${req.hello}`);
    res.end(`User: ${req.params.id}`);
  })
  .listen(3000, (err) => {
    if (err) throw err;
    console.log(`> Running on localhost:3000`);
  });
