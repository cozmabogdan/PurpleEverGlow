const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const _ = require("lodash");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const base64 = require("node-base64-image");
const nodemailer = require("nodemailer");
const { getMaxListeners } = require("process");
require("dotenv/config");

//author variable
const author = "Mircea Diandra";

//empty variable for postID
let requestedPostId = [];

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: false}));

//initialize session
app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
}));

//initialise passport
app.use(passport.initialize());
app.use(passport.session());

//connect to db
mongoose.connect(process.env.DB_SERVER, {useNewUrlParser: true, useUnifiedTopology: true});

//post schema
const postSchema = new mongoose.Schema({
    title: String,
    content: String,
    author: String,
    postedAt: {
        type: Date,
        default: Date.now
    },
    img: {
        data: Buffer,
        contentType: String
    }
});

//admin schema
const adminSchema = new mongoose.Schema({
    username: String,
    password: String
});

adminSchema.plugin(passportLocalMongoose);

//mongoose model
const Post = mongoose.model("Post", postSchema);
const Admin = new mongoose.model("Admin", adminSchema);

passport.use(Admin.createStrategy());

passport.serializeUser(Admin.serializeUser());
passport.deserializeUser(Admin.deserializeUser());


const storage = multer.diskStorage({
    destination: function(req, file, cb){
        cb(null, "uploads")
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix)
    }
});

const upload = multer({storage: storage});

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASS,
    }
});

//verify connection config for mailer
transporter.verify(function(err, succes){
    if(err) {
        console.log(err);
    } else {
        console.log("Server is ready to take our messages");
    }
});

app.get("/", function(req, res){
    Post.find({}, function(err, posts){
        res.render("home", {
            posts: posts
        });
    }).sort({postedAt: -1}).limit(2)
});

app.get("/about", function(req, res){
    res.render("about");
});

app.get("/posts", function(req, res){
    Post.find({}, function(err, posts){
        res.render("posts", {
            posts: posts
        });
    }).sort({postedAt: -1})
});

app.get("/contact", function(req, res){
    res.render("contact");
});

app.get("/admin", function(req, res){
    if(req.isAuthenticated()) {
        Post.find({}, function(err, posts){
            res.render("admin", {
                posts: posts
            });
        }).sort({postedAt: -1})
    } else {
        res.redirect("/login");
    }
});

app.get("/delete", function(req, res){
    res.render("delte");
});

app.get("/compose", function(req, res){
    res.render("compose");
});

app.get("/post/:postId", function(req, res){
    const requestedPostId = req.params.postId;
    Post.findOne({_id: requestedPostId}, function(err, post){
        let newLine = post.content.replace(/(\r\n)/gm, '<br><br>');
        res.render("post", {
            posts: post
        });
    });
});

app.get("/register", function(req, res){
    res.render("register");
});

app.get("/login", function(req, res){
    res.render("login");
});

app.get("/edit/:postId", function(req, res){
    const articleId = req.params.postId;
    requestedPostId.push(articleId);
    Post.findOne({_id: requestedPostId}, function(err, post){
        let newLine = post.content.replace(/(\r\n)/gm, '<br><br>');
        res.render("edit", {
            title: post.title,
            content: post.content
        });
    });
});

//delete one document from database
app.get("/delete/:postId", function(req, res){
    const requestedId = req.params.postId;
    Post.deleteOne({_id: requestedId}, function(err, post){
        res.redirect("/admin");
    });
});

app.post("/compose", upload.single("image"), function(req, res){
    const newPost = new Post ({
        title: req.body.title,
        content: req.body.content,
        author: author,
        img: {
            data: fs.readFileSync(path.join(__dirname + "/uploads/" + req.file.filename)),
            contentType: "image/jpg"
        }
    });

    newPost.save(function(err){
        if(!err) {
            res.redirect("/admin");
        } else {
            console.log(err);
        }
    });
});

app.post("/login", function(req, res){
    const admin = new Admin({
        username: req.body.username,
        password: req.body.password
    });
    req.login(admin, function(err){
        if(err){
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function(){
                res.redirect("/admin");
            });
        }
    });
});

app.post("/register", function(req, res){
    Admin.register({username: req.body.username}, req.body.password, function(err, user){
        if(err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function(){
                res.redirect("/admin");
            });
        }
    });
});

//replace one document in the DB
app.post("/edit", upload.single("image"), function(req, res){
    Post.replaceOne({_id: requestedPostId}, {
        title: req.body.editTitle,
        content: req.body.editBody,
        author: author,
        img: {
            data: fs.readFileSync(path.join(__dirname + "/uploads/" + req.file.filename)),
            contentType: "image/jpg"
        }
    }, function(err, post){
        requestedPostId.splice(0, 1);
        res.redirect("admin");
    });
});

app.post("/contact", function(req, res){
    const mail = {
        from: req.body.email,
        to: process.env.EMAIL,
        subject: req.body.subject,
        text: req.body.content
    };
    
    transporter.sendMail(mail, function(err, data){
        if(err){
            console.log(err);
            res.status(500).send("Something went wrong.");
        } else {
            res.status(200).send("Email successfully sent!");
        }
    });
    
    res.redirect("/");
})

app.listen(3000, function(){
    console.log("Server connected!")
});