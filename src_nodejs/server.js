var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var express = require('express');
var session = require('express-session');//sessions
var bodyParser = require('body-parser');//sessions
var sessionstore = require('sessionstore'); //sessions
var os = require("os");
var chalk = require('chalk'); //colors in console
var mqtt = require('mqtt'); //mqtt client
var config = require('./config.json'); //include the cofnig file
var uuidv1 = require('uuid/v1'); //gen random uuid times based
var got = require('got');
var randomstring = require("randomstring"); //gen random strings
var fs = require('fs');
var sanitizer = require('sanitizer');
var fileUpload = require('express-fileupload');
var cron = require('node-cron'); //some cronjobs
var listEndpoints = require('express-list-endpoints'); //for rest api explorer
var bcrypt = require('bcrypt'); //for pw hash
var DB = require('tingodb')().Db;//file based database like mongo db


var port = process.env.PORT || config.webserver_default_port || 3000;
var hostname = process.env.HOSTNAME || config.hostname || "http://127.0.0.1:" + port + "/";
var appDirectory = require('path').dirname(process.pkg ? process.execPath : (require.main ? require.main.filename : process.argv[0]));
console.log(appDirectory);
var db = new DB(path.join(appDirectory, 'db'), {});



//-------- EXPRESS APP SETUP --------------- //
app.set('trust proxy', 1);
app.use(function (req, res, next) {
    if (!req.session) {
        return next(); //handle error
    }
    next(); //otherwise continue
});
app.set('views', __dirname + '/views');
app.engine('html', require('ejs').renderFile);
// Routing
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'damdkfgnlesfkdgjerinsmegwirhlnks.m',
    store: sessionstore.createSessionStore(),
    resave: true,
    saveUninitialized: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(fileUpload());


app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

server.listen(port, function () {
    console.log('Server listening at port %d', port);
});
// ---------------- END EXPRESS SETUP -------------- //


//--------- DB -----------------------------------//
var collection = db.collection("doc");


collection.insert([{ email: 'test@user.de', password: bcrypt.hashSync('test', 10), id: uuidv1(), type: "USER" }], function (err, result) { console.log(err); console.log(result); });

collection.findOne({ email: 'test@user.de' }, function (err, item) {
    console.log(err);
});

//-------- HELPER FUNCTIONS ---------------//
function generate_random_string() {
    return randomstring.generate({
        length: 13,
        charset: String(Math.round(new Date().getTime() / 1000))
    });
}
//--------END HELPER FUNCTIONS ---------------//
var sess;






app.get('/', function (req, res) {
    res.redirect('/index');
});

app.get('/index', function (req, res) {
    res.render('index.ejs', {
        app_name: config.app_name
    });
});


app.get('/register', function (req, res) {
    res.render('register.ejs', {
        app_name: config.app_name
    });
});
app.post('/register', function (req, res) {
    sess = req.session;
    var user_email = req.body.email;
    var user_pw = req.body.password;
    var user_name = req.body.name;

    collection.findOne({ email: user_email }, function (_err, item) {
        if (!_err || item) { res.redirect("/error?msg=email_registered"); return; }

        collection.insert([{name:sanitizer.sanitize(user_name), email: sanitizer.sanitize(user_email), password: bcrypt.hashSync(sanitizer.sanitize(user_pw), 10), id: uuidv1(), type: "USER" }], function (err, result) { 
            if (err) { res.redirect("/error?msg=register_db_write_failed"); return; }
            res.redirect("/login");
            return;
        });
    });
});
app.get('/login', function (req, res) {
    res.render('login.ejs', {
        app_name: config.app_name
    });
});

app.post('/login', (req, res) => {
    sess = req.session;
    var user_email = req.body.email;
    var user_pw = req.body.password;
    collection.findOne({ email: user_email }, function (err, item) {
        if (err) { res.redirect("/error?msg=login_failed"); return; }
        bcrypt.compare(user_pw, item.password, function (err, crypr_res) {
            if (crypr_res) {
                sess.user_data = item;//ADD SESSION VARS
                console.log(sess);
                res.redirect("/admin");
                return;
            } else {
                if (err) { res.redirect("/error?msg=login_failed"); return; }
            }
        });
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return console.log(err);
        }
        res.redirect('/');
    });
});





