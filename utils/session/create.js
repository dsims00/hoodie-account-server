module.exports = createSession

var Boom = require('boom')
var calculateSessionId = require('couchdb-calculate-session-id')
var Promise = require('lie')

var findcustomRoles = require('../find-custom-roles')
var findIdInRoles = require('../find-id-in-roles')
var validatePassword = require('../validate-password')

function createSession (options, callback) {
  options.db.get('org.couchdb.user:' + options.username)
  .then(function (response) {
    return new Promise(function (resolve, reject) {
      validatePassword(
        options.password,
        response.salt,
        response.iterations,
        response.derived_key,
        function (error, isCorrectPassword) {
          if (error) {
            return reject(error)
          }

          if (!isCorrectPassword) {
            return reject(Boom.unauthorized('Invalid password'))
          }

          resolve(response)
        }
      )
    })
  })
  .then(function (response) {
    var sessionTimeout = 1209600 // 14 days
    var bearerToken = calculateSessionId(
      response.name,
      response.salt,
      options.secret,
      Math.floor(Date.now() / 1000) + sessionTimeout
    )

    var accountId = findIdInRoles(response.roles)

    if (!accountId) {
      return callback(Boom.forbidden('"id:..." role missing (https://github.com/hoodiehq/hoodie-server-account/blob/master/how-it-works.md#id-role)'))
    }

    var session = {
      id: bearerToken,
      account: {
        id: accountId,
        username: options.username,
        roles: findcustomRoles(response.roles)
      }
    }

    if (options.includeProfile) {
      session.account.profile = response.profile
    }

    return callback(null, session)
  })

  .catch(function (error) {
    callback(Boom.wrap(error, error.status))
  })
}
