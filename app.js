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
require("dotenv/config");

//author variable
const author = "Mircea Diandra";

//empty variable for postID
let requestedPostID = [];

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: false}));

mongoose.connect("mongodb://localhost:27017/purpleEverGlow", {useNewUrlParser: true, useUnifiedTopology: true});

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

const Post = mongoose.model("Post", postSchema);

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
    });
});

app.get("/contact", function(req, res){
    res.render("contact");
});

app.get("/admin", function(req, res){
    Post.find({}, function(err, posts){
        res.render("admin", {
            posts: posts
        });
    });
});

app.get("/modify", function(req, res){
    res.render("modify");
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

app.listen(3000, function(){
    console.log("Server connected!")
});