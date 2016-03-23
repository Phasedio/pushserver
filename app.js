var restify = require('restify');
var querystring = require('querystring');
var http = require('http');
var url = require('url');
var Parse = require('node-parse-api').Parse;
var Firebase = require("firebase");
var FirebaseTokenGenerator = require("firebase-token-generator");
var request = require('request');
var curl = require('curlrequest');
var client = require('twilio')('ACa18b9467c994bf9c72ccc5f23e91f735', '8516dd1bd8336820ec1919dd346c286a');
var Promise = require('promise');

var phasedSlack = require('./integrations/slack');
 
var ref = new Firebase("https://phaseddev.firebaseio.com/");
var tokenGenerator = new FirebaseTokenGenerator("0ezGAN4NOlR9NxVR5p2P1SQvSN4c4hUStlxdnohh");
var token = tokenGenerator.createToken({uid: "modServer", some: "arbitrary", data: "here"});
ref.authWithCustomToken(token, function(error, authData) {
  if (error) {
    console.log("Login Failed!", error);
  } else {
    console.log("Login Succeeded!", authData);
  }
});
var APP_ID = 'S1R7aIPJPXKPPF2cOcFkJ9zluitibxyOjjvUZWfg';
var MASTER_KEY = 'EWYQKz5ZEbC7i7tPTbk5V5Mq30yJXXGXAJgRLGUP';

var app = new Parse(APP_ID, MASTER_KEY);
var PhasedNumber = '+12263180675';

function register(req, res, next){
  console.log('got reg');
  var chl = [req.params.team];
  app.insertInstallationDataWithChannels(req.params.platform,req.params.token,chl,req.params.senderID, function(err, response){
    if (err) {
      console.log(err);
      res.send('error: ' + err);
    } else {
      console.log(response);
      console.log(req.params.user);
      var obj = {

          "__type": "Pointer",
          "className": "_User",
          "objectId": req.params.user

      };
      app.addInstallationUser(response.objectId,obj,function(err,response){
        if (err) {
          console.log(err);
          res.send('error: ' + err);
        } else {
          console.log(response);
          res.send('success: ' + response);
        }
      });
    }
  });

};

function pushNudge(req, res, next){
  var notification = {
    "where": {
            "user": {
              "$inQuery":{
                "where" : {
                  "username" : "" + req.params.user
                },
                "className" : "_User"
              }
            }
          },
    data: {
      alert: req.params.sender + " on your team is wondering what you are up to?",
      "badge": "1",
      "title": "Nudge!",
      "sound" : "default"
    }
  };
  console.log(req.params);
  app.sendPush(notification, function(err, resp){
    console.log(resp);
    res.send('Hello, ' + req.params.sender);
  });
}

function pushUpdate(req, res, next){
  var notification = {
  channels: [req.params.team],
  data: {
    alert: req.params.sender + " is "+ req.params.message,
    "badge": "1",
    "title": "Nudge!",
    "sound" : "default"
  }
};
app.sendPush(notification, function(err, resp){
  console.log(resp);
  res.send('hello ' + req.params.name);
});
}



function twiliPush(req, res, next){
  //Send an SMS text message
  client.sendMessage({
    to:'+19025780701', // Any number Twilio can deliver to
    from: PhasedNumber, // A number you bought from Twilio and can use for outbound communication
    body: 'word to your mother.' // body of the SMS message
  }, function(err, responseData) { //this function is executed when a response is received from Twilio

    if (!err) { // "err" is an error received during the request, if any

        // "responseData" is a JavaScript object containing data received from Twilio.
        // A sample response from sending an SMS message is here (click "JSON" to see how the data appears in JavaScript):
        // http://www.twilio.com/docs/api/rest/sending-sms#example-1

        console.log(responseData.from); // outputs "+14506667788"
        console.log(responseData.body); // outputs "word to your mother."
      }
  });
}

