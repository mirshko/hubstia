## This is now doable with the New HubSpot x Wistia V2 integration.
Set up a Workflow to enroll users based on **Play Property** Percent Watched is greater than 0. Then the next step have the Workflow increment a Contact Record (Videos Played) value by 1. *Make sure to set the Re-encrollment criteria to re-enroll users if the Play property is greater than 0* this will make sure that the value keeps on incrementing for each video they watch. 

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
