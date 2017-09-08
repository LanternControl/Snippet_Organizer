const fs = require('fs'),
    path = require('path'),
    express = require('express'),
    mustache = require('mustache-express'),
    passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy,
    session = require('express-session'),
    bodyParser = require('body-parser'),
    models = require("./models/users"),
    code = require("./models/snippets"),
    flash = require('express-flash-messages'),
    mongoose = require('mongoose'),
    expressValidator = require('express-validator'),
    MongoURL = 'mongodb://localhost/newdb',
    User = models.User;

const app = express();

mongoose.connect(MongoURL, {useMongoClient:true});

app.engine('mustache', mustache());
app.set('views', './views');
app.set('view engine', 'mustache')
app.use('/static', express.static('static'));

passport.use(new LocalStrategy(
    function(username, password, done) {
        User.authenticate(username, password, function(err, user) {
            if (err) {
                return done(err)
            }
            if (user) {
                return done(null, user)
            } else {
                return done(null, false, {
                    message: "There is no user with that username and password."
                })
            }
        })
    }));

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});

app.use(bodyParser.urlencoded({
    extended: false
}));

app.use(expressValidator());

app.use(session({
    secret: 'smittywerbenjagermanjensen',
    resave: false,
    saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.use(function (req, res, next) {
  res.locals.user = req.user;
  next();
})
app.get('/', function(req, res) {
    res.render("index");
})

app.get('/login/', function(req, res) {
    res.render("login", {
        messages: res.locals.getMessages()
    });
});

app.post('/login/', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login/',
    failureFlash: true
}))

app.get('/register/', function(req, res) {
    res.render('register');
});

app.post('/register/', function(req, res) {
    req.checkBody('username', 'Username must be alphanumeric').isAlphanumeric();
    req.checkBody('username', 'Username is required').notEmpty();
    req.checkBody('password', 'Password is required').notEmpty();

    req.getValidationResult()
        .then(function(result) {
            if (!result.isEmpty()) {
                return res.render("register", {
                    username: req.body.username,
                    errors: result.mapped()
                });
            }
            const user = new User({
                username: req.body.username,
                password: req.body.password
            })

            const error = user.validateSync();
            if (error) {
                return res.render("register", {
                    errors: normalizeMongooseErrors(error.errors)
                })
            }

            user.save(function(err) {
                if (err) {
                    return res.render("register", {
                        messages: {
                            error: ["That username is already taken."]
                        }
                    })
                }
                return res.redirect('/');
            })
        })
});

function normalizeMongooseErrors(errors) {
    Object.keys(errors).forEach(function(key) {
        errors[key].message = errors[key].msg;
        errors[key].param = errors[key].path;
    });
}

app.get('/logout/', function(req, res) {
    req.logout();
    res.redirect('/');
});

const requireLogin = function (req, res, next) {
  if (req.user) {
    next()
  } else {
    res.redirect('/login/');
  }
}
//check ? out
app.get('/collection/', requireLogin, function (req, res) {
  Snippet.find({(?)): req.user.username}).sort([['_id', 'descending']]).then(function(snippets){
    res.render('collection', {snippets:snippets})
  })
});

app.get('/snippet-sample/:id', requireLogin, function(req,res){
  Snippet.findOne({_id: req.params.id}).then(function(snippets){
    res.render('individual', {snippets:snippets})
  })
});

app.get('/language/:language', requireLogin, function(req,res){
  Snippet.find({language: req.params.language}).then(function(snippets){
    res.render('language', {snippets:snippets})
  })
});

app.listen(3000, function() {
    console.log('Express app succesfully started.')
});