function smsRecived(req, res, next){
  console.log('sms received');
  var msg = req.body;
  var text = req.body.Body;

  // get # route from body if in first position
  text = text.trim(); // trim whitespaces
  var hashRoute = 'update'; // default to update
  if (text.indexOf('#') == 0) {
    // if there is a hash in the first place, split it out and keep the rest of the message
    text = text.split('#')[1].split(' ');
    hashRoute = text[0];
    text = text[1];
  }

  switch (hashRoute) {
    case 'update' :
      updateStatus(text, msg.From);
      break;
    case 'task' :
    case 'tasks' :
      sendTasks(msg.From);
      break;
    case 'team' :
      sendTeam(msg.From);
      break;
    case 'help' :
      sendHelp(msg.From);
      break;
    default:
      console.log('smsRecived but I don\'t know what to do with it!', hashRoute, text);
      return;
  }

  //thisRes.status(200).type('application/json').end();
  //ref.child('team').child('Phased').child('task').child('simplelogin:1').set(status);
  //ref.child('team').child('Phased').child('all').child('simplelogin:1').push(status);
}

function updateStatus(status, tel) {
  new Firebase("https://phaseddev.firebaseio.com/profile").orderByChild('tel').startAt(tel)
    .endAt(tel)
    .once('value', function(snap) {
       var data = snap.val();
       if(data){
         var keys = Object.keys(data);
         var user = keys[0];
         var team = data[user].curTeam;

         var newStatus = {
           name: status,
           time: new Date().getTime(),
           user:user,
           city:'',
           weather:'',
           taskPrefix : '',
           photo : '',
           location:{
             lat : 0,
             long : 0
           }
         };

         console.log('updating status...');
         ref.child('team').child(team).child('task').child(user).set(newStatus);
         ref.child('team').child(team).child('all').child(user).push(newStatus);
         console.log('status updated');
       }
    });
}

/**
*
* sends the numTasks most recent assignments to tel
*
* 1. get the user's id from FireBase (/profiles)
* 2. get the assignment ids from FireBase (/team/[team]/assignments/to/[userID])
* 3. get the assignments from FireBase (/team/[team]/assignments/all)
*
*/
function sendTasks(tel, numTasks) {
  numTasks = numTasks || 10;
  console.log('getting tasks for', tel);
  // 1.
  getProfileFromTel(tel)
    .then(function(profile){
      // 2.
      ref.child("team/" + profile.curTeam + "/assignments/to/" + profile.uid).once('value', function(data) {
        taskList = data.val();
        if (!taskList) {
          // no tasks assigned to this user, let them know and gracefully exit;
          console.log('no assignments', taskList);
          client.sendMessage({
            to : tel,
            from : PhasedNumber,
            body : 'No tasks assigned to you, ' + profile.name
          });
          return;
        } else {
          // 3.
          // there are tasks, get them
          ref.child('team/' + profile.curTeam + '/assignments/all').orderByChild('assignee')
            .equalTo(profile.uid)
            .once('value', function(data) {
              var myTasks = data.val();
              if (!myTasks) {
                console.log('no tasks???', myTasks);
                return;
              }

              // sort tasks by date since FB only allows one orderBy param
              // reverse chronologically: most recent assignments first
              myTasks = objToArray(myTasks);
              myTasks.sort(function(a, b){
                  if(a.time < b.time) return 1;
                  if(a.time > b.time) return -1;
                  return 0;
              });
              // console.log(myTasks);

              // generate message
              var msg = '',
                i = 0;
              for (i; i < myTasks.length && i < numTasks; i++) {
                msg += '(' + (i+1) +') ' +
                  myTasks[i].name + '\r\n';
              }
              msg =  'Your ' + i + ' most recently assigned tasks:\n\r' + msg;
              console.log(msg);
              client.sendMessage({
                to : tel,
                from : PhasedNumber,
                body : msg
              }, function(e) { console.log(e) });
            });
        }
      });
    })
    .catch(function(e){
      console.log(e);
    })
}

/**
*
* sends the numMembers most recently updated team members and their statuses to tel
*
* 1. get the user's id from FireBase
* 2. get the user's team's tasks
* 3. get team's members
* 4. make and send message
*/

