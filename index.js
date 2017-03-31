/**
*  This is a webhook server that listens for webhook
*  callbacks coming from Wistia, and updates a contact's HubSpot
*  record of `videos_played` each time it is called from the data
*  gathered from the webhook payload
*
*  TO GET STARTED
*  * Add your HubSpot API & Wistia API keys and uuid to .env file 
*  * (Run a test webhook from Wistia to get the uuid of the payload)
*  * Install dependencies via `npm install`
*  * Run `node index.js` on a publicly visible IP
*  * Register your webhook and point to http://<ip or domain>:3123
*
*  @author: Jeff Reiner (mirshko)
*/

require('dotenv').config();

var express     = require('express'),
	rp          = require('request-promise'),
	app         = express(),
	bodyParser  = require('body-parser'),
	port        = process.env.PORT || 3123,
	wapiKey     = process.env.WAPI_KEY,
	hapiKey 	= process.env.HAPI_KEY,
	uuid        = process.env.UUID

// EASILY READ THE PAYLOAD FROM THE WEBHOOK
app.use(bodyParser.json());

// VERIFY UUID FROM WISTIA PAYLOAD IS THE ONE WE WANT, IF NOT DON'T RUN API CALLS
function verify(req, res, next) {
	if (req.body.hook.uuid == uuid) {
		next();
	} else {
		res.sendStatus(200);
		console.log('Desired UUID Not Present');
	}
}

// DO ALL THE API STUFF
function hubstia(req, res, next) {
	// VISITOR KEY COMES FROM WEBHOOK PAYLOAD FROM WISTIA
	console.log('Wistia Visitor `id`: ' + req.body.events[0].payload.visitor.id);
	
	// VARS
	var playCount = 0,
		videosPlayed = 0,
		contactEmail = 'bh@hubspot.com',
		visitorKey = req.body.events[0].payload.visitor.id;
	
	// CALL TO WISTIA WITH KEY FROM WEBHOOK PAYLOAD TRIGGERED BY A VIDEO PLAY EVENT
	var wistiaPath = 'https://api.wistia.com/v1/stats/visitors/' + visitorKey + '.json?api_password=' + wapiKey;
	
	// CALL TO HUBSPOT WITH EMAIL FROM WISTIA STATS API RESPONSE DATA
	var hubspotPath = 'https://api.hubapi.com/contacts/v1/contact/email/' + contactEmail + '/profile?hapikey=' + hapiKey;	
		
	/***
	 * NOTE: CALL TO WISTIA TO GET EMAIL FROM WEBHOOK
	 ***/
	 
	rp({
		method: 'GET',
		uri: wistiaPath,
		json: true,
		resolveWithFullResponse: true
	}).
	then(function (response) {
		/***
		 * NOTE: GET VISITOR'S `play_count` AND `visitor_identity` EMAIL FROM WISTIA
		 ***/
		if (response.statusCode == 200) {
			console.log('Wistia Visitor `play_count`: ' + response.body.play_count);
			playCount = response.body.play_count;
			
			if (response.body.visitor_identity.email != null) {
				/***
				 * NOTE: IF WISTIA VISITOR HAS AN EMAIL ATTACHED TO THEIR ID MAKE CALL TO HUBSPOT
				 *       TO LOOKUP THEIR INFORMATION FROM THE WISTIA RESPONSE,
				 *       THIS WON'T RUN IF THEY DON'T HAVE AN EMAIL
				 ***/
				contactEmail = response.body.visitor_identity.email;
				console.log('Wistia Visitor `email`: ' + contactEmail);
				hubspotPath = 'https://api.hubapi.com/contacts/v1/contact/email/' + contactEmail + '/profile?hapikey=' + hapiKey;	
				
				return rp({
					method: 'GET',
					uri: hubspotPath,
					json: true,
					resolveWithFullResponse: true
				});
			} else {
				throw 'No Email';
			}
		} else {
			throw new Error('Wistia GET Failed: ' + response.statusCode);
		}
	})
	.then(function (response) {
		if (response.statusCode == 200) {
			/***
			 * NOTE: PRINTS THE EMAIL IN THE HUBSPOT CONTACT RECORD. IF THE VALUE OF THE HUBSPOT CONTACT RECORD ISN'T SET
			 *       THEN SET A DEFAULT VALUE OF 0. THIS VALUE IS THEN UPDATED BY THE VALUE TAKEN FROM WISTIA
			 ***/
			console.log('HubSpot Contact `email`: ' + response.body.properties.email.value);
			if (response.body.properties.videos_played === undefined || response.body.properties.videos_played.value === '') {
				videosPlayed = 0;
				console.log('Set HubSpot Contact `videos_played` Value To 0');
			} else {
				videosPlayed = parseInt(response.body.properties.videos_played.value, 10);
				console.log('HubSpot Contact `videos_played`: ' + videosPlayed);
			}
		} else {
			throw new Error('HubSpot GET Failed: ' + response.statusCode);
		}
	})
	.then(function () {
		if (playCount > videosPlayed) {
			/***
			 * NOTE: THIS WILL UPDATE THE HUBSPOT CONTACT RECORD WITH THE VALUE FROM WISTIA
			 ***/		 
			console.log('Setting HubSpot Record To Value From Wistia');
			
			videosPlayed = playCount;
			
			return rp({
				method: 'POST',
				uri: hubspotPath,
				body: {
					'properties': [
						{
							'property': 'videos_played',
							'value': videosPlayed
						}
					]
				},
				json: true,
				resolveWithFullResponse: true
			});

	 	} else if (playCount === videosPlayed) {
			/***
			 * NOTE: DON'T DO ANYTHING IF THE VALUES ARE THE SAME
			 ***/
			console.log('Value\'s Are The Same');
			
			throw 'End Promise';
		} else {
			/***
			 * NOTE: THIS WILL UPDATE THE INCREMENT THE HUBSPOT CONTACT RECORD IF IT IS HIGHER THAN THE VALUE FROM WISTIA
			 ***/
			console.log('Manually Incrementing HubSpot Record');
			
			videosPlayed += 1;
			
			return rp({
				method: 'POST',
				uri: hubspotPath,
				body: {
					'properties': [
						{
							'property': 'videos_played',
							'value': videosPlayed
						}
					]
				},
				json: true,
				resolveWithFullResponse: true
			});
		}
	})
	.then(function (response) {
		/***
		 * NOTE: DISPLAYS THE FINAL HUBSPOT CONTACT RECORD OF `videos_played` AFTER IT HAS BEEN UPDATED EITHER MANUALLY OR BY WISTIA'S VALUE
		 ***/ 
		if(response.statusCode == 204) {
			console.log('Updated | HubSpot Contact `videos_played`: ' + videosPlayed);
		} else {
			throw new Error('HubSpot POST Failed: ' + response.statusCode);
		}
	})
	.catch(function(err) {
		if (err !== 'No Email' || err !== 'End Promise') {
			console.error(err);
		}
	});

	res.send('OK\n');
}

// RUN FUNCTIONS ON POSTS TO THE URL
app.post("/", verify, hubstia);

// VISIBLE AT THE URL IN THE BROWSER DOESN'T DO ANYTHING THOUGH
app.get('/', function(req, res) {
	res.send('• Hubstia •')
	console.log('GET Request Received');
})

// STANDARD NODEJS LISTENER
var server = app.listen(port, function () {
	var host = server.address().address;
	var port = server.address().port;

	console.log('Listening at https://%s:%s', host, port);
});