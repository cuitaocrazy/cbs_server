const express = require('express')
const jwtMiddleware = require('express-jwt')
const jwt = require('jsonwebtoken')
const userDb = require('../storages/Users')
const cbsDb = require('../storages/CBS')

// #region middleware
function adminMiddleware(req, res, next) {
  if (req.user.userId !== 'admin') {
    res.sendStatus(403)
  } else {
    next()
  }
}

function formdataCheckMiddleware(req, res, next) {
  if (!req.is('application/json') && ['POST', 'PUT', 'PATH'].includes(req.method)) {
    res.sendStatus(412)
  } else {
    next()
  }
}
// #endregion middleware

// #region router config
const router = express.Router()
const userRouter = express.Router()
const cbsConfigRouter = express.Router()

router.use(
  jwtMiddleware({
    secret: 'cuitao_secret',
  }).unless(req => req.url === '/token')
)

router.use((err, req, res, next) => (err.name === 'UnauthorizedError' ? res.status(401).send('invalid token...') : next()))
router.use(formdataCheckMiddleware)
router.use('/users', userRouter)
router.use('/cbs-config', cbsConfigRouter)

userRouter.use(adminMiddleware)
cbsConfigRouter.use(adminMiddleware)
// #endregion router config

// #region token
router.post('/token', async (req, res, next) => {
  try {
    const user = req.body
    const suser = await userDb.get(user.username)
    if (suser && suser.password === user.password) {
      res.json({ token: jwt.sign({ userId: user.username, isAdmin: user.username === 'admin' }, 'cuitao_secret') })
    } else {
      res.status(401).send('Username or Passwrod Error!')
    }
  } catch (err) {
    if (err.name === 'NotFoundError') {
      res.status(401).send('Username or Passwrod Error!')
    } else {
      next(err)
    }
  }
})
// #endregion token

router.get('/test', (req, res) => {
  res.send('ok')
})

// #region users
userRouter
  .route('/')
  .get((req, res, next) => {
    userDb
      .all()
      .then(us => res.json(us.map(u => ({ username: u.username }))))
      .catch(next)
  })
  .post((req, res, next) => {
    userDb
      .get(req.body.username)
      .then(u => {
        if (u == null) {
          userDb.put({ username: req.body.username, password: req.body.password }).then(() => res.sendStatus(200))
        } else {
          res.sendStatus(403)
        }
      })
      .catch(next)
  })

userRouter
  .route('/:username')
  .get((req, res, next) => {
    userDb
      .get(req.params.username)
      .then(user => (user ? res.json({ username: user.username }) : res.sendStatus(404)))
      .catch(next)
  })
  .delete((req, res, next) => {
    userDb
      .del(req.params.username)
      .then(() => res.sendStatus(200))
      .catch(next)
  })
  .put((req, res, next) => {
    userDb
      .get(req.params.username)
      .then(user => (user ? userDb.put({ ...user, password: req.body.password }).then(() => res.sendStatus(200)) : res.sendStatus(404)))
      .catch(next)
  })
// #endregion users

// #region cbs config

cbsConfigRouter
  .route('/')
  .get((req, res, next) => {
    cbsDb
      .getConfig()
      .then(config => (config ? res.json(config) : res.json({})))
      .catch(next)
  })
  .put((req, res, next) => {
    cbsDb
      .setConfig(req.body)
      .then(() => res.sendStatus(200))
      .catch(next)
  })

// #endregion cbs config

module.exports = router
