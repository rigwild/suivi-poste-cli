// @ts-check
'use strict'

// A simple server that lets users query tracking data without registering for an API key
// also hides the user's IP, which is cool for privacy 🤫

require('dotenv-safe').config()

const API_KEY = process.env.API_KEY
const SERVER_PORT = process.env.SERVER_PORT

// Tell to the lib that it's the proxy server doing the query
process.env['SUIVI_POSTE_PROXY'] = 'true'

const express = require('express')

const suiviPoste = require('./lib')
const suiviPostApi = suiviPoste.api(API_KEY)

const app = express()

// Trust reverse proxy
app.set('trust proxy', 1)

// Open CORS
// @ts-ignore
app.use(require('cors')())
// Compress responses
// @ts-ignore
app.use(require('compression')())
// Apply rate limit
app.use(
  // @ts-ignore
  require('express-rate-limit')({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: 'You have reached your `suivi-poste` rate limit (max 50 calls/15 minutes). Wait some time.'
  })
)
// Log requests
// @ts-ignore
app.use(require('morgan')('combined'))

app.get('/:trackingNumber', async (req, res) => {
  res.setHeader('Content-Type', 'application/json')

  const trackingNumber = req.params.trackingNumber
  if (!trackingNumber) return res.status(409).send({ returnMessage: 'Missing tracking number' })

  try {
    const result = await suiviPostApi.getTracking(trackingNumber)
    console.log(JSON.stringify(result, null, 2))
    res.json(result)
  } catch (err) {
    const status = err.customErrorStatus ? err.customErrorStatus : err.status
    res.status(typeof status === 'number' ? status : 500).json(err.bodyJson || { error: err.message })
  }
})

app.listen(SERVER_PORT, () => console.log(`Server is listening on http://localhost:${SERVER_PORT}`))
