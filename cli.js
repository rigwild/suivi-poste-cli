#!/usr/bin/env node

// @ts-check
'use strict'

const argv = require('minimist')(process.argv.slice(2))
const chalk = require('chalk')
const Table = require('cli-table3')
const suiviPoste = require('suivi-poste')

const trackingNumbers = argv._.map(x => x.toString())

// Check if asked for help message or no tracking numbers provided
if (trackingNumbers.length === 0 || ['h', 'help', 'aide'].some(x => argv[x] === true)) {
  console.log(`
  Usage
    $ suivi-poste <tracking_numbers>
  
  Options
    --help --aide -h    Afficher l'aide
    --full              Afficher les informations complètes de suivi
    --raw               Récupérer le résultat brut de l'API au format JSON
    --no-color          Désactiver l'affichage des couleurs
    --api-key="<token>" Clef d'API suivi La Poste à utiliser
    
  Exemple
    $ suivi-poste 4P36275770836
    $ suivi-poste 4P36275770836 --full
    $ suivi-poste 4P36275770836 6T11111111110 114111111111111
    $ suivi-poste 4P36275770836 114111111111111 --no-color
    $ suivi-poste 4P36275770836 --raw --api-key="my-api-key"

  suivi-poste-cli v${require('./package.json').version} - https://github.com/rigwild/suivi-poste-cli
`)
  process.exit(0)
}

// Support `--raw` and `--full` command line options
const isRawMode = argv.raw === true
const isFullMode = argv.full === true

/** @param {Date} date */
const dateFormat = date => {
  const two = num => ('0' + num).slice(-2)
  return `Le ${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()} à ${two(date.getHours())}h${two(date.getMinutes())}`
}

const errorToOutput = trackingData => {
  let shipmentDataTable = new Table({
    colWidths: [30, 70],
    wordWrap: true
  })
  shipmentDataTable.push(
    ...[
      [chalk.cyanBright('Numéro de suivi'), `${chalk.redBright(trackingData.idShip)} 👎`],
      [chalk.cyanBright('Erreur'), trackingData.returnMessage || 'Numéro inconnu.'],
      [chalk.cyanBright('URL de suivi'), `https://www.laposte.fr/outils/suivre-vos-envois?code=${trackingData.idShip}`]
    ]
  )
  return shipmentDataTable.toString()
}

const dataToOutputBasic = trackingData => {
  // Basic data table
  const s = trackingData.shipment
  let shipmentDataTable = new Table({
    colWidths: [30, 70],
    wordWrap: true
  })

  if (s.idShip) shipmentDataTable.push({ [chalk.cyanBright('Numéro de suivi')]: chalk.greenBright(`${s.idShip} 👍`) })
  if (s.isFinal) shipmentDataTable.push({ [chalk.cyanBright('Finalisé')]: s.isFinal ? '✔️' : '❌' })
  if (s.entryDate) shipmentDataTable.push({ [chalk.cyanBright('Date de prise en charge')]: dateFormat(new Date(s.entryDate)) })
  if (s.deliveryDate) shipmentDataTable.push({ [chalk.cyanBright('Date de livraison')]: dateFormat(new Date(s.deliveryDate)) })

  // Context data
  const c = trackingData.shipment.contextData
  if (c && c.removalPoint && c.removalPoint.name) shipmentDataTable.push({ [chalk.grey('Point de retrait')]: `${c.removalPoint.type} ${c.removalPoint.name}` })

  // Show last event
  const lastEvent = s.event[0]
  shipmentDataTable.push([chalk.cyanBright('Dernier statut'), `${dateFormat(new Date(lastEvent.date))} :\n${lastEvent.label ? lastEvent.label : suiviPoste.events[lastEvent.code].msg}`])

  return shipmentDataTable.toString()
}

