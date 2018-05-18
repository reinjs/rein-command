# @reinjs/rein-command

The commander library of rein-cli

## Install

```shell
npm i @reinjs/rein-command
```

## Usage

```javascript
const program = require('@reinjs/rein-command');
const app = new program(__dirname);
app.version(pkg.version);
app.plugin({ ... });
app.use('npm owner', '../lib/middleware/auth2');
app.param('name', '../lib/middleware/param');
app.command('npm owner add :name([a-zA-z0-9]+)', '../lib/middleware/auth', '../lib/owner.add');
app.listen();
```

Then we use command `npm owner add evio`

# License

It is [MIT licensed](https://opensource.org/licenses/MIT).