// @ts-check
'use strict'

const fetch = require('node-fetch').default

// Requests User Agent
const userAgent = `github.com/rigwild/suivi-poste v${require('./package.json').version}${
  process.env.SUIVI_POSTE_PROXY === 'true' ? ' - call through https://suivi-poste-proxy.rigwild.dev/ proxy server' : ''
}`

/**
 * Provide the API key to the `suivi-poste` handler.
 *
 * Get an API key at https://developer.laposte.fr/products/suivi/latest
 * @param {string} API_KEY Suivi colis API key
 */
module.exports.api = API_KEY => ({
  /**
   * Load a shipment's tracking data
   * @param {string[]} trackingNumbers Shipment tracking number
   */
  getTracking: (...trackingNumbers) =>
    fetch(`https://api.laposte.fr/suivi/v2/idships/${trackingNumbers.join(',')}?lang=fr_FR`, {
      headers: {
        Accept: 'application/json',
        'X-Okapi-Key': API_KEY,
        'User-Agent': userAgent
      }
    }).then(async res => {
      // FIXME: Currently, there's a problem with the API, when the tracking number is invalid,
      // the API returns a 404 not found and no JSON.
      // Mock the response for now.
      if (res.headers.get('content-type') !== 'application/json') {
        console.log(trackingNumbers)
        // @ts-ignore
        res.customErrorStatus = 400
        // @ts-ignore
        res.bodyJson =
          trackingNumbers.length > 1
            ? trackingNumbers.map(trackingNumber => ({
                returnCode: 400,
                returnMessage: 'Votre numéro est inconnu. Veuillez le ressaisir en respectant le format.',
                lang: 'fr_FR',
                scope: 'open',
                idShip: trackingNumber
              }))
            : {
                returnCode: 400,
                returnMessage: 'Votre numéro est inconnu. Veuillez le ressaisir en respectant le format.',
                lang: 'fr_FR',
                scope: 'open',
                idShip: trackingNumbers[0]
              }
        throw res
      }

      if (!res.ok) {
        // @ts-ignore
        res.bodyJson = await res.json()
        throw res
      }
      return res.json()
    })
})

/** List of shipments possible events */
module.exports.events = {
  DR1: { msg: 'Déclaratif réceptionné', step: 1 },
  PC1: { msg: 'Pris en charge', step: 2 },
  PC2: { msg: 'Pris en charge dans le pays d’expédition', step: 2 },
  ET1: { msg: 'En cours de traitement', step: 3 },
  ET2: { msg: 'En cours de traitement dans le pays d’expédition', step: 3 },
  ET3: { msg: 'En cours de traitement dans le pays de destination', step: 3 },
  ET4: { msg: 'En cours de traitement dans un pays de transit', step: 3 },
  EP1: { msg: 'En attente de présentation', step: 3 },
  DO1: { msg: 'Entrée en Douane', step: 3 },
  DO2: { msg: 'Sortie de Douane', step: 3 },
  DO3: { msg: 'Retenu en Douane', step: 3 },
  PB1: { msg: 'Problème en cours', step: 3 },
  PB2: { msg: 'Problème résolu', step: 3 },
  MD2: { msg: 'Mis en distribution', step: 4 },
  ND1: { msg: 'Non distribuable', step: 4 },
  AG1: { msg: 'En attente d’être retiré au guichet', step: 4 },
  RE1: { msg: 'Retourné à l’expéditeur', step: 4 },
  DI1: { msg: 'Distribué', step: 5 },
  DI2: { msg: 'Distribué à l’expéditeur', step: 5 }
}

module.exports.shipmentHolderEnum = {
  '1': 'Courrier national',
  '2': 'Courrier international',
  '3': 'Chronopost',
  '4': 'Colissimo'
}
module.exports.shipmentTimelineElemTypeEnum = {
  '1': 'OK',
  '0': 'Aléa',
  '-1': 'KO'
}
module.exports.shipmentContextDataDeliveryChoiceEnum = {
  '0': '',
  '1': 'Possible',
  '2': 'Choisi'
}
