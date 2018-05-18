const path = require('path');
const compose = require('koa-compose');
const { EventEmitter } = require('async-events-listener');
const Router = require('ys-middleware-router');
const YsDbo = require('ys-dbo');
const { format, encode, decode } = require('./argv');

module.exports = class Commander extends EventEmitter {
  constructor(cwd) {
    super();
    this.cwd = cwd;
    this.middleware = [];
    this.configs = [];
    this._closed = false;
    this._version = '0.0.0';
    this.env = process.env.NODE_ENV || 'development';
    this.router = new Router();
    ['error', 'rejectionHandled', 'uncaughtException', 'unhandledRejection'].forEach(errorType => process.on(errorType, e => this._error(e)));
  }
  
  version(version) {
    this._version = version;
    return this;
  }
  
  plugin(options) {
    this.configs.push(options);
    return this;
  }
  
  use(...args) {
    this.router.use(encode(args[0]), ...this._transform(args.slice(1)));
    return this;
  }
  
  param(...args) {
    this.router.param(args[0], ...this._transform(args.slice(1)));
    return this;
  }
  
  command(...args) {
    this.router.get(encode(args[0]), ...this._transform(args.slice(1)));
    return this;
  }
  
  listen(argv = process.argv.slice(2)) {
    const { pather, args } = decode(argv);
    this.url = '/' + pather.join('/');
    this.data = format(args);
    this._start()
    .then(() => process.exit(0))
    .catch(e => this._error(e));
  }
  
  async _start() {
    this.ysdbo = new YsDbo(this.configs);
    await this.ysdbo.connect();
    /**
     * command.option: -v
     * 输出版本号
     */
    this._push(async (ctx, next) => {
      if (ctx.url === '/' && Object.keys(this.data).length === 1 && this.data.v) {
        return console.log(this._version);
      }
      await next();
    });
    this._push(this.ysdbo.way({ error: this._error.bind(this) }));
    this._push(this.router.routes());
    const fns = compose(this.middleware);
    await fns(this, () => this.emit('404'));
    await this.ysdbo.disconnect();
    this._closed = true
  }
  
  _error(e) {
    this.emit('error', e)
    .then(() => {
      if (!this._closed && this.ysdbo.disconnect) {
        const promise = this.ysdbo.disconnect();
        this._closed = true;
        return promise;
      }
    })
    .then(() => process.exit(1))
    .catch(() => process.exit(1));
  }
  
  _push(fn) {
    if (typeof fn !== 'function') throw new TypeError('middleware must be a function!');
    this.middleware.push(fn);
    return this;
  }
  
  _transform(args) {
    const result = [];
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (typeof arg === 'string') {
        try{
          result.push(require(path.resolve(this.options.cwd, arg)));
        } catch(e) {
          this.error(e);
          return process.exit(1);
        }
      } else {
        result.push(arg);
      }
    }
    return result;
  }
};