const express = require("express");
const mysql = require('mysql');
const fetch = require('node-fetch');
const session = require("express-session");
const bcrypt = require("bcrypt");
const ejs = require('ejs');
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
        let apiData = await getData();
		res.redirect("home");
	} else {
		res.render("login",{"alertType":req.session.alertType,"alert":req.session.alert}); //login can dynamically display various alert messages using bootstrap alerts
    }
});

app.get('/home', isAuthed, async (req, res) => {
    let apiData = await getData();
	res.render("home",{"username":req.session.username,"mapbox_token":process.env.MAPBOX_API_KEY,"apiData":apiData});
});

app.get('/submit',isAuthed,async(req,res) =>{
    res.render("submit",{"imgur_id":process.env.IMGUR_CLIENT_ID});
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
        res.render("login",{"alertType":"alert-danger","alert":"Incorrect username or password."});
	}
});

app.get("/logout", (req,res) => {
	req.session.destroy();
    console.log("logged out")
	res.redirect("/");
});

app.get("/signup", async (req,res)=>{
    if (req.session.authenticated){
		res.redirect("/");
	} else {
        clearAlert(req);
		res.render("signup");
	}
});

app.post("/signup", async (req, res)=> {
    let username = req.body.username;
    let password = req.body.password;
    let email = req.body.useremail;
    let hashedpass = "";

    hashedpass = await bcrypt.hash(password,10);

    let sql = "SELECT * FROM otter_users WHERE username = ?";
    let params = [username];
    let rows = await executeSQL(sql, params);
    if(rows.length == 0){
        //found no matching users
        //can insert new user to database
        
        //must pass credential constraints
        if (username.length >= 50){
            req.session.alertType = "alert-danger";
            req.session.alert = "Username too long";
            res.redirect("signup");
        } else{
            let params2 = [username,hashedpass,email];
            let sql2 = `insert into otter_users (username, password,email) values (?,?,?)`;
            let rows2 = await executeSQL(sql2, params2);
            req.session.alertType = "alert-success";
            req.session.alert = "Account successfully created! Please login.";
            res.redirect("/");
        }
    } else{
            res.render("signup",{"alertType":"alert-danger","alert":"Username already taken"});
    }
});

//api routes
app.get("/api/getAllPOI", async (req,res)=>{
    let sql = "SELECT * FROM otter_poi";
	let rows = await executeSQL(sql);
    res.send(rows);
});

async function getData(){
    let url = `http://localhost:3000/api/getAllPOI`;
    let response = await fetch(url);
    //console.log(response)
    if(response.ok){
        let apiData = await response.json();
        //console.log("data: "+apiData[0].name);
        return apiData;
    }
    return "error";
}

//server startup msg
app.listen(3000, () => {
    console.log('server started');
});

//functions

function clearAlert(req){
    console.log("cleared");
    req.session.alertType = undefined;
    req.session.alert = undefined;
}

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