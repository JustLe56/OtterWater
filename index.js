const express = require("express");
const mysql = require('mysql');
const app = express();
const pool = dbConnection();
require('dotenv').config({ path:  '.env'})

app.set("view engine", "ejs");
app.use(express.static("public"));

//routes

//test database connection
app.get("/dbTest", async function(req, res){
    let sql = "SELECT CURDATE()";
    let rows = await executeSQL(sql);
    res.send(rows);
});

//go to login screen
app.get('/',(req, res) => {
    res.render("login");
});

//server startup msg
app.listen(3000, "127.0.0.1", () => {
    console.log('server started');
});

//functions

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