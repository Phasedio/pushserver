var request = require('request');
var url = require('url');
var Promise = require('promise');
var FBRef = new Firebase("https://phaseddev.firebaseio.com/");
var tokenGenerator = new FirebaseTokenGenerator("0ezGAN4NOlR9NxVR5p2P1SQvSN4c4hUStlxdnohh");
var token = tokenGenerator.createToken({uid: "modServer"});


/**
 *	Posts a status for a Slack Phased user
 *	/update
 */
exports.update = function(req, res, next) {
	console.log(req.body);

	// Figure out who we are talking to.
	var slack = req.body;
	var skackUser = req.body.user_name;
	var respondURL = url.parse(req.body.response_url);
	var phasedUser = '';

	// send response to slack immediately
	request.post({
		url: slack.response_url,
		body: {
			"response_type": "in_channel",
			"text": "#update " + slack.user_name + " : " + slack.text
		},
		json: true
	});

	// close connection to Slack API PUSH requset
	res.status(200).type('application/json').end();

	// get Phased user from FireBase
	// first get list of all slack users
	ref.child('team').child('Phased').child('intigration').child('slack').once('value', function(data) {
		data = data.val();
		var keys = Object.keys(data);

		// loop through everyone to get user matching slack username
		for (var i = 0; i < keys.length; i++) {
			if (data[keys[i]].slackName == skackUser) {
				phasedUser = data[keys[i]].phasedName;
				break;
			}
		};

		// if we've found that user, make the update
		if (phasedUser) {
			var status = {
				name: slack.text,
				time: new Date().getTime(),
				user: phasedUser,
				city: '',
				weather: '',
				taskPrefix: '',
				photo: '',
				location: {
					lat: 0,
					long: 0
				}
			};

			// update that user's status
			ref.child('team').child('Phased').child('task').child(phasedUser).set(status);
			ref.child('team').child('Phased').child('all').child(phasedUser).push(status);
		}
	});
	// write data to request body
}

/**
*
*	tell @user to [task]
*
*/
exports.tell = function(res, res, next) {

}

/**
*
*	assign [task] to @user
*
*/
exports.assign = function(res, res, next) {

}

/**
*
*	create a unassigned [task]
*
*/
exports.task = function(res, res, next) {

}

/**
*
*	get status for @user
*
*/
exports.status = function(res, res, next) {

}


/**
*
*	updates a status for a Phased user
*	assumes current team if teamID isn't supplied
*
*	returns a promise. resolve is passed nothing, reject is possibly passed a FB error.
*
*	0. auth with firebase
* 1. A) if teamID supplied, post status immediately
*	1. B) if not supplied, get it, then post status
*	2. posting status:
*		A) push to team
*		B) if successful, push to user's currentStatus
*		C) resolve promise
*/
var updateStatus = function(userID, statusText, teamID) {
	return new Promise(function(resolve, reject) {
		// fail if params are bad
		if (!userID || !status) {
			reject();
			return;
		}

		// 0. auth with FB
		FBRef.authWithCustomToken(token, function(error, authData) {
			if (error) {
				console.log("FireBase auth failed!", error);
				reject();
				return;
			}

			// 1A) if we're supplied the teamID, do the update immediately
			if (teamID && teamID != '') {
				doUpdate(teamID);
				return;
			}

			// 1B) otherwise, get the user's current team and then do the update
			getUserTeam(userID).then(doUpdate, reject);
		});

		// 2. do the update given a teamID
		var doUpdate = function(_teamID) {
			var newStatus = {
					name: statusText,
					time: new Date().getTime(),
					user: userID
				}
			// 2A) push status to team
			FBRef.child('team/' + _teamID + '/statuses').push(newStatus, function(e) {
				if (e) {
					reject(e);
					return;
				}
				// 2B) set user's current status
				FBRef.child('team/' + _teamID + '/members/' + userID + '/currentStatus').set(newStatus, function(e) {
					resolve(); // 2C) resolve our promise
				});
			});
		}
	});
}


var makeTask = function(userID, task, teamID) {

}

/**
*
*	Gets a user's current team
*	returns a promise. resolve only if team ID returned; reject if not.
*
*/
var getUserTeam = function(userID) {
	return new Promise(function(resolve, reject){
		FBRef.child('profile/' + userID + '/curTeam').once('value', function(snap) {
			var teamID = snap.val();
			if (!teamID || teamID == '' || teamID == undefined)
				reject();
			else
				resolve(teamID);
		});
	});
}

/**
*	LEGACY: Customized slack update for UIT
*/
exports.uitSlack = function(req, res, next) {
	console.log(req.body);
	var thisRes = res;
	//Figure out who we are talking to.
	var slack = req.body;
	var skackUser = req.body.user_name;
	var respondURL = url.parse(req.body.response_url);
	console.log("space, space, space");
	//console.log(respondURL);
	var phasedUser = '';
	//sendStuff(respondURL);

	//Get back to slack ASAP w/ responce (must be under 3000 ms)
	request.post({
		url: slack.response_url,
		body: {
			"response_type": "in_channel",
			"text": "#update " + slack.user_name + " : " + slack.text
		},
		json: true
	});
	ref.child('team').child('uit').child('intigration').child('slack').once('value', function(data) {

		data = data.val();
		var keys = Object.keys(data);

		for (var i = 0; i < keys.length; i++) {
			if (data[keys[i]].slackName == skackUser) {
				phasedUser = data[keys[i]].phasedName;
				break;
			}
		};

		if (phasedUser) {
			var status = {
				name: slack.text,
				time: new Date().getTime(),
				user: phasedUser,
				city: '',
				weather: '',
				taskPrefix: '',
				photo: '',
				location: {
					lat: 0,
					long: 0
				}
			};

			//thisRes.status(200).type('application/json').end();

			ref.child('team').child('uit').child('task').child(phasedUser).set(status);
			ref.child('team').child('uit').child('all').child(phasedUser).push(status);

		} else {
			request.post({
				url: slack.response_url,
				body: {
					"text": "Sorry! You haven't yet been added to the uit phased team. Please contact Brian Best(@brianbest) for more information. "
				},
				json: true
			});

		}
	});
	res.end(); //close the responce 
	// write data to request body
}