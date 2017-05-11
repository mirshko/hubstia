/**
*  This is a webhook server that listens for webhook
*  callbacks coming from Wistia, and updates a contact's HubSpot
*  record of `videos_played` each time it is called from the data
*  gathered from the webhook payload
*
*  TO GET STARTED
*  * Add your HubSpot API & Wistia API keys and Wistia Secret Key to .env file
*  * (Run a test webhook from Wistia to get the uuid of the payload)
*  * Install dependencies via `npm install`
*  * Run `node index.js` on a publicly visible IP
*  * Register your webhook and point to http://<ip or domain>:3123
*
*  @author: Jeff Reiner (mirshko)
*/

require('dotenv').config();
const express = require('express');
const rp = require('request-promise');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3123;
const wapiKey = process.env.WAPI_KEY;
const hapiKey = process.env.HAPI_KEY;
const uuid = process.env.UUID;

// FOR SECRET KEY VERIFICATION
const {getHash} = require('./signature-verification')

// READ THE PAYLOAD FROM THE WEBHOOK
const options = { type: 'json' }
app.use(bodyParser.raw(options));

// OBJECT TO THROW WHEN NOT AN ERROR
function Thrower(message) {
  this.name = 'Thrower';
  this.message = message || 'Message';
  console.log(message);
}

// VERIFY SIGNATURE FROM WISTIA WEBHOOK SECRET KEY MATCHES THE PAYLOAD FROM WISTIA, IF NOT DON'T RUN API CALLS
function verify(req, res, next) {
  const headers = req.headers
  const wistiaSignature = headers['x-wistia-signature']
  // console.log("Wistia Signature: ", wistiaSignature)

  const requestBody = req.body
  const computedHash = getHash(requestBody)
  // console.log("The computed hash is: ", computedHash)

  if (wistiaSignature === computedHash) {
    console.log("Signature Looks Good!")
    next();
  } else {
    res.sendStatus(200);
    console.log('Valid Signature Not Present!');
  }
}

