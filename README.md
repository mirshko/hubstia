# hubstia

> Getting Wistia visitor play counts into HubSpot contact records since 2017.

# Running

Make sure you have [Node.js](http://nodejs.org/) installed, get an API key from both Wistia (Just needs access to read data) & HubSpot.

Make a .env file with the following variables

```
HAPI_KEY=HUBSPOT-API-KEY
WAPI_KEY=WISTIA-API-KEY
WEBHOOKS_SECRET_KEY=WEBHOOK-SECRET
```

Then

```sh
$ npm install
$ npm start
```

Your app should now be running on [localhost:3123](http://localhost:3123/).