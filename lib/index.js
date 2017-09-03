const { errJsonDebug } = require('err-json');
const { format } = require('util');

function formatSingleArg(arg) {
  if (typeof(arg) !== 'object') {
    return arg;
  }

  if (arg instanceof Error) {
    return JSON.stringify(errJsonDebug(arg, true));
  }

  return JSON.stringify(arg);
}

function createLogStream(cwlogs, options, callback) {
  const {
    logGroupName,
    logStreamName,
  } = options;

  return cwlogs.createLogStream({
    logGroupName,
    logStreamName,
  }, (err, data) => {
    if (err) {
      if (err.code === 'ResourceNotFoundException') {
        return cwlogs.createLogGroup({
          logGroupName,
        }, (err, data) => {
          if (err) {
            return callback(err);
          }

          createLogStream(cwlogs, logGroupName, logStreamName, callback);
        });
      }

      return callback(err);
    }

    callback(null);
  });
}

exports.cwlogs = (options = {}) => {
  const {
    logGroupName,
    makeLogStreamName,
  } = options;

  let cwlogs;

  return next => (event, context, callback) => {
    const logStreamName = makeLogStreamName(event, context);

    if (!logStreamName) {
      context.logEvent = () => {};
      return next(event, context, callback);
    }

    const logEvents = [];

    context.logEvent = (...args) => {
      const message = args.length === 1
        ? formatSingleArg(args[0])
        : format(...args);

      logEvents.push({
        timestamp: Date.now(),
        message,
      });
    };

    next(event, context, (err, result) => {
      if (logEvents.length === 0) {
        return callback(err, result);
      }

      if (!cwlogs) {
        const { CloudWatchLogs } = require('aws-sdk');
        cwlogs = new CloudWatchLogs();
      }

      const params = {
        logGroupName,
        logStreamNamePrefix: logStreamName,
      };

      cwlogs.describeLogStreams(params, (err, data) => {
        if (err) {
          if (err.code !== 'ResourceNotFoundException') {
            return callback(err, null);
          }
        }

        if (data) {
          const { logStreams } = data;
          const logStream = logStreams.find(s => s.logStreamName === logStreamName);

          if (logStream) {
            return put(logStream.uploadSequenceToken);
          }
        }

        createLogStream(cwlogs, { logGroupName, logStreamName }, err => {
          if (err) {
            return callback(err, null);
          }

          put();
        });
      });

      function put(sequenceToken) {
        const params = {
          logGroupName,
          logStreamName,
          logEvents,
          sequenceToken,
        };

        cwlogs.putLogEvents(params, (err, data) => {
          if (err) {
            return callback(err, null);
          }

          callback(err, result);
        });
      }
    });
  };
};
