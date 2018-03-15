const test = require('tape');
const { cwlogs } = require('..');

const AWS = require('aws-sdk');
AWS.config.update({
  region: 'us-west-2',
});

test('test', t => {
  t.plan(2);

  const lambda = cwlogs({
    logGroupName: 'Sandbox',
    makeLogStreamName(event, context) {
      return 'testStream';
    },
  })((event, context, callback) => {
    t.equal(typeof(context.logEvent), 'function');

    context.logEvent('test message');
    context.logEvent(event);

    callback(null, {});
  });

  lambda({}, {}, (err, result) => {
    t.error(err);
  });
});

test('discard logs', t => {
  t.plan(2);

  const lambda = cwlogs({
    logGroupName: 'Sandbox',
    makeLogStreamName(event, context) {
      return null;
    },
  })((event, context, callback) => {
    t.equal(typeof(context.logEvent), 'function');

    context.logEvent('this message must be discarded');

    callback(null, {});
  });

  lambda({}, {}, (err, result) => {
    t.error(err);
  });
});
