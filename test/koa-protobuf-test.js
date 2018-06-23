const path = require('path');

const expect = require('chai').expect;
const Koa = require('koa');
const bodyparser = require('koa-bodyparser');
const protobuf = require('protobufjs');
const Router = require('koa-router');
const request = require('request-promise-native');

const { protobufParser, protobufSender } = require('..');

const root = protobuf.loadSync(path.join(__dirname, 'messages.proto'));

const Test1 = root.lookupType('Test1');

describe('Koa Router Test 1', function () {
  let app = new Koa();
  let router = new Router();

  app.use(bodyparser());
  app.use(protobufSender());

  router.get('/no-proto', (ctx) => {
    ctx.body = { test: 'hello' };
  });

  router.post('/no-proto', (ctx) => {
    ctx.body = ctx.request.body;
  });

  router.get('/proto-1', (ctx) => {
    ctx.proto = Test1.create({
      field_1: 3,
      field_2: Buffer.from([1, 2, 3])
    });
  });

  router.post('/proto-1', protobufParser(Test1), (ctx) => {
    let message = ctx.request.proto;

    message.field_1 = 4;

    ctx.proto = message;
  });

  app.use(router.routes());
  app.use(router.allowedMethods());

  before(function (done) {
    this.server = app.listen(0, (err) => {
      if (err) {
        done(err);
      } else {
        this.base = `http://localhost:${this.server.address().port}`;
        done();
      }
    });
  });

  it('should behave normally with a normal GET request', async function () {
    let resp = await request({
      uri: this.base + '/no-proto',
      json: true,
      resolveWithFullResponse: true
    });

    expect(resp.statusCode).to.equal(200);
    expect(resp.body.test).to.equal('hello');
  });

  it('should behave normally with a normal POST request', async function () {
    let resp = await request({
      uri: this.base + '/no-proto',
      method: 'POST',
      json: { echo: true },
      resolveWithFullResponse: true
    });

    expect(resp.statusCode).to.equal(200);
    expect(resp.body.echo).to.equal(true);
  });

  it('should retreive a protobuf with a GET request', async function () {
    let resp = await request({
      uri: this.base + '/proto-1',
      method: 'GET',
      headers: {
        'accept': 'application/x-protobuf'
      },
      encoding: null,
      resolveWithFullResponse: true
    });

    let expected = Test1.encode(Test1.create({
      field_1: 3,
      field_2: Buffer.from([1, 2, 3])
    })).finish();

    expect(resp.statusCode).to.equal(200);
    expect(resp.headers['content-type']).to.equal('application/x-protobuf');
    expect(Buffer.compare(resp.body, expected)).to.equal(0);
  });

  it('should send and retreive a protobuf with a POST request',
      async function () {
    let resp = await request({
      uri: this.base + '/proto-1',
      method: 'POST',
      headers: {
        'content-type': 'application/x-protobuf',
        'accept': 'application/x-protobuf'
      },
      body: Test1.encode(Test1.create({
        field_1: 3,
        field_2: Buffer.from([1, 2, 3])
      })).finish(),
      encoding: null,
      resolveWithFullResponse: true
    });

    let expected = Test1.encode(Test1.create({
      field_1: 4,
      field_2: Buffer.from([1, 2, 3])
    })).finish();

    expect(resp.statusCode).to.equal(200);
    expect(resp.headers['content-type']).to.equal('application/x-protobuf');
    expect(Buffer.compare(resp.body, expected)).to.equal(0);
  });

  it('should retreive a JSON-encoded protobuf with a GET request',
      async function () {
    let resp = await request({
      uri: this.base + '/proto-1',
      method: 'GET',
      json: true,
      resolveWithFullResponse: true
    });

    let expected = {
      field_1: 3,
      field_2: Buffer.from([1, 2, 3]).toString('base64')
    }

    expect(resp.statusCode).to.equal(200);
    expect(JSON.stringify(resp.body)).to.equal(JSON.stringify(expected));
  });

  it('should send and retreive a JSON-encoded protobuf with a POST request',
      async function () {
    let resp = await request({
      uri: this.base + '/proto-1',
      method: 'POST',
      body: {
        field_1: 3,
        field_2: Buffer.from([1, 2, 3]).toString('base64')
      },
      json: true,
      resolveWithFullResponse: true
    });

    let expected = {
      field_1: 4,
      field_2: Buffer.from([1, 2, 3]).toString('base64')
    }

    expect(resp.statusCode).to.equal(200);
    expect(JSON.stringify(resp.body)).to.equal(JSON.stringify(expected));
  });

  after(function (done) {
    this.server.close(done);
  });
});
