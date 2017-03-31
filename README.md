# hubstia

> Getting Wistia visitor play counts into HubSpot contact records since 2017.

# Running Locally

Make sure you have [Node.js](http://nodejs.org/) installed, get an API key from both Wistia (Just needs access to read data) & HubSpot.

Make a .env file with the following variables

```
HAPI_KEY=HUBSPOT-API-KEY
WAPI_KEY=WISTIA-API-KEY
UUID=WISTIA-PAYLOAD-UUID
```

Then

```sh
$ npm install
$ npm start
```

Your app should now be running on [localhost:3123](http://localhost:3123/).

# Testing Locally

Run this command in a new terminal window after getting your UUID from the [Wistia webhook](https://wistia.com/doc/webhooks) payload and adding it here. 

```sh
$ curl -H "Content-Type: application/json" -X POST -d '{ "hook": { "uuid": "WISTIA-PAYLOAD-UUID" }, "events": [{ "payload": { "visitor": { "id": "WISTIA-VISITOR-ID" } } }] }' http://localhost:3123/
```