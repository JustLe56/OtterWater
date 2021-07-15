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
        //let apiData = await getData();
		res.redirect("home");
	} else {
		res.render("login",{"alertType":req.session.alertType,"alert":req.session.alert}); //login can dynamically display various alert messages using bootstrap alerts
    }
});

app.get('/home', isAuthed, async (req, res) => {
    //let apiData = await getData();
    let sql = `SELECT * FROM otter_poi`;

    let rows = await executeSQL(sql);
	res.render("home",{"username":req.session.username,"mapbox_token":process.env.MAPBOX_API_KEY,"apiData":rows,"title":"Home","admin":req.session.admin});
});

app.get('/submit',isAuthed,async(req,res) =>{
    res.render("submit",{"imgur_id":process.env.IMGUR_CLIENT_ID,"title":"Submit"});
});

app.post('/submit',isAuthed,async(req,res) =>{
    let name = req.body.poiName;
    let lat = req.body.poiLat;
    let lon = req.body.poiLon;
    let desc = req.body.poiDesc;
    let userID = req.session.userID;
    let approved = 0;
    let img = req.body.poiImgURL;
    
    let params = [name,lat,lon,desc,userID,approved,img];
    console.log(params);
    let sql = 'insert into otter_poi (poi_name, lat, lon, poi_desc, user_id, approved, img_link) values (?, ?, ?, ?, ?, ?, ?)';
    let rows = await executeSQL(sql,params);
    res.render("submit",{"imgur_id":process.env.IMGUR_CLIENT_ID,"title":"Submit","alertType":"alert-success","alert":"POI Submitted"});
});

//LOGIN ROUTE
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
    console.log(rows[0].admin);
    let match = await bcrypt.compare(password,hashedpwd);
    if(match && rows[0].admin == true){
		req.session.authenticated = true;
        req.session.username = username;
        req.session.admin = true;
        req.session.userID = rows[0].user_id;
        console.log("admin authed");
		res.redirect("/");
	} else if (match) {
        req.session.authenticated = true;
        req.session.username = username;
        req.session.admin = false;
        req.session.userID = rows[0].user_id;
        console.log("authed");
		res.redirect("/");
    }   else {
        res.render("login",{"alertType":"alert-danger","alert":"Incorrect username or password."});
	}
});

//USER ROUTES
app.get("/submissions",isAuthed,async(req,res)=>{
    let sql = `SELECT user_id,poi_id,poi_name,lat,lon,poi_desc,approved,img_link,username FROM otter_poi NATURAL JOIN otter_users WHERE user_id= ${req.session.userID}`;

    let rows = await executeSQL(sql);
    res.render("mysubmissions",{"title":"My Submissions","data":rows});
});

app.get("/submissions/delete", async function(req, res){
	let poi_ID = req.query.poi_id;
    console.log(poi_ID);
	let sql = `DELETE FROM otter_poi WHERE poi_id = ${poi_ID}`;
    let rows = await executeSQL(sql);

    res.redirect(`/submissions`);
});

app.get("/submissions/update", async function(req, res){
	let poi_ID = req.query.poi_id;
    console.log(poi_ID);
	let sql = `SELECT * FROM otter_poi WHERE poi_id = ${poi_ID}`;
    let rows = await executeSQL(sql);

    res.render("editPoiUser",{"title":"Update","data":rows});
});

app.post("/submissions/update", async function(req, res){
	let poi_ID = req.body.poi_id;
	let sql = `UPDATE otter_poi SET poi_name = ?, lat = ?, lon = ?, poi_desc = ?, img_link = ? WHERE poi_id = ${poi_ID}`;
	let params = [req.body.poi_name,req.body.lat,req.body.lon,req.body.poi_desc,req.body.img_link]
	let rows = await executeSQL(sql,params);
	//res.send(rows);
	res.redirect(`/submissions`);
});

//ADMIN ROUTES
app.get("/admin",isAdmin,async(req,res)=>{
    let sql = `SELECT user_id,poi_id,poi_name,lat,lon,poi_desc,approved,img_link,username FROM otter_poi NATURAL JOIN otter_users`;

    let rows = await executeSQL(sql);
    res.render("admin",{"title":"Admin","data":rows});
});

app.post("/admin/approve", async function(req, res){
	let poi_id = req.body.poi_id;
	let sql = `UPDATE otter_poi SET approved = 1 WHERE poi_id= ${poi_id}`;
	let rows = await executeSQL(sql);
	res.redirect(`/admin`);
});

app.post("/admin/unapprove", async function(req, res){
	let poi_id = req.body.poi_id;
	let sql = `UPDATE otter_poi SET approved = 0 WHERE poi_id= ${poi_id}`;
	let rows = await executeSQL(sql);
	res.redirect(`/admin`);
});

app.get("/admin/delete", async function(req, res){
	let poi_ID = req.query.poi_id;
    console.log(poi_ID);
	let sql = `DELETE FROM otter_poi WHERE poi_id = ${poi_ID}`;
    let rows = await executeSQL(sql);

    res.redirect(`/admin`);
});

app.get("/admin/update", async function(req, res){
	let poi_ID = req.query.poi_id;
    console.log(poi_ID);
	let sql = `SELECT * FROM otter_poi WHERE poi_id = ${poi_ID}`;
    let rows = await executeSQL(sql);

    res.render("editPoi",{"title":"Update","data":rows});
});

app.post("/admin/update", async function(req, res){
	let poi_ID = req.body.poi_id;
	let sql = `UPDATE otter_poi SET poi_name = ?, lat = ?, lon = ?, poi_desc = ?, img_link = ? WHERE poi_id = ${poi_ID}`;
	let params = [req.body.poi_name,req.body.lat,req.body.lon,req.body.poi_desc,req.body.img_link]
	let rows = await executeSQL(sql,params);
	//res.send(rows);
	res.redirect(`/admin`);
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

// async function getData(){
//     let url = `http://localhost:3000/api/getAllPOI`;
//     let response = await fetch(url);
//     //console.log(response)
//     if(response.ok){
//         let apiData = await response.json();
//         //console.log("data: "+apiData[0].name);
//         return apiData;
//     }
//     return "error";
// }

//server startup msg
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`server started at ${port}`);
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

function isAdmin(req,res,next){
    if (!req.session.admin){
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
        database: process.env.DB_DATABASE,
        typeCast: function castField( field, useDefaultTypeCasting ) {

            // We only want to cast bit fields that have a single-bit in them. If the field
            // has more than one bit, then we cannot assume it is supposed to be a Boolean.
            if ( ( field.type === "BIT" ) && ( field.length === 1 ) ) {
    
                var bytes = field.buffer();
    
                // A Buffer in Node represents a collection of 8-bit unsigned integers.
                // Therefore, our single "bit field" comes back as the bits '0000 0001',
                // which is equivalent to the number 1.
                return( bytes[ 0 ] === 1 );
    
            }
            return( useDefaultTypeCasting() );
        }
    }); 
 
    return pool;
 
 }