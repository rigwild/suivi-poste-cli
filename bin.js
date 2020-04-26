#!/usr/bin/env node

// @ts-check
'use strict'

const fetch = require('node-fetch').default
const chalk = require('chalk')
const suiviPoste = require('./lib')

const help = () => {
  console.log('Usage: suivi-poste <tracking_number>')
  process.exit(1)
}

// Check if no parameters provided
if (process.argv.length <= 2) help()

const trackingNumber = process.argv[2]

// Check if asked for help message
if (['-h', '--help', 'help', '--aide', 'aide'].some(x => x === trackingNumber)) help()

// Support `--raw` command line option (no error checking)
const isRawMode = process.argv.length >= 3 && process.argv[3] === '--raw'

const apiUri = process.env.NODE_ENV === 'test' ? 'http://localhost:42210' : `https://suivi-poste-proxy.rigwild.dev`
const userAgent = `suivi-laposte-cli/${require('./package.json').version}`

/** @param {Date} date */
const dateFormat = date => {
  const two = num => ('0' + num).slice(-2)
  return (
    `${date.getFullYear()}-` +
    `${two(date.getMonth() + 1)}-` +
    `${two(date.getDate())} ` +
    `${two(date.getHours())}:` +
    `${two(date.getMinutes())}:` +
    `${two(date.getSeconds())}`
  )
}

// Track the shipment and print the result to the console
const setup = async () => {
  try {
    const res = await fetch(`${apiUri}/${trackingNumber}`, { headers: { 'User-Agent': userAgent } })

    if (isRawMode) return process.stdout.write(await res.text())

    if (!res.ok) throw res

    const trackingData = await res.json()
    // TODO: Format console output
    console.log(trackingData)

    const s = trackingData.shipment
    if (s.product) console.log(`Dénomination du produit: ${s.product}`)
    if (s.holder) console.log(`Métier en charge de l'objet: ${suiviPoste.shipmentHolderEnum[s.holder]}`)
    if (s.isFinal) console.log(`Finalisé: ${s.isFinal}`)
    if (s.entryDate) console.log(`Date de prise en charge: ${dateFormat(new Date(s.entryDate))}`)
    if (s.deliveryDate) console.log(`Date de livraison: ${dateFormat(new Date(s.deliveryDate))}`)
    console.log()
    s.timeline.reverse().forEach(x => {
      let content = ''
      if (x.status) content += '>> '
      if (x.date) content += `${dateFormat(new Date(x.date))} - `
      content += `${suiviPoste.shipmentTimelineElemTypeEnum[x.type]}`
      if (x.country) content += ` - Pays: ${x.country}`
      if (x.shortLabel) content += ` - ${x.shortLabel}`
      if (x.longLabel) content += `\n\t${x.longLabel}`
      console.log(content)
    })

    // TODO: Add `contextData` https://developer.laposte.fr/products/suivi/latest
  } catch (err) {
    if (isRawMode) return console.error(err)

    const body = await err.json()

    // Got a Node.js error
    if (body.error) return console.error(body.error)

    // Got error with the shipment tracking
    console.error(chalk.red(body.returnMessage))
    console.error(body)
  }
}
setup()
