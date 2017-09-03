# pambda-cwlogs

CloudWatch Logs にログを出力する Pambda.

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

    // 後続の Pambda は context からログ出力ができる。
    next => (event, context, callback) => {
      context.logEvent('Path: %s', event.path);
    }
  )
);
```

## cwlogs(options)

`context` にログ出力関数を追加する Pambda を生成して返す。

- `options.logGroupName`
    - ログの出力先グループ名。
- `options.makeLogStreamName(event, context)`
    - ログの出力先ストリーム名を返す関数。
    - この関数が falsy な値を返した時はログ出力しない。

## context.logEvent(...args)

この Pambda によって `context` に追加される関数。

引数 `args` で指定したメッセージを CloudWatch Logs に出力する。

## License

MIT
