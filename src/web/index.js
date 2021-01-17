var express = require('express'), http = require('http');
var app = express();
var server = http.createServer(app);
var io = require('socket.io')(server);

var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

const request = require('request');

const fs = require('fs');
const { loadBackend, getDevices, setLiveDevices, getVideos, removeVideo, setVideoMarked, runManualSync } = require('./model.js');
loadBackend();

app.use(express.static('public'));
app.set('view engine', 'ejs');

// Set up ports to use
const webPort = 9674;
const livePort = 9675;


app.get('/', function(req, res, next){
	// Read params
	let grouping = req.query.grouping;
	let sorting = req.query.sorting;
	let selected = req.query.selected;
	let groupCollapsed = req.query.groups_collapsed;
	
	// Calculate result
	let videoGroups = getVideos(grouping, sorting);
	let settings = {'grouping': grouping, 'sorting': sorting, 'groupsCollapsed': groupCollapsed};
	
	// Send response
	res.render("main", {'videoGroups': videoGroups, 'selected': selected, 'settings': settings});
});

app.get('/live', function(req, res, next){
	// Read params
	let selectedDevice = req.query.live_device;
	
	// Calculate result
	let devices = getDevices();
	
	// Send response
	res.render("live", {'devices': devices, 'selectedDevice': selectedDevice});
});

app.get('/livestream', function(req, res, next){
	let url = `http://localhost:${livePort}/live`;
	let stream = request.get(url).on('error', (e) => {
		console.log(`Error piping live stream (${url}), sending static image instead`);
		res.setHeader('Content-Type', 'image/png');
		res.sendFile(`${__dirname}/public/imgs/no-video.png`);
	});
	req.pipe(stream).pipe(res);
});

app.post("/setlivemode", function(req, res, next){
	// Read params
	let devices = req.body.devices;
	
	// Calculate result
	let deviceList = (devices !== undefined ? devices.split(",") : undefined);
	const [success, message] = setLiveDevices(deviceList, livePort);

	// Send response
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: success, message: message }));
});

app.post('/remove', function(req, res, next) {
	// Read params
	let id = req.body.videoId;

	// Calculate result
	const [success, message] = removeVideo(id);

	// Send response
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: success, message: message }));
});

app.post('/mark', function(req, res, next) {
	// Read params
	let id = req.body.videoId;

	// Calculate result
	const [success, message] = setVideoMarked(id, true);

	// Send response
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: success, message: message }));
});

app.post('/unmark', function(req, res, next) {
	// Read params
	let id = req.body.videoId;

	// Calculate result
	const [success, message] = setVideoMarked(id, false);

	// Send response
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: success, message: message }));
});

io.on('connection', (socket) => {
	console.log('A user connected');
	socket.on('manual_sync', () => {
		console.log("Triggering manual sync");
		let onStartNewSync = () => io.emit('starting_new_sync');
		let onNewUpdate = (msg) => io.emit('sync_update', msg);
		runManualSync(onStartNewSync, onNewUpdate);

	});
});

server.listen(webPort, "0.0.0.0", function(){
	console.log(`Server started. Port ${webPort}`);
});