const dataToOutputFull = trackingData => {
  let trackingDataStr = ''

  // Shipment data
  const s = trackingData.shipment
  let shipmentDataTable = new Table({
    colWidths: [30, 50],
    wordWrap: true
  })

  if (s.idShip) shipmentDataTable.push({ [chalk.cyanBright('Numéro de suivi')]: `${chalk.green(s.idShip)} 👍` })
  if (s.isFinal) shipmentDataTable.push({ [chalk.cyanBright('Finalisé')]: s.isFinal ? '✔️' : '❌' })
  if (s.entryDate) shipmentDataTable.push({ [chalk.cyanBright('Date de prise en charge')]: dateFormat(new Date(s.entryDate)) })
  if (s.deliveryDate) shipmentDataTable.push({ [chalk.cyanBright('Date de livraison')]: dateFormat(new Date(s.deliveryDate)) })

  trackingDataStr += shipmentDataTable.toString()

  // Context data
  const c = trackingData.shipment.contextData
  let contextDataTable = new Table({
    colWidths: [30, 70],
    wordWrap: true
  })
  if (s.product) contextDataTable.push({ [chalk.grey('Dénomination du produit')]: `${s.product[0].toUpperCase()}${s.product.slice(1)}` })
  if (s.holder) contextDataTable.push({ [chalk.grey("Métier en charge de l'objet")]: suiviPoste.shipmentHolderEnum[s.holder] })
  if (c) {
    if (c.removalPoint && c.removalPoint.name) contextDataTable.push({ [chalk.grey('Point de retrait')]: `${c.removalPoint.type} ${c.removalPoint.name}` })
    if (c.originCountry) contextDataTable.push({ [chalk.grey("Pays d'origine")]: c.originCountry })
    if (c.arrivalCountry) contextDataTable.push({ [chalk.grey('Pays de destination')]: c.arrivalCountry })
    if (c.deliveryChoice && c.deliveryChoice.deliveryChoice) contextDataTable.push({ [chalk.grey('Modification de livraison')]: suiviPoste.shipmentContextDataDeliveryChoiceEnum[c.deliveryChoice.deliveryChoice] })
    if (c.partner) contextDataTable.push({ [chalk.grey('Informations sur poste internationale')]: `${c.partner.name} - ${c.partner.network} - ${c.partner.reference}` })
    if (s.url) contextDataTable.push({ [chalk.grey('URL de suivi')]: s.url })
  }
  trackingDataStr += `\n${contextDataTable.toString()}`

  // Events
  let eventsTable = new Table({
    head: ['Date', 'Événement'],
    colWidths: [30, 90],
    wordWrap: true,
    style: {
      head: []
    }
  })
  eventsTable.push(
    ...s.event.reverse().map((x, i, arr) => {
      return [dateFormat(new Date(x.date)), x.label ? x.label : suiviPoste.events[x.code].msg]
    })
  )
  trackingDataStr += `\n${eventsTable.toString()}`

  return trackingDataStr
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

    if (argv['api-key']) console.log(`${chalk.grey("Appel direct à l'API suivis postaux via la clef d'API passée en paramètre.")}\n`)

    // Sort tracked numbers in the order of the console input
    const trackingLogs = trackingDatas
      .sort((a, b) => (trackingNumbers.indexOf(a.idShip || a.shipment.idShip) > trackingNumbers.indexOf(b.idShip || b.shipment.idShip) ? 1 : -1))
      .map(trackingData => {
        // Load the appropriate formatter

        // Check if tracking failed
        if (trackingData.returnCode < 200 || trackingData.returnCode >= 300) return errorToOutput(trackingData)

        // Check if full data mode
        if (isFullMode) return dataToOutputFull(trackingData)

        return dataToOutputBasic(trackingData)
      })

    console.log(`\n${trackingLogs.join('\n_______________________\n\n')}\n`)
  } catch (err) {
    if (!err || isRawMode) return console.error(err)

    // Got a Node.js error
    if (err.message) return console.error(err)

    if (!Array.isArray(err)) err = [err]

    // Got error with the shipment tracking
    err.forEach(x => console.error(chalk.red(`❌ ${x.idShip} | ${x.returnMessage}`)))
    console.error(chalk.cyanBright(`\n🛠️ Cet outil se base sur l'API de suivi Open Data de La Poste, en beta. Certains numéros de suivis peuvent ne pas être reconnus.\n` + `👉 Essayez sur le site: https://www.laposte.fr/outils/suivre-vos-envois\n`))
  }
}
setup()
