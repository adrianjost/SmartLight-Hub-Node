const polka = require("polka");
const fs = require("fs").promises;
const { urlencoded } = require("body-parser");
const { localStorage, kv } = require("./storage");
const { firebase } = require("./firebase");
const logger = require("./log");
const { init: initHub } = require("./hub");

const head = `<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/styles.css">`;

const init = () => {
	if (kv.credential === undefined) {
		kv.credential = null;
	}

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
			if (kv.credential === null) {
				const file = await fs.readFile("./src/login.html");
				res.end(file);
				return;
			}
			res.writeHead(200, {
				"Content-Type": "text/html; charset=utf-8",
			});
			res.end(`${head}
    <p style="font-size: 3em;">🎉 🎉 🎉</p>
    <p>🔓 You are logged in as ${kv.credential.user.email}. 🔓</p>
    <p>Click <a href="/logout">here</a> to logout.</p>
    <p style="font-size: 3em;">🎉 🎉 🎉</p>
    `);
		})
		.post("/", async (req, res) => {
			logger.info("BODY:", JSON.stringify(req.body));
			const { email, password } = req.body;
			try {
				kv.credential = await firebase
					.auth()
					.signInWithEmailAndPassword(email, password);
			} catch (error) {
				logger.error(error.code, error.message);
				res.end(error.message);
			}
			localStorage.setItem(
				"credential",
				JSON.stringify({
					email,
					password,
				})
			);
			initHub();
			res.redirect("/");
		})
		.get("/logout", async (req, res) => {
			if (kv.unsubscribeDatabase) {
				await kv.unsubscribeDatabase();
			}
			localStorage.clear();
			kv.credential = null;
			await firebase.auth().signOut();
			logger.info("logged out");
			res.writeHead(200, {
				"Content-Type": "text/html; charset=utf-8",
			});
			res.end(`
				<meta http-equiv="refresh" content="5; URL=/">
				${head}
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
			logger.info(`> Running on localhost:3000`);
		});
};

module.exports = {
	init,
};
