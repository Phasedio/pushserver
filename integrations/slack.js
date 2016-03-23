var request = require('request');
var url = require('url');
var ref = new Firebase("https://phaseddev.firebaseio.com/");
var tokenGenerator = new FirebaseTokenGenerator("0ezGAN4NOlR9NxVR5p2P1SQvSN4c4hUStlxdnohh");
var token = tokenGenerator.createToken({uid: "modServer"});
ref.authWithCustomToken(token, function(error, authData) {
  if (error) {
    console.log("Login Failed!", error);
  } else {
    console.log("Login Succeeded!", authData);
  }
});

/**
 *	Posts a status for a Slack Phased user
 *	/update
 */
exports.slack = function(req, res, next) {
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
*	Customized slack update for UIT
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