// DO ALL THE API STUFF
function hubstia(req, res, next) {
  // VISITOR KEY COMES FROM WEBHOOK PAYLOAD FROM WISTIA
  const requestBody = req.body;
  const payload = JSON.parse(requestBody).events[0].payload;

  console.log('Wistia Visitor `id`: ' + payload.visitor.id);

  // VARS
  let playCount = 0;
  let	videosPlayed = 0;
  let	contactEmail = 'bh@hubspot.com';
  const visitorKey = payload.visitor.id;

  // CALL TO WISTIA WITH KEY FROM WEBHOOK PAYLOAD TRIGGERED BY A VIDEO PLAY EVENT
  const wistiaPath = 'https://api.wistia.com/v1/stats/visitors/' + visitorKey + '.json?api_password=' + wapiKey;

  // CALL TO HUBSPOT WITH EMAIL FROM WISTIA STATS API RESPONSE DATA
  let hubspotPath = 'https://api.hubapi.com/contacts/v1/contact/email/' + contactEmail + '/profile?hapikey=' + hapiKey;

  /*
   * NOTE: CALL TO WISTIA TO GET EMAIL FROM WEBHOOK
   */

  rp({
    method: 'GET',
    uri: wistiaPath,
    json: true,
    resolveWithFullResponse: true
  })
  .then(response => {
    /*
     * NOTE: GET VISITOR'S `play_count` AND `visitor_identity` EMAIL FROM WISTIA
     */
    if (response.statusCode === 200) {
      console.log('Wistia Visitor `play_count`: ' + response.body.play_count);
      playCount = response.body.play_count;

      if (response.body.visitor_identity.email !== null) {
        /*
         * NOTE: IF WISTIA VISITOR HAS AN EMAIL ATTACHED TO THEIR ID MAKE CALL TO HUBSPOT
         *       TO LOOKUP THEIR INFORMATION FROM THE WISTIA RESPONSE, THIS WON'T RUN IF
         *       THEY DON'T HAVE AN EMAIL, THAT WILL THEN END THE PROMISE CHAIN AND WE DONE
         */
        contactEmail = response.body.visitor_identity.email;
        console.log('Wistia Visitor `email`: ' + contactEmail);
        hubspotPath = 'https://api.hubapi.com/contacts/v1/contact/email/' + contactEmail + '/profile?hapikey=' + hapiKey;

        return rp({
          method: 'GET',
          uri: hubspotPath,
          json: true,
          resolveWithFullResponse: true
        });
      }
      throw new Thrower('No Email');
    } else {
      throw new Error('Wistia GET Failed: ' + response.statusCode);
    }
  })
  .then(response => {
    if (response.statusCode === 200) {
      /*
       * NOTE: PRINTS THE EMAIL IN THE HUBSPOT CONTACT RECORD. IF THE VALUE OF THE HUBSPOT CONTACT RECORD ISN'T SET
       *       THEN SET A DEFAULT VALUE OF 0. THIS VALUE (EITHER 0 OR X FROM WISTIA) IS THEN UPDATED INTO HUBSPOT IN THE FOLLOWING POST
       */
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
  .then(() => {
    if (playCount > videosPlayed) {
      /*
       * NOTE: THIS WILL UPDATE THE HUBSPOT CONTACT RECORD WITH THE VALUE FROM WISTIA
       */
      console.log('Setting HubSpot Record To Value From Wistia');

      videosPlayed = playCount;

      return rp({
        method: 'POST',
        uri: hubspotPath,
        body: {
          properties: [
            {
              property: 'videos_played',
              value: videosPlayed
            }
          ]
        },
        json: true,
        resolveWithFullResponse: true
      });
    } else if (playCount === videosPlayed) {
      /*
       * NOTE: DON'T DO ANYTHING IF THE VALUES ARE THE SAME, THAT WOULD BE A WASTE OF A CALL
       */
      console.log('Value\'s Are The Same');

      throw new Thrower('End Promise');
    } else {
      /*
       * NOTE: THIS WILL INCREMENT THE HUBSPOT CONTACT RECORD IF IT IS HIGHER THAN THE VALUE FROM WISTIA.
       *       THIS IS MAINLY USED FOR WHEN WISTIA'S PLAY COUNT VALUE HASN'T BEEN UPDATED YET AS IT IS NOT REAL-TIME
       */
      console.log('Manually Incrementing HubSpot Record');

      videosPlayed += 1;

      return rp({
        method: 'POST',
        uri: hubspotPath,
        body: {
          properties: [
            {
              property: 'videos_played',
              value: videosPlayed
            }
          ]
        },
        json: true,
        resolveWithFullResponse: true
      });
    }
  })
  .then(response => {
    /*
     * NOTE: DISPLAYS THE FINAL HUBSPOT CONTACT RECORD OF `videos_played` AFTER IT HAS BEEN UPDATED EITHER MANUALLY OR BY WISTIA'S VALUE
     */
    if (response.statusCode === 204) {
      console.log('Updated | HubSpot Contact `videos_played`: ' + videosPlayed);
    } else {
      throw new Error('HubSpot POST Failed: ' + response.statusCode);
    }
  })
  .catch(err => {
    /*
     * NOTE: IF SOMETHING FAILS DURING THE PROMISE CHAIN OR ANYWHERE THIS BLOCK SHOULD FIRE WITH THE STACKTRACE OF THE ERROR
     */
    if (err.name !== 'Thrower') {
      console.error(err);
    }
  });

  // GOOD RESPONSE AFTER EVERYTHING RUNS NICELY
  res.send('OK\n');
}

// RUN BOTH FUNCTIONS UPON RECEIVING A POST TO THE SERVER
app.post('/', verify, hubstia);

// VISIBLE AT THE URL IN THE BROWSER DOESN'T DO ANYTHING THOUGH
app.get('/', (req, res) => {
  res.send('• Hubstia •');
  console.log('GET Request Received');
});

// STANDARD NODEJS LISTENER
const server = app.listen(port, () => {
  const host = server.address().address;
  const port = server.address().port;

  console.log('Listening at https://%s:%s', host, port);
});