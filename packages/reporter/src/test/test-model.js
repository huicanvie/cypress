import _ from 'lodash'
import { action, computed, observable } from 'mobx'

import Attempt from '../attempts/attempt-model'
import Err from '../lib/err-model'
import Runnable from '../runnables/runnable-model'

export default class Test extends Runnable {
  @observable attempts = []
  @observable _isOpen = null
  @observable _isFinished = false

  _store

  _attempts = {}
  type = 'test'

  constructor (props, level, store) {
    super(props, level)

    this._store = store

    _.defaults(props, {
      _currentRetry: 0,
    })

    _.each(props.prevAttempts, this._addAttempt)

    this._addAttempt(props)
  }

  @computed get isLongRunning () {
    return _.some(this.attempts, (attempt) => {
      return attempt.isLongRunning
    })
  }

  @computed get isOpen () {
    if (this._isOpen === null) {
      return this.state === 'failed'
      || this.isLongRunning
      || this._store && this._store.hasSingleTest
    }

    return this._isOpen
  }

  @computed get state () {
    return this._lastAttempt ? this._lastAttempt.state : 'active'
  }

  @computed get err () {
    return this._lastAttempt ? this._lastAttempt.err : new Err({})
  }

  @computed get _lastAttempt () {
    return _.last(this.attempts)
  }

  @computed get hasMultipleAttempts () {
    return this.attempts.length > 1
  }

  @computed get hasRetried () {
    return this.state === 'passed' && this.hasMultipleAttempts
  }

  @computed get isActive () {
    return _.some(this.attempts, { isActive: true })
  }

  isLastAttempt (attemptModel) {
    return this._lastAttempt === attemptModel
  }

  addLog = (props) => {
    this._withAttempt(props.testCurrentRetry, (attempt) => {
      attempt.addLog(props)
    })
  }

  updateLog (props) {
    this._withAttempt(props.testCurrentRetry, (attempt) => {
      attempt.updateLog(props)
    })
  }

  @action start (props) {
    let attempt = this.getAttemptByIndex(props._currentRetry)

    if (!attempt) {
      attempt = this._addAttempt(props)
    }

    attempt.start()

  }

  @action toggleOpen = () => {
    this._isOpen = !this.isOpen
  }

  // this is called to sync up the command log UI for the sake of
  // screenshots, so we only ever need to open the last attempt
  setIsOpen (isOpen, cb) {
    if (this.isOpen === isOpen) {
      return this._lastAttempt.setIsOpen(isOpen, cb)
    }

    this._lastAttempt.setIsOpen(isOpen, cb)
    this._isOpen = isOpen

  }

  @action finish (props) {
    this._isFinished = props._currentRetry >= props._retries

    this._withAttempt(props._currentRetry, (attempt) => {
      attempt.finish(props)
    })
  }

  @action _setLongRunning (isLongRunning) {
    this.isLongRunning = isLongRunning
  }

  getAttemptByIndex (attemptIndex) {
    return this._attempts[attemptIndex]
  }

  commandMatchingErr () {
    return this._lastAttempt.commandMatchingErr()
  }

  _addAttempt = (props) => {
    const attempt = new Attempt(props, this)

    this._attempts[attempt.id] = attempt
    this.attempts.push(attempt)

    return attempt
  }

  _withAttempt (attemptIndex, cb) {
    const attempt = this.getAttemptByIndex(attemptIndex)

    if (attempt) cb(attempt)
  }
}