app.get('/admin', (req, res) => {
    sess = req.session;
    if (sess.user_data) {
        res.write(`<h1>Hello ${sess.user_data.email} </h1><br>`);
        res.end('<a href=' + '/logout' + '>Logout</a>');
    }
    else {
        res.write('<h1>Please login first.</h1>');
        res.end('<a href=' + '/login' + '>Login</a>');
    }
});



app.get('/error', function (req, res) {
    res.render('error.ejs', {
        err: sanitizer.sanitize(req.query.msg),
        app_name: config.app_name
    });
});


/*
app.post('/create_project', function (req, res) {
    if (req.body.project_name == undefined || req.body.project_desc == undefined || sanitizer.sanitize(req.body.project_name) == "" || sanitizer.sanitize(req.body.project_desc) == "") {
        res.finished = true;
        return;
    }
*/

//uuidv1(); --- GEN UUID






app.get('/rest/update/:id', function (req, res) {
    var id = req.params.id;
    var tmp = { "id": id };
    res.json(tmp);
});


//---------------- SOCKET IO START ------------- //

io.on('connection', function (socket) {
    console.log('a user connected');
    socket.on('msg', function (msg) {
        console.log(msg);
    });
});





//BROADCAST  socket.broadcast.emit('update', {});


//CRON JOB EVER MINUTE
cron.schedule('* * * * *', () => {
    console.log('running a task every minute');
});






















//---------------------- FOR REST ENDPOINT LISTING ---------------------------------- //
app.get('/rest', function (req, res) {
    res.redirect('/restexplorer.html');
});

//RETURNS A JSON WITH ONLY /rest ENPOINTS TO GENERATE A NICE HTML SITE
var REST_ENDPOINT_PATH_BEGIN_REGEX = "^\/rest\/(.)*$"; //REGEX FOR ALL /rest/* beginning
var REST_API_TITLE = config.app_name | "APP NAME HERE";
var rest_endpoint_regex = new RegExp(REST_ENDPOINT_PATH_BEGIN_REGEX);
var REST_PARAM_REGEX = "\/:(.*)\/"; // FINDS /:id/ /:hallo/test
//HERE YOU CAN ADD ADDITIONAL CALL DESCTIPRION
var REST_ENDPOINTS_DESCRIPTIONS = [
    { endpoints: "/rest/update/:id", text: "UPDATE A VALUES WITH ID" }

];

app.get('/listendpoints', function (req, res) {
    var ep = listEndpoints(app);
    var tmp = [];
    for (let index = 0; index < ep.length; index++) {
        var element = ep[index];
        if (rest_endpoint_regex.test(element.path)) {
            //LOAD OPTIONAL DESCRIPTION
            for (let descindex = 0; descindex < REST_ENDPOINTS_DESCRIPTIONS.length; descindex++) {
                if (REST_ENDPOINTS_DESCRIPTIONS[descindex].endpoints == element.path) {
                    element.desc = REST_ENDPOINTS_DESCRIPTIONS[descindex].text;
                }
            }
            //SEARCH FOR PARAMETERS
            //ONLY REST URL PARAMETERS /:id/ CAN BE PARSED
            //DO A REGEX TO THE FIRST:PARAMETER
            element.url_parameters = [];
            var arr = (String(element.path) + "/").match(REST_PARAM_REGEX);
            if (arr != null) {
                //SPLIT REST BY /
                var splittedParams = String(arr[0]).split("/");
                var cleanedParams = [];
                //CLEAN PARAEMETER BY LOOKING FOR A : -> THAT IS A PARAMETER
                for (let cpIndex = 0; cpIndex < splittedParams.length; cpIndex++) {
                    if (splittedParams[cpIndex].startsWith(':')) {
                        cleanedParams.push(splittedParams[cpIndex].replace(":", "")); //REMOVE :
                    }
                }
                //ADD CLEANED PARAMES TO THE FINAL JOSN OUTPUT
                for (let finalCPIndex = 0; finalCPIndex < cleanedParams.length; finalCPIndex++) {
                    element.url_parameters.push({ name: cleanedParams[finalCPIndex] });

                }
            }
            //ADD ENPOINT SET TO FINAL OUTPUT
            tmp.push(element);
        }
    }
    res.json({ api_name: REST_API_TITLE, endpoints: tmp });
});