function sendTeam(tel, numMembers) {
  numMembers = numMembers || 10;

  // 1.
  getProfileFromTel(tel)
    .then(function(profile) {

      // 2. get tasks
      ref.child('team/' + profile.curTeam + '/task')
        .orderByChild('time')
        .limitToFirst(numMembers)
        .once('value', function(data) {
          tasks = data.val();

          if (!tasks) {
            // gracefully fail if no recent updates
            console.log('no recent updates');
            client.sendMessage({
              to : tel,
              from : PhasedNumber,
              body : 'No recent updates!'
            });
            return;
          } else {
            // sort tasks reverse chronologically
            tasks = objToArray(tasks);
            tasks.sort(function(a, b){
                if(a.time < b.time) return 1;
                if(a.time > b.time) return -1;
                return 0;
            });

            // 3. get team users to get member names
            ref.child('profile')
              .orderByChild('curTeam')
              .equalTo(profile.curTeam)
              .once('value', function(data) {

                var users = data.val();
                if (!users) {
                  console.log('no recent updates');
                  client.sendMessage({
                    to : tel,
                    from : PhasedNumber,
                    body : 'No recent updates!'
                  });
                  return;
                }

                // 4. make message
                var msg = 'Recent updates for ' + profile.curTeam + '\r\n';
                var weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

                for (var i in tasks) {
                  if (users[tasks[i].user]) {
                    var date = new Date(tasks[i].time);
                    msg += users[tasks[i].user].name + ': ' + tasks[i].name + ' ';
                    msg += '(' + weekdays[date.getDay()] + ' ' + months[date.getMonth()] + ' ' + date.getDate() + ')';
                    msg += '\r\n';
                  }
                }

                // send message
                console.log('sending team update');
                client.sendMessage({
                  to : tel,
                  from : PhasedNumber,
                  body : msg
                });
              });
          }
        });
    })
    .catch(function(e){
      console.log('caught');
      console.log(e);
    });
}

/**
*
* sends a simple usage message to tel
*
*/
function sendHelp(tel) {
  console.log('sending a help message');
  var msg = 'How to use the Phased.io SMS service:\r\n' +
    'send a message without a #command to update your status\r\n' +
    'send #team to get your team\'s recent updates\r\n' +
    'send #tasks to get your to do list\r\n' +
    'send #help to see these notes again';
  client.sendMessage({
    to: tel,
    from: PhasedNumber,
    body: msg
  });
}

// returns a promise that delivers the user object in .then();
function getProfileFromTel(tel) {
  var p = new Promise( function(resolve, reject) {
    ref.child("profile").orderByChild('tel').equalTo(tel)
      // .endAt(tel)
      .once('value', function(data){
        data = data.val();
        if (data) {
          var keys = Object.keys(data);
          var profile = data[keys[0]];
          profile.uid = keys[0];
          resolve(profile);
        } else {
          reject('no data');
        }
      });
    });
  return p;
}

/**
*
* a simple welcome to users of the webapp
*
*/
function welcomeWeb(snapshot, key) {
  var tel = snapshot.val();
  console.log('sending a welcome message to ' + tel);
  if (!tel) {
    console.log('no tel!');
    return;
  }

  getProfileFromTel(tel)
    .then(function(profile){
      var msg = 'Welcome to Phased.io, ' + profile.name + '!\r\n' +
        'How to use the Phased.io SMS service:\r\n' +
        'send a message without a #command to update your status\r\n' +
        'send #team to get your team\'s recent updates\r\n' +
        'send #tasks to get your to do list\r\n' +
        'send #help to see these notes again';
      client.sendMessage({
        to: tel,
        from: PhasedNumber,
        body: msg
      });

      // delete number
      ref.child('newTel/' + snapshot.key()).set(null);
    })
    .catch(function(e){
      console.log('caught');
      console.log(e);
    });
}

ref.child('newTel').on('child_added', welcomeWeb);



// convert object into array
var objToArray = function(obj) {
  var newArray = [];
  for (var i in obj) {
    newArray.push(obj[i]);
  }
  return newArray;
}

var server = restify.createServer();
server.use(restify.bodyParser({ mapParams: false }));
//server.get('/hello/:name', respond);
server.get('/register/:platform/:token/:user/:team/:senderID', register);
server.get('/push/nudge/:user/:sender', pushNudge);
server.get('/push/update/:team/:sender/:message', pushUpdate);
server.get('/sms/colin/:message', twiliPush);
server.post('/sms/recived', smsRecived); // gateway for incoming texts

// slack routes
server.post('/slack/uit', phasedSlack.uitSlack); // dedicated UIT route
server.post('/slack/update', phasedSlack.update); // /update status
server.post('/slack/tell', phasedSlack.tell); // tell [user] to [task]
server.post('/slack/assign', phasedSlack.assign); // assign [task] to [user]
server.post('/slack/task', phasedSlack.task); // create a [task]
server.post('/slack/status', phasedSlack.status); // get status for user
//server.head('/hello/:name', respond);

server.listen(8080, function() {
  console.log('%s listening at %s', server.name, server.url);
});
