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

function slack(req, res, next){
  console.log(req.body);
   //Figure out who we are talking to.
   var slack = req.body;
   var skackUser = req.body.user_name;
   var respondURL = url.parse(req.body.response_url);
   console.log("space, space, space");
   //console.log(respondURL);
   var phasedUser = '';
   //sendStuff(respondURL);
   request.post({ url:slack.response_url, body:{"response_type": "in_channel","text":"#update "+slack.user_name+" : "+slack.text}, json:true});
   res.status(200).type('application/json').end();


   ref.child('team').child('Phased').child('intigration').child('slack').once('value',function(data){

     data = data.val();

     var keys = Object.keys(data);
     for (var i = 0; i < keys.length; i++) {
       if (data[keys[i]].slackName == skackUser){
          phasedUser = data[keys[i]].phasedName;
          break;
       }
     };
     if(phasedUser){
      var status = {
        name: slack.text,
        time: new Date().getTime(),
        user:phasedUser,
        city:'',
        weather:'',
        taskPrefix : '',
        photo : '',
        location:{
          lat : 0,
          long : 0
        }
      };

      ref.child('team').child('Phased').child('task').child(phasedUser).set(status);
      ref.child('team').child('Phased').child('all').child(phasedUser).push(status);
     }
   });

   //


// write data to request body
}
function uitSlack(req, res, next){
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



   ref.child('team').child('uit').child('intigration').child('slack').once('value',function(data){

     data = data.val();

     var keys = Object.keys(data);
     for (var i = 0; i < keys.length; i++) {
       if (data[keys[i]].slackName == skackUser){
          phasedUser = data[keys[i]].phasedName;
          break;
       }
     };
     if(phasedUser){
      var status = {
        name: slack.text,
        time: new Date().getTime(),
        user:phasedUser,
        city:'',
        weather:'',
        taskPrefix : '',
        photo : '',
        location:{
          lat : 0,
          long : 0
        }
      };
      request.post({ url:slack.response_url, body:{"response_type": "in_channel","text":"#update "+slack.user_name+" : "+slack.text}, json:true});
      //thisRes.status(200).type('application/json').end();

      ref.child('team').child('uit').child('task').child(phasedUser).set(status);
      ref.child('team').child('uit').child('all').child(phasedUser).push(status);

    }else{
      request.post({ url:slack.response_url, body:{"text":"Sorry! You haven't yet been added to the uit phased team. Please contact Brian Best(@brianbest) for more information. "}, json:true});

    }
   });
   //res.status(200).type('application/json').end();


// write data to request body
}

function twiliPush(req, res, next){
  //Send an SMS text message
client.sendMessage({

    to:'+19025780701', // Any number Twilio can deliver to
    from: '+12263180675', // A number you bought from Twilio and can use for outbound communication
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
  //console.log(req.body);
  var msg = req.body;
  console.log(msg.From);
  var text = req.body.Body;
  new Firebase("https://phaseddev.firebaseio.com/profile").orderByChild('tel').startAt(msg.From)
    .endAt(msg.From)
    .once('value', function(snap) {
      console.log('these are the accounts');

       var data = snap.val();
       if(data){
         var keys = Object.keys(data);
         var user = keys[0];
         var team = data[user].curTeam;

         var status = {
           name: text,
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

         ref.child('team').child(team).child('task').child(user).set(status);
         ref.child('team').child(team).child('all').child(user).push(status);

       }


    });

  console.log(text);

  //thisRes.status(200).type('application/json').end();
  //ref.child('team').child('Phased').child('task').child('simplelogin:1').set(status);
  //ref.child('team').child('Phased').child('all').child('simplelogin:1').push(status);
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

var server = restify.createServer();
server.use(restify.bodyParser({ mapParams: false }));
//server.get('/hello/:name', respond);
server.get('/register/:platform/:token/:user/:team/:senderID', register);
server.get('/push/nudge/:user/:sender', pushNudge);
server.get('/push/update/:team/:sender/:message', pushUpdate);
server.get('/sms/colin/:message', twiliPush);
server.post('/sms/recived', smsRecived);
server.post('/slack', slack);
server.post('/slack/uit', uitSlack);
//server.head('/hello/:name', respond);

server.listen(8080, function() {
  console.log('%s listening at %s', server.name, server.url);
});
