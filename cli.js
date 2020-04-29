#!/usr/bin/env node

// @ts-check
'use strict'

const argv = require('minimist')(process.argv.slice(2))
const chalk = require('chalk')
const suiviPoste = require('suivi-poste')

const trackingNumbers = argv._.map(x => x.toString())

// Check if asked for help message or no tracking numbers provided
if (trackingNumbers.length === 0 || ['h', 'help', 'aide'].some(x => argv[x] === true)) {
  console.log(`
  Usage
    $ suivi-poste <tracking_numbers>
  
  Options
    --help --aide -h    Afficher l'aide
    --raw               Récupérer le résultat brut de l'API au format JSON
    --no-colors         Désactiver l'affichage des couleurs
    --api-key="<token>" Clef d'API suivi La Poste à utiliser
    
  Exemple
    $ suivi-poste 4P36275770836 6T11111111110 114111111111111
    $ suivi-poste 4P36275770836 114111111111111 --no-colors
    $ suivi-poste 4P36275770836 --raw --api-key="my-api-key"

  https://github.com/rigwild/suivi-poste
`)
  process.exit(0)
}

// Disable colors if `--no-colors` (chalk)
if (argv.colors === false) process.env.FORCE_COLOR = '0'

// Support `--raw` command line option
const isRawMode = argv.raw === true

/** @param {Date} date */
const dateFormat = date => {
  const two = num => ('0' + num).slice(-2)
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`
}

// Track the shipment and print the result to the console
const setup = async () => {
  try {
    const suiviPosteApi = suiviPoste.api({
      token: argv['api-key'],
      userAgent: `suivi-laposte-cli/${require('./package.json').version}`,
      uri: process.env.NODE_ENV === 'test' ? 'http://localhost:42210/_proxy' : !argv['api-key'] ? 'https://suivi-poste-proxy.rigwild.dev/_proxy' : undefined
    })

    let trackingDatas = await suiviPosteApi.getTracking(...trackingNumbers)

    // Raw mode, just print the result
    if (isRawMode) return process.stdout.write(JSON.stringify(trackingDatas))

    // If not an array, only one tracking number, wrap in array
    if (!Array.isArray(trackingDatas)) trackingDatas = [trackingDatas]
    // console.log(trackingDatas)

    if (argv['api-key']) console.log(`\n${chalk.cyanBright("Appel direct à l'API suivis postaux via la clef d'API passée en paramètre.")}`)

    // Sort tracked numbers in the order of the console input
    const trackingLogs = trackingDatas
      .sort((a, b) => (trackingNumbers.indexOf(a.idShip || a.shipment.idShip) > trackingNumbers.indexOf(b.idShip || b.shipment.idShip) ? 1 : -1))
      .map(trackingData => {
        // Check if tracking failed
        if (trackingData.returnCode < 200 || trackingData.returnCode >= 300)
          return `\n${chalk.blueBright('Numéro de suivi              : ')}${chalk.red(trackingData.idShip)} 👎\n` + `${chalk.grey(trackingData.returnMessage || 'Numéro inconnu.')}\n` + `👉 ${chalk.cyanBright('Essayez sur le site: https://www.laposte.fr/outils/track-a-parcel')}`

        let trackingDataStr = '\n'

        // Shipment data
        const s = trackingData.shipment
        if (s.idShip) trackingDataStr += `${chalk.blueBright('Numéro de suivi              : ')}${chalk.green(s.idShip)} 👍\n`
        if (s.isFinal) trackingDataStr += `${chalk.blueBright('Finalisé                     : ')}${s.isFinal ? '✔️' : '❌'}\n`
        if (s.entryDate) trackingDataStr += `${chalk.blueBright('\nDate de prise en charge      : ')}${dateFormat(new Date(s.entryDate))}\n`
        if (s.deliveryDate) trackingDataStr += `${chalk.blueBright('Date de livraison            : ')}${dateFormat(new Date(s.deliveryDate))}\n`

        if (s.product) trackingDataStr += `${chalk.grey('\nDénomination du produit      : ')}${s.product[0].toUpperCase()}${s.product.slice(1)}\n`
        if (s.holder) trackingDataStr += `${chalk.grey("Métier en charge de l'objet  : ")}${suiviPoste.shipmentHolderEnum[s.holder]}\n`

        // Context data
        const c = trackingData.shipment.contextData
        if (c) {
          if (c.removalPoint && c.removalPoint.name) trackingDataStr += `${chalk.grey('Point de retrait            : ')}${c.removalPoint.type} ${c.removalPoint.name}\n`
          if (c.originCountry) trackingDataStr += `${chalk.grey("Pays d'origine               : ")}${c.originCountry}\n`
          if (c.arrivalCountry) trackingDataStr += `${chalk.grey('Pays de destination          : ')}${c.arrivalCountry}\n`
          if (c.deliveryChoice && c.deliveryChoice.deliveryChoice) trackingDataStr += `${chalk.grey('Modification de livraison    : ')}${suiviPoste.shipmentContextDataDeliveryChoiceEnum[c.deliveryChoice.deliveryChoice]}\n`
          if (c.partner) trackingDataStr += `${chalk.grey('Informations sur poste internationale : ')}${c.partner.name} - ` + `${c.partner.network} - ` + `${c.partner.reference}\n`
          if (s.url) trackingDataStr += `${chalk.grey('URL de suivi                 : ')}${s.url}\n`

          trackingDataStr += '\n'
        }

        // Timeline - Hideen as a events is more relevant.
        // s.timeline.forEach(x => {
        //   if (x.status) trackingDataStr += '✔️ '
        //   if (x.date) trackingDataStr += `${dateFormat(new Date(x.date))} - `
        //   trackingDataStr += `${suiviPoste.shipmentTimelineElemTypeEnum[x.type]}`
        //   if (x.country) trackingDataStr += ` - Pays: ${x.country}`
        //   if (x.shortLabel) trackingDataStr += ` - ${x.shortLabel}`
        //   if (x.longLabel) trackingDataStr += `\n\t${x.longLabel}`
        //   trackingDataStr += '\n'
        // })

        // trackingDataStr += '\n'

        // Events
        s.event.reverse().forEach((x, i, arr) => {
          if (x.date) trackingDataStr += `${chalk.yellow(dateFormat(new Date(x.date)))} - `
          trackingDataStr += x.label ? x.label : suiviPoste.events[x.code]
          if (i !== arr.length - 1) trackingDataStr += '\n'
        })

        return trackingDataStr
      })

    console.log(trackingLogs.join('\n_______________________\n'), '\n')
  } catch (err) {
    if (!err || isRawMode) return console.error(err)

    // Got a Node.js error
    if (err.message) return console.error(err)

    if (!Array.isArray(err)) err = [err]

    // Got error with the shipment tracking
    err.forEach(x => console.error(chalk.red(`❌ ${x.idShip} | ${x.returnMessage}`)))
    console.error(chalk.cyanBright(`\n🛠️ Cet outil se base sur l'API de suivi Open Data de La Poste, en beta. Certains numéros de suivis peuvent ne pas être reconnus.\n` + `👉 Essayez sur le site: https://www.laposte.fr/outils/track-a-parcel\n`))
  }
}
setup()
