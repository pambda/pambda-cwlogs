const { errJsonDebug } = require('err-json');
const { format } = require('util');
const { callbackify } = require('lambda-callbackify');

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

          createLogStream(cwlogs, {logGroupName, logStreamName}, callback);
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
    strictMode,
  } = options;

  let cwlogs;

  return next => {
    next = callbackify(next);

    return (event, context, callback) => {
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

      next(event, context, (orgErr, result) => {
        if (logEvents.length === 0) {
          return callback(orgErr, result);
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

          cwlogs.putLogEvents(params)
            .on('success', response => {
              callback(orgErr, result);
            })
            .on('error', (err, response) => {
              /*
               * Retry if possible.
               */
              if (err.code === 'InvalidSequenceTokenException' ||
                err.code === 'DataAlreadyAcceptedException') {

                const rawJson = JSON.parse(response.httpResponse.body);
                const { expectedSequenceToken } = rawJson;

                put(expectedSequenceToken);
                return;
              }

              /*
               * Call back with an error that is occurred by CloudWatchLogs if strictMode.
               */
              if (strictMode) {
                return callback(err, null);
              }

              /*
               * Output the error to the console, and call back with an original error and result.
               */
              console.error(formatSingleArg(err));
              callback(orgErr, result);
            })
            .send();
        }
      });
    };
  };
};
