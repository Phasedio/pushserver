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
	update : 'N7etE1hdGQKZ2rHR4hWOPA2N',
	task : 'IvbJXqmXcMrH2c3vveEEVdoK'
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
	var slackReq = req.body;
	// 0. verify token
	if (slackReq.token !== slackTokens.update) {
		res.end();
		return;
	}

	// user didn't enter a status
	if (!('text' in slackReq) || slackReq.text.length === 0 || slackReq.text === ' ') {
		res.send(200, {
			text : 'Whoops, looks like you forgot to add a status! Just write it right after the slash command there.',
			ephemeral : true
		});
		return;
	} else {
		res.send(200, {text: "Great, I'll post that status!"});
	}

	// Post the new status update after authenticating and getting the Phased user ID
	// 2a)
	FBRef.authWithCustomToken(token, function(error, authData) {
		if (error) {
			console.log("FireBase auth failed!", error);
			slackReplyError(slackReq.response_url);
			return;
		}

		// 2b)
		getPhasedIDs(slackReq).then(function(args) {
			// 2c)
			updateStatus(args.userID, args.teamID, slackReq.text).then(function(){
				slackReply(slackReq.response_url,
					'Your Phased.io status has been updated.',
					true,
					slackReq.text);
			}, function(){
				slackReplyError(slackReq.response_url);
			});
		}, notLinkedYet);
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
exports.task = function(req, res, next) {
	console.log('making unassigned task...', req.body);
	var slackReq = req.body;
	// 0. verify token
	if (slackReq.token !== slackTokens.task) {
		res.end();
		return;
	}

	// user didn't enter a status
	if (!('text' in slackReq) || slackReq.text.length === 0 || slackReq.text === ' ') {
		res.send(200, {
			text : 'Whoops, looks like you forgot to add a task name! Just write it right after the slash command there.',
			ephemeral : true
		});
		return;
	} else {
		res.send(200, {text: "I'll make that task."});
	}

	// Post the new status update after authenticating and getting the Phased user ID
	// 2a)
	FBRef.authWithCustomToken(token, function(error, authData) {
		if (error) {
			console.log("FireBase auth failed!", error);
			slackReplyError(slackReq.response_url);
			return;
		}

		// 2b)
		getPhasedIDs(slackReq).then(function(args) {
			// 2c)
			makeTask(args.userID, args.teamID, slackReq.text).then(function(){
				slackReply(slackReq.response_url,
					'Your new task has been added to Phased.',
					true,
					slackReq.text);
			}, function(){
				slackReplyError(slackReq.response_url);
			});
		}, notLinkedYet);
	});
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
			status : 2, // assigned
			time : new Date().getTime()
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
		newTaskRef.child('history').push({
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
*	the rejected promise is passed a firebase error OR an object
*	describing whether the user or team is missing their ID
*
*	It works well to set notLinkedYet as the resolve function,
*	but it's left open in case more fine-grained handling is needed.
*
*/
var getPhasedIDs = function(slackReq) {
	var slackUserID = slackReq.user_id,
		slackTeamID = slackReq.team_id;

	return new Promise(function(resolve, reject) {
		console.log('looking for user');
		FBRef.child('integrations/slack/users/' + slackUserID).once('value', function(snap) {
			var userID = snap.val();
			if (!userID) {
				reject({missingID : 'user', slackReq : slackReq});
			} else {
				console.log('found user, looking for team');
				FBRef.child('integrations/slack/teams/' + slackTeamID).once('value', function(snap) {
					var teamID = snap.val();
					if (!teamID) {
						reject({missingID : 'team', slackReq : slackReq});
					} else {
						resolve({userID : userID, teamID : teamID});
					}
				}, function(e) {
					reject({error : e, slackReq : slackReq});
				});
			}
		}, function(e) {
			reject({error : e, slackReq : slackReq});
		});
	});
}


/**
*
*	Simple set of responses for case where user or team hasn't been linked yet.
*
*	args should be the reject object from getPhasedIDs,
*	args.slackReq should be the original req.body
*
*/
var notLinkedYet = function(args) {
	console.log('notLinkedYet', args);
	if ('missingID' in args) {
		if (args.missingID == 'user') {
			slackReply(args.slackReq.response_url, 
				'Looks like you haven\'t linked up your Slack and Phased accounts yet. Link your account with the /link command.',
				true);
		} else if (args.missingID == 'team') {
			console.log('team missing');
			slackReply(args.slackReq.response_url, 'Looks like your team isn\'t hasn\'t linked their Slack and Phased accounts yet. Contact your team administrator to set this up.', true);
		} else
			slackReplyError(args.slackReq.response_url);
	} else {
		console.log('no missingID');
		slackReplyError(args.slackReq.response_url);
	}
}

/**
*
*	Wrapper to add ~*~ syntactical sugar ~*~
*	to reply to slack
*
*	set ephemeral to true to reply only to that user
*
*/
var slackReply = function(url, text, ephemeral, attachment) {
	console.log('slackReply');
	var body = {
			"response_type": ephemeral ? "ephemeral" : "in_channel",
			"text": text
		};
	console.log('doing reply', body);
	if (attachment)
		body.attachments = [{text: attachment}];
	console.log('sending req');
	request.post({
		url: url,
		body: body,
		json: true
	});
};

/**
*
*	Standard fail whale
*
*/
var slackReplyError = function(url) {
	console.log('slackReplyErr');
	slackReply(url, 
		'There\'s been an error on our end—sorry!',
		true);
}

/**
*	LEGACY: Customized slack update for UIT
*/
exports.uitSlack = function(req, res, next) {
	slackReply(req.body.response_url, 'Sorry, the Phased.io Slack integration is down for maintenance. We\'ll be back soon with even better features!');
	res.end();
	return;
}