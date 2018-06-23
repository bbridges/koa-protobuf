const parse = require('co-body');
const contentType = require('content-type');
const getRawBody = require('raw-body');

module.exports.protobufParser = function (messageType, options = {}) {
  return async function (ctx, next) {
    let type = contentType.parse(ctx).type;
    let success;

    if (type === 'application/x-protobuf') {
      success = await _parseProtobuf(ctx, messageType);
    } else if (type === 'application/json' && options.parseJson !== false) {
      success = await _parseJson(ctx, messageType);
    } else {
      success = false;

      let message = options.parseJson !== false ?
          'Only content types `application/x-protobuf and `application/json`' +
          ' are allowed for message ' + messageType.name :
          'Only content type `application/x-protobuf is allowed for message ' +
          messageType.name;

      ctx.throw(415, message);
    }

    if (success) await next();
  };
}

module.exports.protobufSender = function (options = {}) {
  return async function (ctx, next) {
    await next();

    let proto = ctx.proto || ctx.response.proto;

    if (proto !== undefined) {
      switch (ctx.accepts('application/x-protobuf', 'application/json')) {
        case 'application/x-protobuf':
          _encodeProtobuf(ctx, proto);
          break;
        case 'application/json':
          if (options.sendJson !== false) {
            _encodeJson(ctx, proto);
            break;
          }
        default:
          let message = options.sendJson !== false ?
            'Only `application/x-protobuf and `application/json` can be ' +
            'given for message ' + message.constructor.name :
            'Only `application/x-protobuf can be given for message ' +
            message.constructor.name;

          ctx.throw(406, message);
      }
    }
  }
}

async function _parseProtobuf(ctx, messageType) {
  try {
    let body = await getRawBody(ctx.req, { length: ctx.request.length });
    ctx.request.proto = messageType.decode(body);
    return true;
  } catch (err) {
    ctx.throw(415, `Invalid wire format for message ${messageType.name}`);
    return false;
  }
}

async function _parseJson(ctx, messageType) {
  let obj;

  if (ctx.request.body !== undefined) {
    obj = ctx.request.body;
  } else {
    try {
      obj = await parse.json(ctx.req);
    } catch (err) {
      ctx.throw(415, 'Invalid JSON');
      return false;
    }
  }

  let err = messageType.verify(obj);

  if (err) {
    ctx.throw(415, `JSON was not compatible with message ${messageType.name}`);
    return false;
  } else {
    ctx.request.proto = messageType.fromObject(obj);
    return true;
  }
}

function _encodeProtobuf(ctx, proto) {
  ctx.type = 'application/x-protobuf';
  ctx.body = proto.constructor.encode(proto).finish();
}

function _encodeJson(ctx, proto) {
  ctx.type = 'application/json';
  ctx.body = proto.toJSON();
}
