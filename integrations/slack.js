var request = require('request');
var url = require('url');
var Promise = require('promise');

var Firebase = require("firebase");
var FirebaseTokenGenerator = require("firebase-token-generator");
var FBRef = new Firebase("https://phaseddev.firebaseio.com/");
var tokenGenerator = new FirebaseTokenGenerator("0ezGAN4NOlR9NxVR5p2P1SQvSN4c4hUStlxdnohh");
var token = tokenGenerator.createToken({uid: "slack-server"});

// tokens to confirm our hit is coming from slack
var slackTokens = {
	update : 'N7etE1hdGQKZ2rHR4hWOPA2N'
}

/**
 *	Posts a status for a Slack Phased user
 *	/update
 *
 *	1. immediately reply to slack
 *		a) send them a post request
 *		b) shut down their post request with 200
 *	2. post to phased FB
 *		a) auth with FB
 *		b) get slack user's Phased ID
 *		c) update their status
 */
exports.update = function(req, res, next) {
	console.log('updating...', req.body);
	// 0. verify token
	if (req.body.token !== slackTokens.update) {
		res.end();
		return;
	}

	// 1. reply to slack
	var slack = req.body;
	request.post({
		url: slack.response_url,
		body: {
			"response_type": "in_channel",
			"text": "#update " + slack.user_name + " : " + slack.text
		},
		json: true
	});

	// close connection to Slack API PUSH requset
	res.end();

	// Post the new status update after authenticating and getting the Phased user ID
	// 2a)
	FBRef.authWithCustomToken(token, function(error, authData) {
		if (error) {
			console.log("FireBase auth failed!", error);
			return;
		}

		// 2b)
		getPhasedIDs(slack.user_id, slack.team_id).then(function(args) {
			// 2c)
			updateStatus(args.userID, args.teamID, slack.text);
		});
	});
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
*	REQUIRES AUTHORIZED FBRef
*
*	returns a promise. resolve is passed nothing, reject is possibly passed a FB error.
*
* 1. A) if teamID supplied, post status immediately
*	1. B) if not supplied, get it, then post status
*	2. posting status:
*		A) push to team
*		B) if successful, push to user's currentStatus
*		C) resolve promise
*/
var updateStatus = function(userID, teamID, statusText) {
	return new Promise(function(resolve, reject) {
		// fail if params are bad
		if (!userID || !statusText) {
			reject();
			return;
		}

		// 2. do the update given a teamID
		var newStatus = {
				name: statusText,
				time: new Date().getTime(),
				user: userID
			}

		// 2A) push status to team
		FBRef.child('team/' + teamID + '/statuses').push(newStatus, function(e) {
			if (e) {
				console.log(e);
				reject(e);
				return;
			}
			// 2B) set user's current status
			FBRef.child('team/' + teamID + '/members/' + userID + '/currentStatus').set(newStatus, function(e) {
				resolve(); // 2C) resolve our promise
			});
		});
	});
}

/**
*
*	makes a task
*	REQUIRES AUTHORIZED FBRef
*
*	assumes current team if no teamID supplied.
*	currently hardcoded to the default project/column/card.
*
*	returns a promise.
*
*	options.assigned_to should be a Phased user ID
*	options.deadline should be a timestamp
*
*/
var makeTask = function(userID, teamID, taskText, options) {
	return new Promise(function(resolve, reject) {
		// hardcorded defaults:
		var projectID = '0A',
			columnID = '0A',
			cardID = '0A';

		// prime task object
		task = {
			name : taskText,
			created_by : userID,
			assigned_by : userID,
			created : new Date().getTime()
		}

		if (options) {
			if (options.assignee)
				task.assigned_to = options.assignee;
			else
				task.unassigned = true;

			if (options.deadline)
				task.deadline = options.deadline;
		}

		// add task to db
		var newTaskRef = FBRef.child('team/' + teamID + '/projects/' + projectID + '/columns/' + columnID + '/cards/' + cardID + '/tasks').push(task, function(e) {
			if (e)
				reject(e);
			else
				resolve();
		});
		
		// update task history
		newTaskRef.push({
			time : Firebase.ServerValue.TIMESTAMP,
			type : 0, // created
			snapshot : task
		}, function(e) {
			if (e)
				console.log(e); // don't reject here because it could be rejected twice
		});
	});
}

/**
*
*	Gets a user's current team
*	REQUIRES AUTHORIZED FBRef.
*
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
*
*	Gets a Phased user ID and teamID from their slack IDs.
*	REQUIRES AUTHORIZED FBRef.
*
*	returns a promise resolved with the Phased userID and teamID
*
*/
var getPhasedIDs = function(slackUserID, slackTeamID) {
	return new Promise(function(resolve, reject) {
		FBRef.child('integrations/slack/users/' + slackUserID).once('value', function(snap) {
			var userID = snap.val();
			if (!userID) {
				reject();
			} else {
				FBRef.child('integrations/slack/teams/' + slackTeamID).once('value', function(snap) {
					var teamID = snap.val();
					if (!teamID) {
						reject();
					} else {
						resolve({userID:userID, teamID:teamID});
					}
				});
			}
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