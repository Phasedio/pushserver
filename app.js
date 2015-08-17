var restify = require('restify');
var http = require('http');
var Parse = require('node-parse-api').Parse;

var APP_ID = 'S1R7aIPJPXKPPF2cOcFkJ9zluitibxyOjjvUZWfg';
var MASTER_KEY = 'EWYQKz5ZEbC7i7tPTbk5V5Mq30yJXXGXAJgRLGUP';

var app = new Parse(APP_ID, MASTER_KEY);

// function respond(req, res, next) {
//
//
//
//     var options = {
//     host: 'push.ionic.io',
//     path: '/api/v1/push',
//     auth: '62e4043cdea5ff673f4a6dd3e752325ca57996fec97ffedc'+':',
//     method: 'POST',
//     //This is the only line that is new. `headers` is an object with the headers to request
//     headers: {
//       "Content-Type": "application/json",
//       "X-Ionic-Application-Id": "32c45998"
//       }
//   };
//
//   callback = function(response) {
//     var str = '';
//
//     //another chunk of data has been recieved, so append it to `str`
//     response.on('data', function (chunk) {
//       str += chunk;
//     });
//
//     //the whole response has been recieved, so we just print it out here
//     response.on('end', function () {
//       res.send('hello ' + req.params.name);
//       console.log(req.params.name);
//       console.log(str);
//     });
//   };
//
//   var push = http.request(options, callback);
//   var msg ={"tokens":[
//     req.params.name
//   ],
//   "notification":{
//     "alert":"Hello World!",
//     "ios":{
//       "badge":1,
//       "sound":"ping.aiff",
//       "expiry": 1423238641,
//       "priority": 10,
//       "contentAvailable": true,
//       "payload":{
//         "key1":"value",
//         "key2":"value"
//       }
//     },
//     "android":{
//       "collapseKey":"foo",
//       "delayWhileIdle":true,
//       "timeToLive":300,
//       "payload":{
//         "key1":"value",
//         "key2":"value"
//       }
//     }
//   }
// };
// msg = JSON.stringify(msg);
//   push.write(msg);
// push.end();
//
//   next();
// }

function register(req, res, next){
  console.log('got reg');
  app.insertInstallationData("ios",req.params.token , function(err, response){
    if (err) {
      console.log(err);
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
        } else {
          console.log(response);

        }
      });
    }
  });

};

function pushNudge(req, res, next){
  var notification = {
  // "where": {
  //
  //channels: ["t"],
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
app.sendPush(notification, function(err, resp){
  console.log(resp);
  res.send('hello ' + req.params.name);
});
}


var server = restify.createServer();
//server.get('/hello/:name', respond);
server.get('/register/:token/:user', register);
server.get('/push/nudge/:user/:sender', pushNudge);
//server.head('/hello/:name', respond);

server.listen(8080, function() {
  console.log('%s listening at %s', server.name, server.url);
});
