const test = require('tape');
const { cwlogs } = require('..');

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
