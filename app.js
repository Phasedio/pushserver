var restify = require('restify');
var http = require('http');
var Parse = require('node-parse-api').Parse;

var APP_ID = 'S1R7aIPJPXKPPF2cOcFkJ9zluitibxyOjjvUZWfg';
var MASTER_KEY = 'EWYQKz5ZEbC7i7tPTbk5V5Mq30yJXXGXAJgRLGUP';

var app = new Parse(APP_ID, MASTER_KEY);

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
  app.sendPush(notification, function(err, resp){
    console.log(resp);
    res.send('hello ' + req.params.name);
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


var server = restify.createServer();
//server.get('/hello/:name', respond);
server.get('/register/:platform/:token/:user/:team/:senderID', register);
server.get('/push/nudge/:user/:sender', pushNudge);
server.get('/push/update/:team/:sender/:message', pushUpdate);
//server.head('/hello/:name', respond);

server.listen(8080, function() {
  console.log('%s listening at %s', server.name, server.url);
});
