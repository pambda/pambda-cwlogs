# pambda-cwlogs

Pambda to output logs to CloudWatch Logs.

## Installation

```
npm i pambda-cwlogs -S
```

## Usage

``` javascript
import { compose, createLambda } from 'pambda';
import { cwlogs } from 'pambda-cwlogs';

export const handler = createLambda(
  compose(
    cwlogs({
      logGroupName: 'Sandbox',
      makeLogStreamName(event, context) {
        return event.userId;
      },
    }),

    // Subsequent pambdas can log messages.
    next => (event, context, callback) => {
      context.logEvent('Path: %s', event.path);
    }
  )
);
```

## cwlogs(options)

Generate and return a pambda which adds the logger function to `context`.

- `options.logGroupName`
    - The name of the log group.
- `options.makeLogStreamName(event, context)`
    - The function makes the name of the log stream.

## context.logEvent(...args)

A function that is added by this pambda to `context'.

It outputs the message specified by argument `args` to CloudWatch Logs.

## License

MIT
