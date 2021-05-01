const polka = require("polka");
const firebase = require("firebase/app");
require("firebase/auth");
require("firebase/firestore");
const WebSocket = require("ws");
const fs = require("fs").promises;
const { urlencoded } = require("body-parser");

const LocalStorage = require("node-localstorage").LocalStorage;
const { waitForDebugger } = require("inspector");
localStorage = new LocalStorage("./localstorage");

const styles = `<link rel="stylesheet" href="/styles.css">`;

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

let credential = null;

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
  console.log(`connecting to ${unit.hostname || unit.ip}`);
  const ws = new WebSocket(`ws://${unit.hostname || unit.ip}`, {
    perMessageDeflate: false,
  });
  ws.on("open", function open() {
    console.log("connected!");
    const { r, b } = hex2rgb(unit.state.color);
    console.log(unit.state.color, r, b);
    ws.send(
      JSON.stringify({
        action: "SET /output/channel",
        data: [r, b],
      })
    );
    ws.close();
  });
  ws.on("error", console.error)
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
    credential = await firebase
      .auth()
      .signInWithEmailAndPassword(loginData.email, loginData.password);

    console.log(credential.user.uid);

    await unitsRef
      .where("allowedUsers", "array-contains", credential.user.uid)
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
  } catch (error) {
    console.error("catched error", error);
  }
}

init();

polka()
  .use(urlencoded({ extended: false }))
  .use(function (req, res, next) {
    res.redirect = (location) => {
      let str = `Redirecting to ${location}`;
      res.writeHead(302, {
        Location: location,
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Length": str.length,
      });
      res.end(str);
    };
    next();
  })
  .get("/", async (req, res) => {
    if (credential === null) {
      const file = await fs.readFile("./login.html");
      res.end(file);
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
    });
    res.end(`${styles}
    <p style="font-size: 3em;">🎉 🎉 🎉</p>
    <p>🔓 You are logged in as ${credential.user.email}. 🔓</p>
    <p>Click <a href="/logout">here</a> to logout.</p>
    <p style="font-size: 3em;">🎉 🎉 🎉</p>
    `);
  })
  .post("/", async (req, res) => {
    console.log("BODY:", JSON.stringify(req.body));
    const { email, password } = req.body;
    try {
      credential = await firebase
        .auth()
        .signInWithEmailAndPassword(email, password);
    } catch (error) {
      console.error(error.code, error.message);
      res.end(error.message);
    }
    localStorage.setItem(
      "credential",
      JSON.stringify({
        email,
        password,
      })
    );
    init();
    res.redirect("/");
  })
  .get("/logout", async (req, res) => {
    localStorage.clear();
    credential = null;
    await firebase.auth().signOut();
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
    });
    res.end(`
    <meta http-equiv="refresh" content="5; URL=/">
    ${styles}
    <p>🔒 You have been logged out. 🔒</p>
    <p>Click <a href="/">here</a> to login again.</p>`);
  })
  .get("/styles.css", async (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/css; charset=utf-8",
    });
    res.end(await fs.readFile("./styles.css"));
  })
  .listen(3000, (err) => {
    if (err) throw err;
    console.log(`> Running on localhost:3000`);
  });
