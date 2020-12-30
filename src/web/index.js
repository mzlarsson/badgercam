var express = require('express'), http = require('http');
var app = express();
var server = http.createServer(app);

const fs = require('fs');
const { loadBackend, getVideos, removeVideo, setVideoMarked } = require('./model.js');
loadBackend();

app.use(express.static('public'));
app.set('view engine', 'ejs');


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

app.get('/remove', function(req, res, next) {
	// Read params
	let id = req.query.videoId;

	// Calculate result
	const [success, message] = removeVideo(id);

	// Send response
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: success, message: message }));
});

app.get('/mark', function(req, res, next) {
	// Read params
	let id = req.query.videoId;

	// Calculate result
	const [success, message] = setVideoMarked(id, true);

	// Send response
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: success, message: message }));
});

app.get('/unmark', function(req, res, next) {
	// Read params
	let id = req.query.videoId;

	// Calculate result
	const [success, message] = setVideoMarked(id, false);

	// Send response
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: success, message: message }));
});


server.listen(9674, "0.0.0.0", function(){
	console.log('Server started. Port 9674');
});
