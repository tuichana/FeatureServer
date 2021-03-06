const FsInfo = require('./info.js')
const FsQuery = require('./query.js')
const Templates = require('./templates')

module.exports = route

/**
 * shared logic for handling Feature Service requests
 * most providers will use this mehtod to figure out what request is being made
 *
 * @param  {Object}   req
 * @param  {Object}   res
 * @param  {Object}   geojson
 */
function route (req, res, geojson, options) {
  req.query = req.query || {}
  req.query = coerceQuery(req.query)
  req.params = req.params || {}
  if (req.query.callback) req.query.callback = sanitizeCallback(req.query.callback)
  Object.keys(req.query).forEach(key => {
    req.query[key] = tryParse(req.query[key])
  })

  // check for info requests and respond like ArcGIS Server would
  if (isInfoReq(req)) return res.status(200).send(Templates.render('info'))
  // if this is for a method we can handle like query
  const method = req.params && req.params.method
  switch (method) {
    case 'query': return execQuery(req, res, geojson, options)
    default: return execInfo(req, res, method, geojson)
  }
}

function isInfoReq (req) {
  const url = req.originalUrl || req.url
  url.substr(-4) === 'info'
}

function execQuery (req, res, geojson, options) {
  let response
  try {
    response = FsQuery(geojson, req.query || {})
  } catch (e) {
    if (process.env.NODE_ENV === 'test') console.trace(e)
    res.status(500).json({error: e.message})
  }
  if (req.query.callback) res.send(`${req.query.callback}(${JSON.stringify(response)})`)
  else res.status(200).json(response)
}

function execInfo (req, res, method, geojson) {
  let info
  const layerPat = new RegExp(/FeatureServer\/layers/i)
  const url = req.url || req.originalUrl
  try {
    if (layerPat.test(url)) {
      info = FsInfo.layers(geojson, req.query)
    } else if (!method && !req.params.layer) {
      info = FsInfo.serviceInfo(geojson, req.params)
    } else if (!method) {
      info = FsInfo.layerInfo(geojson, req.params)
    } else {
      throw new Error('Method not supported')
    }
  } catch (e) {
    if (process.env.NODE_ENV === 'test') console.trace(e)
    res.status(500).json({error: e.message})
  }
  if (req.query.callback) res.send(`${req.query.callback}(${JSON.stringify(info)})`)
  else res.status(200).json(info)
}

function sanitizeCallback (callback) {
  return callback.replace(/[^\w\d\.\(\)\[\]]/g, '') // eslint-disable-line
}

function tryParse (json) {
  try {
    return JSON.parse(json)
  } catch (e) {
    return json
  }
}

function coerceQuery (params) {
  Object.keys(params).forEach(param => {
    if (params[param] === 'false') params[param] = false
    else if (params[param] === 'true') params[param] = true
  })
  return params
}
