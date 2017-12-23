const assert = require('assert')
const extend = require('xtend')
const HdKeyring = require('../')
const sigUtil = require('eth-sig-util')
const eccrypto = require('eccrypto')

// Sample account:
const privKeyHex = 'b8a9c05beeedb25df85f8d641538cbffedf67216048de9c678ee26260eb91952'

const sampleMnemonic = 'finish oppose decorate face calm tragic certain desk hour urge dinosaur mango'
const firstAcct = '0x1c96099350f13d558464ec79b9be4445aa0ef579'
const secondAcct = '0x1b00aed43a693f3a957f9feb5cc08afa031e37a0'

describe('hd-keyring', function() {

  let keyring
  beforeEach(function() {
    keyring = new HdKeyring()
  })

  describe('constructor', function(done) {
    it('constructs', function (done) {
      keyring = new HdKeyring({
        mnemonic: sampleMnemonic,
        numberOfAccounts: 2,
      })

      const accounts = keyring.getAccounts()
      .then((accounts) => {
        assert.equal(accounts[0], firstAcct)
        assert.equal(accounts[1], secondAcct)
        done()
      })
    })
  })

  describe('Keyring.type', function() {
    it('is a class property that returns the type string.', function() {
      const type = HdKeyring.type
      assert.equal(typeof type, 'string')
    })
  })

  describe('#type', function() {
    it('returns the correct value', function() {
      const type = keyring.type
      const correct = HdKeyring.type
      assert.equal(type, correct)
    })
  })

  describe('#serialize empty wallets.', function() {
    it('serializes a new mnemonic', function() {
      keyring.serialize()
      .then((output) => {
        assert.equal(output.numberOfAccounts, 0)
        assert.equal(output.mnemonic, null)
      })
    })
  })

  describe('#deserialize a private key', function() {
    it('serializes what it deserializes', function(done) {
      keyring.deserialize({
        mnemonic: sampleMnemonic,
        numberOfAccounts: 1
      })
      .then(() => {
        assert.equal(keyring.wallets.length, 1, 'restores two accounts')
        return keyring.addAccounts(1)
      }).then(() => {
        return keyring.getAccounts()
      }).then((accounts) => {
        assert.equal(accounts[0], firstAcct)
        assert.equal(accounts[1], secondAcct)
        assert.equal(accounts.length, 2)

        return keyring.serialize()
      }).then((serialized) => {
        assert.equal(serialized.mnemonic, sampleMnemonic)
        done()
      })
    })
  })

  describe('#addAccounts', function() {
    describe('with no arguments', function() {
      it('creates a single wallet', function(done) {
        keyring.addAccounts()
        .then(() => {
          assert.equal(keyring.wallets.length, 1)
          done()
        })
      })
    })

    describe('with a numeric argument', function() {
      it('creates that number of wallets', function(done) {
        keyring.addAccounts(3)
        .then(() => {
          assert.equal(keyring.wallets.length, 3)
          done()
        })
      })
    })
  })

  describe('#getAccounts', function() {
    it('calls getAddress on each wallet', function(done) {

      // Push a mock wallet
      const desiredOutput = 'foo'
      keyring.wallets.push({
        getAddress() {
          return {
            toString() {
              return desiredOutput
            }
          }
        }
      })

      const output = keyring.getAccounts()
      .then((output) => {
        assert.equal(output[0], '0x' + desiredOutput)
        assert.equal(output.length, 1)
        done()
      })
    })
  })

  describe('#signPersonalMessage', function () {
    it('returns the expected value', function (done) {
      const address = firstAcct
      const privateKey = new Buffer(privKeyHex, 'hex')
      const message = '0x68656c6c6f20776f726c64'

      keyring.deserialize({
        mnemonic: sampleMnemonic,
        numberOfAccounts: 1,
      })
      .then(() => {
        return keyring.signPersonalMessage(address, message)
      })
      .then((sig) => {
        assert.notEqual(sig, message, 'something changed')

        const restored = sigUtil.recoverPersonalSignature({
          data: message,
          sig,
        })

        assert.equal(restored, sigUtil.normalize(address), 'recovered address')
        done()
      })
      .catch((reason) => {
        console.error('failed because', reason)
      })
    })
  })

  describe('#signTypedData', function () {
    it('returns the expected value', function (done) {
      const address = firstAcct
      const privateKey = Buffer.from(privKeyHex, 'hex')
      const typedData = [
        {
          type: 'string',
          name: 'message',
          value: 'Hi, Alice!'
        }
      ]

      keyring.deserialize({ mnemonic: sampleMnemonic, numberOfAccounts: 1 }).then(function () {
        return keyring.signTypedData(address, typedData)
      }).then(function (sig) {
        const restored = sigUtil.recoverTypedSignature({ data: typedData, sig: sig })
        assert.equal(restored, sigUtil.normalize(address), 'recovered address')
        done()
      }).catch(function (reason) {
        console.error('failed because', reason)
      })
    })
  })

  describe('#encryptPersonalMessage', function() {
    it('encrypts and decrypts a message', function(done) {
      const address = firstAcct
      const msgHex = '68656c6c6f20776f726c64'  //hello world

      keyring.deserialize({
        mnemonic: sampleMnemonic,
        numberOfAccounts: 1,
      })
      .then(function() {
        return keyring.encryptPersonalMessage(address, msgHex)
      })
      .then(function(encrypted) {
        return keyring.decryptPersonalMessage(address, encrypted)
      })
      .then(function(msg) {
        assert(msg == msgHex)
        done()
      })
      .catch(function(err) {
        console.error('failed because', err)
      })
    })

    it('fails on a bad private key', function(done) {
      const msgHex = 'ABC123'
      let privateKeyBuf = Buffer(31) //key is wrong length
      privateKeyBuf.fill(5)

      try {
        keyring._ECIESEncryptMessage(privateKeyBuf, msgHex)
      }
      catch (e) {
        done()
      }
    })

    it('fails on wrong private key', function(done) {
      const msgHex = 'ABC123'
      let pk1 = Buffer(32)
      pk1.fill(5)

      let pk2 = Buffer(32)
      pk2.fill(6)

      keyring._ECIESEncryptMessage(pk1, msgHex)
      .then(function(encryptedMsg) {
        return keyring._ECIESDecryptMessage(pk2, encryptedMsg)
      })
      .then(function(decryptedMsg) {
        console.error('failed because', decryptedMsg)
      })
      .catch(function(err) {
        done()
      })
    })
  })

  describe('custom hd paths', function () {

    it('can deserialize with an hdPath param and generate the same accounts.', function (done) {
      const hdPathString = `m/44'/60'/0'/0`
      const sampleMnemonic = 'finish oppose decorate face calm tragic certain desk hour urge dinosaur mango'

      keyring.deserialize({
        mnemonic: sampleMnemonic,
        numberOfAccounts: 1,
        hdPath: hdPathString,
      })
      .then(() => {
        return keyring.getAccounts()
      })
      .then((addresses) => {
        assert.equal(addresses[0], firstAcct)
        return keyring.serialize()
      })
      .then((serialized) => {
        assert.equal(serialized.hdPath, hdPathString)
        done()
      })
      .catch((reason) => {
        console.error('failed because', reason)
      })
    })

    it('can deserialize with an hdPath param and generate different accounts.', function (done) {
      const hdPathString = `m/44'/60'/0'/1`
      const sampleMnemonic = 'finish oppose decorate face calm tragic certain desk hour urge dinosaur mango'

      keyring.deserialize({
        mnemonic: sampleMnemonic,
        numberOfAccounts: 1,
        hdPath: hdPathString,
      })
      .then(() => {
        return keyring.getAccounts()
      })
      .then((addresses) => {
        assert.notEqual(addresses[0], firstAcct)
        return keyring.serialize()
      })
      .then((serialized) => {
        assert.equal(serialized.hdPath, hdPathString)
        done()
      })
      .catch((reason) => {
        console.log('failed because', reason)
      })
    })
  })

  describe('create and restore 1k accounts', function () {
    it('should restore same accounts with no problem', async function () {
      this.timeout(20000)

      for (let i = 0; i < 1e3; i++) {

        keyring = new HdKeyring({
          numberOfAccounts: 1,
        })
        const originalAccounts = await keyring.getAccounts()
        const serialized = await keyring.serialize()
        const mnemonic = serialized.mnemonic

        keyring = new HdKeyring({
          numberOfAccounts: 1,
          mnemonic,
        })
        const restoredAccounts = await keyring.getAccounts()

        const first = originalAccounts[0]
        const restored = restoredAccounts[0]
        const msg = `Should restore same account from mnemonic: "${mnemonic}"`
        assert.equal(restoredAccounts[0], originalAccounts[0], msg)

      }

      return true
    })
  })
})
