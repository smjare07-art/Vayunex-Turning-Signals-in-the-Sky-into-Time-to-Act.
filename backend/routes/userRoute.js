const Router = require("express").Router();
const db = require("../config/db");
const usercontroller = require("../controllers/userController");

Router.post("/login",usercontroller.login);
Router.post("/register",usercontroller.register);
Router.post("/getdata",usercontroller.getdata);
module.exports = Router;