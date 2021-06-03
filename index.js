const express = require("express");
const mysql = require('mysql');
const session = require("express-session");
const bcrypt = require("bcrypt");
const app = express();

require('dotenv').config({ path:  '.env'})


app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({extended: true})); //needed to handle look at req.body

app.set('trust proxy', 1) // trust first proxy
app.use(session({
  secret: 'secretstuff',
  resave: false,
  saveUninitialized: true
  //removed for devlopement environment; re enable when in production in https environment 
  //saveUninitialized: true,
  //cookie: { secure: true }
}));
const pool = dbConnection();

//routes

//test database connection
app.get("/dbTest", async function(req, res){
    let sql = "SELECT CURDATE()";
    let rows = await executeSQL(sql);
    res.send(rows);
});

//go to login screen if not logged in, else take to home
app.get('/', async (req, res) => {
	if (req.session.authenticated){
		res.render("home",{"username":req.session.username});
	} else {
		res.render("login");
	}
});

//when login button is clicked
app.post("/login", async (req,res) =>{
    let username = req.body.username;
	let password = req.body.password;

    let hashedpwd="";

	let sql = "SELECT * FROM otter_users WHERE username = ?";
	let params = [username]
	let rows = await executeSQL(sql,params);

	//found matching username
	if (rows.length > 0){
		hashedpwd = rows[0].password;
	}

    let match = await bcrypt.compare(password,hashedpwd);
    if(match){
		req.session.authenticated = true;
        req.session.username = username;
        console.log("authed");
		res.redirect("/");
	} else {
		res.render("login",{"msg":"Incorrect username or password."});
	}
});

app.get("/logout", (req,res) => {
	req.session.destroy();
    console.log("logged out")
	res.redirect("/");
});

//server startup msg
app.listen(3000, "127.0.0.1", () => {
    console.log('server started');
});

//functions

//middleware for auth check
function isAuthed(req, res, next){
    if (!req.session.authenticated){
        res.redirect('/');
    } else {
        next();
    }
}

//execute SQL commands
async function executeSQL(sql, params){
    return new Promise (function (resolve, reject) {
    pool.query(sql, params, function (err, rows, fields) {
        if (err) throw err;
           resolve(rows);
        });
    });
}

//create database connection
function dbConnection(){
    require('dotenv').config({ path:  '.env'}) //if this doesn't get called here as well as above, process.env is undefined
    const pool  = mysql.createPool({
        
        connectionLimit: 10,
        host: process.env.DB_HOSTNAME,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE
 
    }); 
 
    return pool;
 
 }